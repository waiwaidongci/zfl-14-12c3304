(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    root.CalcEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_PART_EFFECT = {
    gear: { balanced: 0, fast: 18 },
    spring: { steady: -4, tight: 12 },
    escapement: { clean: 0, worn: -28 },
    pendulum: { short: 20, long: -16 }
  };

  const DEFAULT_TIERS = [
    { grade: "S", max: 12, desc: "大师级精度" },
    { grade: "A", max: 22, desc: "优秀走时" },
    { grade: "B", max: 38, desc: "合格水准" },
    { grade: "C", max: 58, desc: "勉强可用" },
    { grade: "D", max: Infinity, desc: "需要返工" }
  ];

  const ESCAPEMENT_PENALTY = 42;
  const OTHER_PENALTY = 34;
  const LENGTH_COEFF = -3;
  const MESH_COEFF = 2.2;

  function resolvePartEffect(slot, variant, partEffect) {
    const table = partEffect || DEFAULT_PART_EFFECT;
    if (!table[slot]) return 0;
    const v = table[slot][variant];
    return typeof v === "number" ? v : 0;
  }

  function calcSlotError(slot, installedVariant, targetVariant, partEffect) {
    if (!installedVariant) {
      return slot === "escapement" ? ESCAPEMENT_PENALTY : OTHER_PENALTY;
    }
    const inst = resolvePartEffect(slot, installedVariant, partEffect);
    const want = resolvePartEffect(slot, targetVariant, partEffect);
    return Math.abs(inst - want);
  }

  function calcPartsBreakdown(installed, target, partEffect) {
    const breakdown = {};
    const safeTarget = target || {};
    Object.entries(safeTarget).forEach(([slot, wanted]) => {
      const value = installed ? installed[slot] : null;
      breakdown[slot] = {
        installed: value,
        target: wanted,
        missing: !value,
        slotError: calcSlotError(slot, value, wanted, partEffect)
      };
    });
    return breakdown;
  }

  function calcPartsErrorTotal(breakdown) {
    return Object.values(breakdown).reduce((s, b) => s + b.slotError, 0);
  }

  function calcTuneError(lengthTune, meshTune) {
    const l = typeof lengthTune === "number" ? lengthTune : 0;
    const m = typeof meshTune === "number" ? meshTune : 0;
    return l * LENGTH_COEFF + m * MESH_COEFF;
  }

  function calcRawError(input) {
    const safe = input || {};
    const { installed, target, lengthTune, meshTune, partEffect } = safe;
    const breakdown = calcPartsBreakdown(installed, target, partEffect);
    const parts = calcPartsErrorTotal(breakdown);
    const tune = calcTuneError(lengthTune, meshTune);
    return {
      breakdown,
      partsError: parts,
      tuneError: tune,
      rawTotal: parts + tune
    };
  }

  function calcTheoretical(input) {
    const r = calcRawError(input);
    return {
      ...r,
      theoreticalAbs: Math.abs(Math.round(r.rawTotal))
    };
  }

  function calcWithJitter(input, jitter) {
    const r = calcRawError(input);
    const j = typeof jitter === "number" ? jitter : 0;
    const withJ = r.rawTotal + j;
    return {
      ...r,
      jitter,
      finalAbs: Math.abs(Math.round(withJ))
    };
  }

  function getTier(errorAbs, tiers) {
    const table = tiers || DEFAULT_TIERS;
    const abs = Math.abs(errorAbs);
    for (const t of table) {
      if (abs <= t.max) return t;
    }
    return table[table.length - 1];
  }

  function isAccepted(errorAbs, targetMax) {
    return Math.abs(errorAbs) <= targetMax;
  }

  function acceptanceGap(errorAbs, targetMax) {
    return Math.abs(errorAbs) - targetMax;
  }

  function evaluateTest(input, opts) {
    const options = opts || {};
    const { jitter, targetMax, partEffect, tiers } = options;
    const r = typeof jitter === "number"
      ? calcWithJitter(input, jitter)
      : calcTheoretical(input);
    const errorAbs = r.finalAbs !== undefined ? r.finalAbs : r.theoreticalAbs;
    const tier = getTier(errorAbs, tiers);
    const accepted = targetMax !== undefined ? isAccepted(errorAbs, targetMax) : null;
    const gap = targetMax !== undefined ? acceptanceGap(errorAbs, targetMax) : null;
    return {
      ...r,
      errorAbs,
      tier: tier.grade,
      tierDesc: tier.desc,
      accepted,
      gap,
      targetMax: targetMax !== undefined ? targetMax : null
    };
  }

  return {
    CONSTANTS: {
      ESCAPEMENT_PENALTY,
      OTHER_PENALTY,
      LENGTH_COEFF,
      MESH_COEFF
    },
    DEFAULT_PART_EFFECT,
    DEFAULT_TIERS,
    resolvePartEffect,
    calcSlotError,
    calcPartsBreakdown,
    calcPartsErrorTotal,
    calcTuneError,
    calcRawError,
    calcTheoretical,
    calcWithJitter,
    getTier,
    isAccepted,
    acceptanceGap,
    evaluateTest
  };
});
