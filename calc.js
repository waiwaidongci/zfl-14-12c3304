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

  const DEFAULT_SAMPLE_COUNT = 6;
  const DEFAULT_BASE_NOISE = 1.5;
  const DEFAULT_WARMUP_STABILITY = 0.6;

  const ESCAPEMENT_PENALTY = 42;
  const OTHER_PENALTY = 34;
  const LENGTH_COEFF = -3;
  const MESH_COEFF = 2.2;

  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

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

  function generateTestSeed(input, jobKey, attemptIndex) {
    const inst = input.installed || {};
    const partsKey = Object.entries(inst)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}:${v || "null"}`)
      .join("|");
    const tuneKey = `l:${input.lengthTune || 0},m:${input.meshTune || 0}`;
    const raw = `${jobKey || "job"}|${partsKey}|${tuneKey}|${attemptIndex || 0}`;
    return hashString(raw);
  }

  function generateCommissionTrait(jobKey, partEffect) {
    const seed = hashString(`trait:${jobKey || "default"}`);
    const rand = seededRandom(seed);
    return {
      drift: (rand() - 0.5) * 4,
      volatility: 0.7 + rand() * 0.8,
      warmupBias: -1 + rand() * 2
    };
  }

  function generateSampleSequence(input, opts) {
    const options = opts || {};
    const {
      sampleCount = DEFAULT_SAMPLE_COUNT,
      baseNoise = DEFAULT_BASE_NOISE,
      jobKey = "default",
      attemptIndex = 0,
      partEffect,
      targetMax,
      tiers,
      warmupStability = DEFAULT_WARMUP_STABILITY
    } = options;

    const seed = generateTestSeed(input, jobKey, attemptIndex);
    const rand = seededRandom(seed);
    const trait = generateCommissionTrait(jobKey, partEffect);

    const raw = calcRawError(input);
    const baseError = raw.rawTotal + trait.drift;

    const samples = [];
    for (let i = 0; i < sampleCount; i++) {
      const progress = sampleCount > 1 ? i / (sampleCount - 1) : 0.5;
      const warmupFactor = warmupStability + (1 - warmupStability) * Math.min(1, progress * 1.5);
      const driftComponent = trait.warmupBias * (1 - progress) * 0.8;
      const noiseRange = baseNoise * trait.volatility * warmupFactor;
      const noise = (rand() - 0.5) * 2 * noiseRange;
      const value = baseError + driftComponent + noise;

      samples.push({
        index: i,
        value: Math.round(value * 10) / 10,
        abs: Math.abs(Math.round(value)),
        progress,
        warmupFactor: Math.round(warmupFactor * 100) / 100,
        noise: Math.round(noise * 10) / 10
      });
    }

    const values = samples.map(s => s.abs);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const firstHalf = values.slice(0, Math.ceil(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const trend = secondMean - firstMean;

    const finalAbs = Math.round(mean);
    const tier = getTier(finalAbs, tiers);
    const accepted = targetMax !== undefined ? isAccepted(finalAbs, targetMax) : null;
    const gap = targetMax !== undefined ? acceptanceGap(finalAbs, targetMax) : null;

    let trendDirection = "stable";
    if (trend > 1.5) trendDirection = "deteriorating";
    else if (trend < -1.5) trendDirection = "improving";

    return {
      ...raw,
      samples,
      sampleCount,
      baseNoise,
      trait,
      statistics: {
        mean: Math.round(mean * 10) / 10,
        stdDev: Math.round(stdDev * 10) / 10,
        min: Math.min(...values),
        max: Math.max(...values),
        range: Math.max(...values) - Math.min(...values),
        trend: Math.round(trend * 10) / 10,
        trendDirection
      },
      errorAbs: finalAbs,
      tier: tier.grade,
      tierDesc: tier.desc,
      accepted,
      gap,
      targetMax: targetMax !== undefined ? targetMax : null,
      seed
    };
  }

  function analyzeTrend(samples) {
    if (!samples || samples.length < 2) {
      return { direction: "stable", slope: 0, description: "数据不足" };
    }

    const n = samples.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    samples.forEach((s, i) => {
      const x = i;
      const y = s.abs;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    let direction = "stable";
    let description = "走时稳定";

    if (slope > 0.8) {
      direction = "deteriorating";
      description = "走时逐渐变慢，误差增大";
    } else if (slope > 0.3) {
      direction = "slightly-deteriorating";
      description = "走时略有变慢趋势";
    } else if (slope < -0.8) {
      direction = "improving";
      description = "走时逐渐变准，误差减小";
    } else if (slope < -0.3) {
      direction = "slightly-improving";
      description = "走时略有变好趋势";
    }

    return {
      slope: Math.round(slope * 100) / 100,
      direction,
      description
    };
  }

  return {
    CONSTANTS: {
      ESCAPEMENT_PENALTY,
      OTHER_PENALTY,
      LENGTH_COEFF,
      MESH_COEFF,
      DEFAULT_SAMPLE_COUNT,
      DEFAULT_BASE_NOISE,
      DEFAULT_WARMUP_STABILITY
    },
    DEFAULT_PART_EFFECT,
    DEFAULT_TIERS,
    seededRandom,
    hashString,
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
    evaluateTest,
    generateTestSeed,
    generateCommissionTrait,
    generateSampleSequence,
    analyzeTrend
  };
});
