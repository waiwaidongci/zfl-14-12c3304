window.JobData = {
  JOBS: [
    {
      name: "旧海军舱钟",
      fault: "快走明显，发条输出不稳，摆轮偏短。",
      acceptance: { maxError: 18, unit: "秒/日" },
      target: { gear: "balanced", spring: "steady", escapement: "clean", pendulum: "long" }
    },
    {
      name: "剧院后台挂钟",
      fault: "慢走且齿轮磨损，擒纵需要清洁。",
      acceptance: { maxError: 22, unit: "秒/日" },
      target: { gear: "fast", spring: "steady", escapement: "clean", pendulum: "short" }
    },
    {
      name: "旅行黄铜闹钟",
      fault: "运输后发条偏松，摆轮过长，齿轮需要更高传动比。",
      acceptance: { maxError: 20, unit: "秒/日" },
      target: { gear: "fast", spring: "tight", escapement: "clean", pendulum: "short" }
    }
  ],

  PART_NAMES: {
    "gear:balanced": "均衡齿轮",
    "gear:fast": "高速齿轮",
    "spring:steady": "稳压发条",
    "spring:tight": "紧绷发条",
    "escapement:clean": "清洁擒纵",
    "escapement:worn": "旧擒纵",
    "pendulum:short": "短摆轮",
    "pendulum:long": "长摆轮"
  },

  PART_EFFECT: {
    gear: { balanced: 0, fast: 18 },
    spring: { steady: -4, tight: 12 },
    escapement: { clean: 0, worn: -28 },
    pendulum: { short: 20, long: -16 }
  },

  SLOT_LABELS: { gear: "齿轮", spring: "发条", escapement: "擒纵", pendulum: "摆轮" },
  SLOT_DEFAULT_LABELS: { gear: "齿轮", spring: "发条", escapement: "擒纵", pendulum: "摆轮" },

  TIERS: [
    { grade: "S", max: 12, desc: "大师级精度" },
    { grade: "A", max: 22, desc: "优秀走时" },
    { grade: "B", max: 38, desc: "合格水准" },
    { grade: "C", max: 58, desc: "勉强可用" },
    { grade: "D", max: Infinity, desc: "需要返工" }
  ],

  MAX_HISTORY: 5,

  getTier(error) {
    const abs = Math.abs(error);
    for (const t of JobData.TIERS) {
      if (abs <= t.max) return t;
    }
    return JobData.TIERS[JobData.TIERS.length - 1];
  },

  getPartName(slot, variant) {
    return JobData.PART_NAMES[`${slot}:${variant}`] || "—";
  }
};
