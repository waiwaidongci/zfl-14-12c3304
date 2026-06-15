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

  TEST_CONFIG: {
    sampleCount: 6,
    baseNoise: 1.5,
    warmupStability: 0.6,
    sampleInterval: 380,
    maxAttemptsPerConfig: 3
  },

  TREND_DIRECTIONS: {
    improving: { label: "误差减小", icon: "↘", color: "#4a7c59" },
    "slightly-improving": { label: "略有改善", icon: "↘", color: "#6b8e6b" },
    stable: { label: "走时稳定", icon: "→", color: "#6f6259" },
    "slightly-deteriorating": { label: "略有变差", icon: "↗", color: "#b8860b" },
    deteriorating: { label: "误差增大", icon: "↗", color: "#9f4545" }
  },

  CHALLENGE_JOBS_POOL: [
    { name: "古董座钟", fault: "年代久远走时不准，齿轮磨损严重。" },
    { name: "天文台怀表", fault: "精密计时出现偏差，需要专业调校。" },
    { name: "车站大厅钟", fault: "大型钟表现误差偏大，影响旅客出行。" },
    { name: "教堂塔钟", fault: "报时不准，发条张力不足。" },
    { name: "帆船航海钟", fault: "海上颠簸后走时不稳，擒纵机构需要检查。" },
    { name: "校长办公室挂钟", fault: "慢走明显，影响师生作息。" },
    { name: "火车站调度钟", fault: "快走严重，可能导致调度失误。" },
    { name: "博物馆藏品钟", fault: "珍贵藏品需要精细修复。" },
    { name: "祖父落地钟", fault: "家族传承老钟，摆轮摆动不稳。" },
    { name: "车站问询处钟", fault: "旅客经常核对时间，必须准确。" },
    { name: "修道院报时钟", fault: "影响祷告时间，急需修理。" },
    { name: "珠宝店橱窗钟", fault: "展示用钟，走时必须精准。" }
  ],

  ACCEPTANCE_TIERS: [
    { maxError: 15, unit: "秒/日", difficulty: "严格" },
    { maxError: 20, unit: "秒/日", difficulty: "标准" },
    { maxError: 25, unit: "秒/日", difficulty: "宽松" }
  ],

  ALL_PARTS: [
    "gear:balanced", "gear:fast",
    "spring:steady", "spring:tight",
    "escapement:clean", "escapement:worn",
    "pendulum:short", "pendulum:long"
  ],

  SLOTS: ["gear", "spring", "escapement", "pendulum"],
  SLOT_VARIANTS: {
    gear: ["balanced", "fast"],
    spring: ["steady", "tight"],
    escapement: ["clean", "worn"],
    pendulum: ["short", "long"]
  },

  INVENTORY_MIN: 1,
  INVENTORY_MAX: 3,
  CHALLENGE_JOB_COUNT: 3,

  getTier(error) {
    const abs = Math.abs(error);
    for (const t of JobData.TIERS) {
      if (abs <= t.max) return t;
    }
    return JobData.TIERS[JobData.TIERS.length - 1];
  },

  getPartName(slot, variant) {
    return JobData.PART_NAMES[`${slot}:${variant}`] || "—";
  },

  getPartFullName(partKey) {
    return JobData.PART_NAMES[partKey] || "—";
  },

  seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  },

  getDateString(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  },

  shuffleArray(array, random) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },

  generateChallengeJobs(seed) {
    const random = JobData.seededRandom(seed);
    const shuffledJobs = JobData.shuffleArray(JobData.CHALLENGE_JOBS_POOL, random);
    const jobs = [];

    for (let i = 0; i < JobData.CHALLENGE_JOB_COUNT; i++) {
      const jobTemplate = shuffledJobs[i % shuffledJobs.length];
      const target = {};

      JobData.SLOTS.forEach(slot => {
        const variants = JobData.SLOT_VARIANTS[slot];
        target[slot] = variants[Math.floor(random() * variants.length)];
      });

      const difficultyMultiplier = 0.8 + (i * 0.2);
      const baseError = JobData.ACCEPTANCE_TIERS[Math.min(i, JobData.ACCEPTANCE_TIERS.length - 1)].maxError;
      const maxError = Math.round(baseError * difficultyMultiplier);

      jobs.push({
        name: jobTemplate.name,
        fault: jobTemplate.fault,
        acceptance: { maxError, unit: "秒/日" },
        target,
        index: i
      });
    }

    return jobs;
  },

  generateInventory(seed) {
    const random = JobData.seededRandom(seed + 12345);
    const inventory = {};

    JobData.ALL_PARTS.forEach(part => {
      const count = JobData.INVENTORY_MIN + Math.floor(random() * (JobData.INVENTORY_MAX - JobData.INVENTORY_MIN + 1));
      inventory[part] = count;
    });

    return inventory;
  },

  generateDailyChallenge(date) {
    const dateStr = JobData.getDateString(date);
    const seed = JobData.hashString(dateStr);

    return {
      date: dateStr,
      seed,
      jobs: JobData.generateChallengeJobs(seed),
      initialInventory: JobData.generateInventory(seed)
    };
  },

  getScoreValue(grade) {
    const scores = { S: 100, A: 80, B: 60, C: 40, D: 20 };
    return scores[grade] || 0;
  }
};
