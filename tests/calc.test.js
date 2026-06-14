/* eslint-env node, mocha */
"use strict";

const assert = require("assert");
const path = require("path");
const CalcEngine = require(path.resolve(__dirname, "..", "calc.js"));

const PART_EFFECT = CalcEngine.DEFAULT_PART_EFFECT;
const TIERS = CalcEngine.DEFAULT_TIERS;

const JOB_TARGETS = {
  navy: { gear: "balanced", spring: "steady", escapement: "clean", pendulum: "long" },
  theatre: { gear: "fast", spring: "steady", escapement: "clean", pendulum: "short" },
  travel: { gear: "fast", spring: "tight", escapement: "clean", pendulum: "short" }
};

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message || String(e) });
  }
}

function eq(actual, expected, msg) {
  assert.strictEqual(actual, expected, `${msg || ""} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function approx(actual, expected, eps, msg) {
  const e = eps === undefined ? 1e-9 : eps;
  assert.ok(
    Math.abs(actual - expected) <= e,
    `${msg || ""} — expected ≈${expected}, got ${actual}`
  );
}

// ── 常量 ──────────────────────────────────────────────────────
test("CONSTANTS: 罚分系数与微调系数", () => {
  eq(CalcEngine.CONSTANTS.ESCAPEMENT_PENALTY, 42);
  eq(CalcEngine.CONSTANTS.OTHER_PENALTY, 34);
  eq(CalcEngine.CONSTANTS.LENGTH_COEFF, -3);
  eq(CalcEngine.CONSTANTS.MESH_COEFF, 2.2);
});

test("DEFAULT_PART_EFFECT 结构完整", () => {
  eq(typeof PART_EFFECT.gear.balanced, "number");
  eq(typeof PART_EFFECT.pendulum.short, "number");
  eq(typeof PART_EFFECT.escapement.worn, "number");
});

// ── 零件全匹配 ────────────────────────────────────────────────
test("全匹配：海军舱钟 目标零件全正确 零零件误差", () => {
  const installed = { ...JOB_TARGETS.navy };
  const r = CalcEngine.calcTheoretical({
    installed,
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 0,
    partEffect: PART_EFFECT
  });
  eq(r.partsError, 0, "partsError");
  eq(r.tuneError, 0, "tuneError");
  eq(r.rawTotal, 0, "rawTotal");
  eq(r.theoreticalAbs, 0, "theoreticalAbs");

  for (const slot of Object.keys(JOB_TARGETS.navy)) {
    eq(r.breakdown[slot].slotError, 0, `${slot} slotError`);
    eq(r.breakdown[slot].missing, false, `${slot} missing`);
  }
});

test("全匹配：剧院后台挂钟 目标零件全正确", () => {
  const installed = { ...JOB_TARGETS.theatre };
  const r = CalcEngine.calcTheoretical({
    installed,
    target: JOB_TARGETS.theatre,
    lengthTune: 0,
    meshTune: 0
  });
  eq(r.partsError, 0);
  eq(r.theoreticalAbs, 0);
});

// ── 缺失零件 ──────────────────────────────────────────────────
test("缺失：擒纵空 罚 42，其余三位均空各罚 34", () => {
  const installed = { gear: null, spring: null, escapement: null, pendulum: null };
  const r = CalcEngine.calcTheoretical({
    installed,
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 0
  });
  eq(r.breakdown.escapement.slotError, 42, "escapement penalty");
  eq(r.breakdown.gear.slotError, 34, "gear penalty");
  eq(r.breakdown.spring.slotError, 34, "spring penalty");
  eq(r.breakdown.pendulum.slotError, 34, "pendulum penalty");
  eq(r.partsError, 42 + 34 * 3, "total parts error");
  // 42 + 34*3 = 144
  eq(r.theoreticalAbs, 144);
});

test("缺失：仅擒纵缺失 其他全匹配", () => {
  const installed = {
    gear: "balanced",
    spring: "steady",
    escapement: null,
    pendulum: "long"
  };
  const r = CalcEngine.calcTheoretical({
    installed,
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 0
  });
  eq(r.breakdown.escapement.slotError, 42);
  eq(r.breakdown.gear.slotError, 0);
  eq(r.breakdown.spring.slotError, 0);
  eq(r.breakdown.pendulum.slotError, 0);
  eq(r.partsError, 42);
});

test("缺失：仅摆轮空（非擒纵） 罚 34", () => {
  const installed = {
    gear: "balanced",
    spring: "steady",
    escapement: "clean",
    pendulum: null
  };
  const r = CalcEngine.calcTheoretical({
    installed,
    target: JOB_TARGETS.navy
  });
  eq(r.breakdown.pendulum.slotError, 34);
  eq(r.partsError, 34);
});

// ── 错误零件 ──────────────────────────────────────────────────
test("错误：齿轮 balanced vs fast 差 18", () => {
  const eq_ = CalcEngine.calcSlotError("gear", "fast", "balanced", PART_EFFECT);
  eq(eq_, 18);
});

test("错误：发条 steady(-4) vs tight(12) 差 16", () => {
  const e = CalcEngine.calcSlotError("spring", "tight", "steady", PART_EFFECT);
  eq(e, 16);
});

test("错误：擒纵 clean(0) vs worn(-28) 差 28", () => {
  const e = CalcEngine.calcSlotError("escapement", "worn", "clean", PART_EFFECT);
  eq(e, 28);
});

test("错误：摆轮 short(20) vs long(-16) 差 36", () => {
  const e = CalcEngine.calcSlotError("pendulum", "short", "long", PART_EFFECT);
  eq(e, 36);
});

test("错误：海军舱钟 全零件装反（剧院目标） 总差 = 18+0+0+36 = 54", () => {
  // gear: fast(18) vs balanced(0) => 18
  // spring: steady(-4) vs steady(-4) => 0
  // escapement: clean(0) vs clean(0) => 0
  // pendulum: short(20) vs long(-16) => 36
  const installed = { ...JOB_TARGETS.theatre };
  const r = CalcEngine.calcTheoretical({
    installed,
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 0
  });
  eq(r.breakdown.gear.slotError, 18);
  eq(r.breakdown.pendulum.slotError, 36);
  eq(r.partsError, 18 + 0 + 0 + 36);
  eq(r.partsError, 54);
});

// ── 摆长微调 ──────────────────────────────────────────────────
test("摆长微调：每格 -3 秒", () => {
  approx(CalcEngine.calcTuneError(1, 0), -3);
  approx(CalcEngine.calcTuneError(-1, 0), 3);
  approx(CalcEngine.calcTuneError(8, 0), -24);
  approx(CalcEngine.calcTuneError(-8, 0), 24);
});

test("摆长微调：全匹配 + 摆长 +2，理论 = 0 + 2*(-3) = -6 → abs 6", () => {
  const r = CalcEngine.calcTheoretical({
    installed: { ...JOB_TARGETS.navy },
    target: JOB_TARGETS.navy,
    lengthTune: 2,
    meshTune: 0
  });
  approx(r.tuneError, -6);
  eq(r.theoreticalAbs, 6);
});

test("摆长微调：全匹配 + 摆长 -8 → 理论误差 24", () => {
  const r = CalcEngine.calcTheoretical({
    installed: { ...JOB_TARGETS.navy },
    target: JOB_TARGETS.navy,
    lengthTune: -8,
    meshTune: 0
  });
  eq(r.theoreticalAbs, 24);
});

// ── 咬合微调 ──────────────────────────────────────────────────
test("咬合微调：每格 +2.2 秒", () => {
  approx(CalcEngine.calcTuneError(0, 1), 2.2);
  approx(CalcEngine.calcTuneError(0, -1), -2.2);
  approx(CalcEngine.calcTuneError(0, 5), 11);
  approx(CalcEngine.calcTuneError(0, -5), -11);
});

test("咬合微调：全匹配 + 咬合 +5 → 11 → round → 11", () => {
  const r = CalcEngine.calcTheoretical({
    installed: { ...JOB_TARGETS.navy },
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 5
  });
  approx(r.tuneError, 11);
  eq(r.theoreticalAbs, 11);
});

test("咬合微调：小数部分处理 - 咬合 +1 = 2.2 → round 后 2", () => {
  const r = CalcEngine.calcTheoretical({
    installed: { ...JOB_TARGETS.navy },
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 1
  });
  eq(r.theoreticalAbs, 2);
});

// ── 混合：零件误差 + 微调 ───────────────────────────────────
test("综合：旅行闹钟目标 全匹配 + 摆长 +3 咬合 -2", () => {
  // 零件误差 0
  // tune = 3*(-3) + (-2)*2.2 = -9 -4.4 = -13.4
  // raw = -13.4 → round -13 → abs 13
  const r = CalcEngine.calcTheoretical({
    installed: { ...JOB_TARGETS.travel },
    target: JOB_TARGETS.travel,
    lengthTune: 3,
    meshTune: -2
  });
  approx(r.tuneError, -13.4);
  eq(r.theoreticalAbs, 13);
});

test("综合：擒纵缺失(42) + 摆长微调 6格(-18) + 咬合 0 → 24", () => {
  // 42 + (-18) = 24 → abs 24
  const installed = { gear: "balanced", spring: "steady", escapement: null, pendulum: "long" };
  const r = CalcEngine.calcTheoretical({
    installed,
    target: JOB_TARGETS.navy,
    lengthTune: 6,
    meshTune: 0
  });
  eq(r.partsError, 42);
  approx(r.tuneError, -18);
  eq(r.theoreticalAbs, 24);
});

// ── 随机扰动层 ────────────────────────────────────────────────
test("带扰动：全匹配 + 扰动 +2 → 最终 2", () => {
  const r = CalcEngine.calcWithJitter({
    installed: { ...JOB_TARGETS.navy },
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 0
  }, 2);
  eq(r.jitter, 2);
  eq(r.finalAbs, 2);
});

test("带扰动：全匹配 + 扰动 -2 → abs 2", () => {
  const r = CalcEngine.calcWithJitter({
    installed: { ...JOB_TARGETS.navy },
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 0
  }, -2);
  eq(r.finalAbs, 2);
});

test("带扰动：零件误差 18 + 扰动 -2 → 16", () => {
  // gear fast(18) vs balanced(0) = 18
  // tune 0, jitter -2 → 16
  const installed = { gear: "fast", spring: "steady", escapement: "clean", pendulum: "long" };
  const r = CalcEngine.calcWithJitter({
    installed,
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 0
  }, -2);
  eq(r.partsError, 18);
  eq(r.jitter, -2);
  eq(r.finalAbs, 16);
});

// ── 评分档位 ──────────────────────────────────────────────────
test("评分边界：0 → S", () => eq(CalcEngine.getTier(0).grade, "S"));
test("评分边界：12 → S (边界包含)", () => eq(CalcEngine.getTier(12).grade, "S"));
test("评分边界：13 → A", () => eq(CalcEngine.getTier(13).grade, "A"));
test("评分边界：22 → A (边界包含)", () => eq(CalcEngine.getTier(22).grade, "A"));
test("评分边界：23 → B", () => eq(CalcEngine.getTier(23).grade, "B"));
test("评分边界：38 → B (边界包含)", () => eq(CalcEngine.getTier(38).grade, "B"));
test("评分边界：39 → C", () => eq(CalcEngine.getTier(39).grade, "C"));
test("评分边界：58 → C (边界包含)", () => eq(CalcEngine.getTier(58).grade, "C"));
test("评分边界：59 → D", () => eq(CalcEngine.getTier(59).grade, "D"));
test("评分边界：极大值 → D", () => eq(CalcEngine.getTier(9999).grade, "D"));
test("评分边界：负数取绝对值 -38 → B", () => eq(CalcEngine.getTier(-38).grade, "B"));

// ── 验收判定 ──────────────────────────────────────────────────
test("验收：海军舱钟 maxError 18，误差 17 → 通过", () => {
  eq(CalcEngine.isAccepted(17, 18), true);
  eq(CalcEngine.acceptanceGap(17, 18), -1);
});

test("验收：边界误差 18 → 通过", () => {
  eq(CalcEngine.isAccepted(18, 18), true);
  eq(CalcEngine.acceptanceGap(18, 18), 0);
});

test("验收：误差 19 → 未通过，gap 1", () => {
  eq(CalcEngine.isAccepted(19, 18), false);
  eq(CalcEngine.acceptanceGap(19, 18), 1);
});

test("验收：误差负数取绝对值 -20，目标 22 → 通过", () => {
  eq(CalcEngine.isAccepted(-20, 22), true);
});

// ── evaluateTest 综合 ────────────────────────────────────────
test("evaluateTest：无 jitter，全匹配，目标 18 → S 验收通过", () => {
  const r = CalcEngine.evaluateTest({
    installed: { ...JOB_TARGETS.navy },
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 0,
    partEffect: PART_EFFECT
  }, { targetMax: 18, tiers: TIERS });
  eq(r.errorAbs, 0);
  eq(r.tier, "S");
  eq(r.accepted, true);
  eq(r.gap, -18);
  eq(r.theoreticalAbs, 0);
});

test("evaluateTest：jitter +2.5 四舍五入→3？不，jitter 是数字 2，误差 2 → S，验收通过", () => {
  const r = CalcEngine.evaluateTest({
    installed: { ...JOB_TARGETS.navy },
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 0
  }, { jitter: 2, targetMax: 18 });
  eq(r.jitter, 2);
  eq(r.errorAbs, 2);
  eq(r.tier, "S");
  eq(r.accepted, true);
});

test("evaluateTest：剧院挂钟 全匹配 摆长 +5 咬合 +1 → 误差 | -15 + 2.2 | = 12.8 → 13，A 档", () => {
  // parts = 0, tune = 5*(-3) + 1*2.2 = -15 + 2.2 = -12.8 → round -13 → abs 13
  const r = CalcEngine.evaluateTest({
    installed: { ...JOB_TARGETS.theatre },
    target: JOB_TARGETS.theatre,
    lengthTune: 5,
    meshTune: 1
  }, { targetMax: 22 });
  eq(r.errorAbs, 13);
  eq(r.tier, "A");
  eq(r.accepted, true);
});

test("evaluateTest：全空装配（罚 144）→ D 档，验收不通过 gap 126", () => {
  const installed = { gear: null, spring: null, escapement: null, pendulum: null };
  const r = CalcEngine.evaluateTest({
    installed,
    target: JOB_TARGETS.navy,
    lengthTune: 0,
    meshTune: 0
  }, { targetMax: 18 });
  eq(r.errorAbs, 144);
  eq(r.tier, "D");
  eq(r.accepted, false);
  eq(r.gap, 144 - 18);
});

// ── resolvePartEffect 防御性 ─────────────────────────────────
test("resolvePartEffect：未知零件返回 0", () => {
  eq(CalcEngine.resolvePartEffect("gear", "unknown"), 0);
  eq(CalcEngine.resolvePartEffect("unknown_slot", "balanced"), 0);
});

test("calcSlotError：非擒纵空槽 罚 34", () => {
  eq(CalcEngine.calcSlotError("spring", null, "steady"), 34);
});

test("calcSlotError：擒纵空槽 罚 42", () => {
  eq(CalcEngine.calcSlotError("escapement", null, "clean"), 42);
});

// ── calcTheoretical 对缺省参数的鲁棒性 ────────────────────
test("calcTheoretical：缺省 tuning → 0", () => {
  const r = CalcEngine.calcTheoretical({
    installed: { ...JOB_TARGETS.navy },
    target: JOB_TARGETS.navy
  });
  eq(r.tuneError, 0);
  eq(r.theoreticalAbs, 0);
});

test("calcTheoretical：installed 为空对象 → 视为全缺失", () => {
  const r = CalcEngine.calcTheoretical({
    installed: {},
    target: JOB_TARGETS.navy
  });
  eq(r.partsError, 42 + 34 * 3);
});

test("calcTheoretical：无参数 → 空 installed / 空 target 无错误", () => {
  // 无 target 时 breakdown 为空，partsError 0
  const r = CalcEngine.calcTheoretical();
  eq(r.partsError, 0);
  eq(r.tuneError, 0);
});

// ── 输出汇总 ─────────────────────────────────────────────────
console.log(`\n${"=".repeat(50)}`);
console.log(`  测试结果：通过 ${passed}，失败 ${failed}`);
console.log(`${"=".repeat(50)}`);

if (failed > 0) {
  console.log("\n失败用例：\n");
  for (const f of failures) {
    console.log(`  ✗ ${f.name}`);
    console.log(`      ${f.error}\n`);
  }
  process.exit(1);
} else {
  console.log("\n  ✓ 全部测试通过\n");
  process.exit(0);
}
