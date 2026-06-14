window.JobStore = {
  mode: "free",
  currentJobIndex: 0,
  installed: { gear: null, spring: null, escapement: null, pendulum: null },
  lengthTune: 0,
  meshTune: 0,
  isTesting: false,
  testTimer: null,
  freeHistory: [],
  challengeHistory: [],
  feedbackTimers: {},
  jobBest: [],

  dailyChallenge: null,
  inventory: {},
  currentChallengeJobIndex: 0,
  challengeJobResults: [],

  STORAGE_KEYS: {
    MODE: "clockmaker_mode",
    CHALLENGE: "clockmaker_daily_challenge",
    INVENTORY: "clockmaker_inventory",
    CHALLENGE_INDEX: "clockmaker_challenge_index",
    CHALLENGE_RESULTS: "clockmaker_challenge_results",
    CHALLENGE_HISTORY: "clockmaker_challenge_history",
    FREE_BEST: "clockmaker_free_best",
    FREE_HISTORY: "clockmaker_free_history"
  },

  init() {
    JobStore.jobBest = JobData.JOBS.map(() => ({ score: null, error: null }));
    JobStore.loadFromStorage();
  },

  loadFromStorage() {
    try {
      const savedMode = localStorage.getItem(JobStore.STORAGE_KEYS.MODE);
      if (savedMode) {
        JobStore.mode = savedMode;
      }

      const today = JobData.getDateString();
      const savedChallenge = localStorage.getItem(JobStore.STORAGE_KEYS.CHALLENGE);

      if (savedChallenge) {
        const parsed = JSON.parse(savedChallenge);
        if (parsed.date === today) {
          JobStore.dailyChallenge = parsed;
          const savedInventory = localStorage.getItem(JobStore.STORAGE_KEYS.INVENTORY);
          if (savedInventory) {
            JobStore.inventory = JSON.parse(savedInventory);
          }
          const savedIndex = localStorage.getItem(JobStore.STORAGE_KEYS.CHALLENGE_INDEX);
          if (savedIndex !== null) {
            JobStore.currentChallengeJobIndex = parseInt(savedIndex, 10);
          }
          const savedResults = localStorage.getItem(JobStore.STORAGE_KEYS.CHALLENGE_RESULTS);
          if (savedResults) {
            JobStore.challengeJobResults = JSON.parse(savedResults);
          }
          const savedChallengeHistory = localStorage.getItem(JobStore.STORAGE_KEYS.CHALLENGE_HISTORY);
          if (savedChallengeHistory) {
            JobStore.challengeHistory = JSON.parse(savedChallengeHistory);
          }
        } else {
          JobStore.resetDailyChallenge();
        }
      }

      const savedFreeBest = localStorage.getItem(JobStore.STORAGE_KEYS.FREE_BEST);
      if (savedFreeBest) {
        JobStore.jobBest = JSON.parse(savedFreeBest);
      }

      const savedFreeHistory = localStorage.getItem(JobStore.STORAGE_KEYS.FREE_HISTORY);
      if (savedFreeHistory) {
        JobStore.freeHistory = JSON.parse(savedFreeHistory);
      }
    } catch (e) {
      console.warn("Failed to load from storage:", e);
    }
  },

  saveToStorage() {
    try {
      localStorage.setItem(JobStore.STORAGE_KEYS.MODE, JobStore.mode);

      if (JobStore.dailyChallenge) {
        localStorage.setItem(JobStore.STORAGE_KEYS.CHALLENGE, JSON.stringify(JobStore.dailyChallenge));
        localStorage.setItem(JobStore.STORAGE_KEYS.INVENTORY, JSON.stringify(JobStore.inventory));
        localStorage.setItem(JobStore.STORAGE_KEYS.CHALLENGE_INDEX, String(JobStore.currentChallengeJobIndex));
        localStorage.setItem(JobStore.STORAGE_KEYS.CHALLENGE_RESULTS, JSON.stringify(JobStore.challengeJobResults));
        localStorage.setItem(JobStore.STORAGE_KEYS.CHALLENGE_HISTORY, JSON.stringify(JobStore.challengeHistory));
      }

      localStorage.setItem(JobStore.STORAGE_KEYS.FREE_BEST, JSON.stringify(JobStore.jobBest));
      localStorage.setItem(JobStore.STORAGE_KEYS.FREE_HISTORY, JSON.stringify(JobStore.freeHistory));
    } catch (e) {
      console.warn("Failed to save to storage:", e);
    }
  },

  resetDailyChallenge() {
    const today = JobData.getDateString();
    const savedChallenge = localStorage.getItem(JobStore.STORAGE_KEYS.CHALLENGE);

    if (savedChallenge) {
      const parsed = JSON.parse(savedChallenge);
      if (parsed.date === today) {
        JobStore.dailyChallenge = parsed;
        JobStore.inventory = { ...parsed.initialInventory };
        JobStore.currentChallengeJobIndex = 0;
        JobStore.challengeJobResults = [];
        JobStore.challengeHistory = [];
        JobStore.saveToStorage();
        return;
      }
    }

    JobStore.dailyChallenge = JobData.generateDailyChallenge();
    JobStore.inventory = { ...JobStore.dailyChallenge.initialInventory };
    JobStore.currentChallengeJobIndex = 0;
    JobStore.challengeJobResults = [];
    JobStore.challengeHistory = [];
    JobStore.saveToStorage();
  },

  ensureDailyChallenge() {
    const today = JobData.getDateString();
    if (!JobStore.dailyChallenge || JobStore.dailyChallenge.date !== today) {
      JobStore.resetDailyChallenge();
    }
  },

  switchMode(mode) {
    if (JobStore.isTesting) return false;
    if (JobStore.mode === mode) return false;

    JobStore.mode = mode;

    if (mode === "daily") {
      JobStore.ensureDailyChallenge();
      JobStore.currentJobIndex = 0;
    } else {
      JobStore.currentJobIndex = 0;
    }

    JobStore.resetWorkspace();
    JobStore.saveToStorage();
    return true;
  },

  getCurrentJob() {
    if (JobStore.mode === "daily" && JobStore.dailyChallenge) {
      return JobStore.dailyChallenge.jobs[JobStore.currentChallengeJobIndex];
    }
    return JobData.JOBS[JobStore.currentJobIndex];
  },

  getJobList() {
    if (JobStore.mode === "daily" && JobStore.dailyChallenge) {
      return JobStore.dailyChallenge.jobs;
    }
    return JobData.JOBS;
  },

  resetWorkspace() {
    JobStore.installed = { gear: null, spring: null, escapement: null, pendulum: null };
    JobStore.lengthTune = 0;
    JobStore.meshTune = 0;
    Object.values(JobStore.feedbackTimers).forEach(clearTimeout);
    JobStore.feedbackTimers = {};
  },

  switchJob(index) {
    if (JobStore.isTesting) return false;
    if (JobStore.mode === "daily") {
      if (index === JobStore.currentChallengeJobIndex) return false;
      if (index > JobStore.currentChallengeJobIndex + 1) return false;
      if (index < JobStore.currentChallengeJobIndex && !JobStore.challengeJobResults[index]) return false;

      if (index > JobStore.currentChallengeJobIndex) {
        const prevResult = JobStore.challengeJobResults[JobStore.currentChallengeJobIndex];
        if (!prevResult || !prevResult.accepted) {
          return false;
        }
      }

      JobStore.currentChallengeJobIndex = index;
      JobStore.saveToStorage();
    } else {
      if (index === JobStore.currentJobIndex) return false;
      JobStore.currentJobIndex = index;
    }

    JobStore.resetWorkspace();
    return true;
  },

  placePart(slot, value) {
    if (JobStore.isTesting) return { success: false };

    const partKey = `${slot}:${value}`;

    if (JobStore.mode === "daily") {
      if (!JobStore.inventory[partKey] || JobStore.inventory[partKey] <= 0) {
        return { success: false, reason: "out_of_stock" };
      }
    }

    const oldValue = JobStore.installed[slot];
    if (oldValue === value) return { success: false };

    if (JobStore.mode === "daily") {
      JobStore.inventory[partKey] -= 1;

      if (oldValue) {
        const oldPartKey = `${slot}:${oldValue}`;
        JobStore.inventory[oldPartKey] = (JobStore.inventory[oldPartKey] || 0) + 1;
      }

      JobStore.saveToStorage();
    }

    const isReplace = oldValue !== null;
    const oldName = isReplace ? JobData.getPartName(slot, oldValue) : null;
    JobStore.installed[slot] = value;
    return { success: true, isReplace, oldName, slot, partKey };
  },

  snapshot() {
    return {
      installed: { ...JobStore.installed },
      lengthTune: JobStore.lengthTune,
      meshTune: JobStore.meshTune,
      jobIndex: JobStore.mode === "daily" ? JobStore.currentChallengeJobIndex : JobStore.currentJobIndex
    };
  },

  calcError(snapshot) {
    const snap = snapshot || JobStore.snapshot();
    const jobs = JobStore.getJobList();
    const job = jobs[snap.jobIndex];
    const jitter = Math.round((Math.random() - 0.5) * 5);
    const result = CalcEngine.calcWithJitter({
      installed: snap.installed,
      target: job.target,
      lengthTune: snap.lengthTune,
      meshTune: snap.meshTune,
      partEffect: JobData.PART_EFFECT
    }, jitter);
    return result.finalAbs;
  },

  calcTheoreticalError(snapshot) {
    const snap = snapshot || JobStore.snapshot();
    const jobs = JobStore.getJobList();
    const job = jobs[snap.jobIndex];
    const result = CalcEngine.calcTheoretical({
      installed: snap.installed,
      target: job.target,
      lengthTune: snap.lengthTune,
      meshTune: snap.meshTune,
      partEffect: JobData.PART_EFFECT
    });
    return result.rawTotal;
  },

  addTestRecord(record) {
    if (JobStore.mode === "daily") {
      JobStore.challengeHistory.unshift(record);
      if (JobStore.challengeHistory.length > JobData.MAX_HISTORY) {
        JobStore.challengeHistory.pop();
      }
    } else {
      JobStore.freeHistory.unshift(record);
      if (JobStore.freeHistory.length > JobData.MAX_HISTORY) {
        JobStore.freeHistory.pop();
      }
    }

    if (JobStore.mode === "daily") {
      JobStore.challengeJobResults[JobStore.currentChallengeJobIndex] = {
        score: record.score,
        error: record.error,
        accepted: record.accepted,
        gap: record.gap,
        targetMax: record.targetMax,
        parts: record.parts,
        lengthTune: record.lengthTune,
        meshTune: record.meshTune,
        timestamp: record.timestamp
      };
    } else {
      const best = JobStore.jobBest[record.jobIndex];
      if (!best.score || record.error < best.error) {
        JobStore.jobBest[record.jobIndex] = {
          score: record.score,
          error: record.error,
          accepted: record.accepted,
          gap: record.gap,
          targetMax: record.targetMax
        };
      }
    }

    JobStore.saveToStorage();
  },

  getTestHistory() {
    if (JobStore.mode === "daily") {
      return JobStore.challengeHistory;
    }
    return JobStore.freeHistory;
  },

  getChallengeTotalScore() {
    let total = 0;
    JobStore.challengeJobResults.forEach(result => {
      if (result && result.score) {
        total += JobData.getScoreValue(result.score);
      }
    });
    return total;
  },

  isChallengeComplete() {
    if (!JobStore.dailyChallenge) return false;
    return JobStore.challengeJobResults.filter(r => r && r.accepted).length === JobStore.dailyChallenge.jobs.length;
  },

  canStartChallengeJob(index) {
    if (!JobStore.dailyChallenge) return false;
    if (index === 0) return true;
    const prevResult = JobStore.challengeJobResults[index - 1];
    return prevResult && prevResult.accepted;
  },

  getPartStock(partKey) {
    if (JobStore.mode !== "daily") return Infinity;
    return JobStore.inventory[partKey] || 0;
  },

  getJobBest(index) {
    if (JobStore.mode === "daily") {
      return JobStore.challengeJobResults[index] || { score: null, error: null };
    }
    return JobStore.jobBest[index] || { score: null, error: null };
  }
};
