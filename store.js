window.JobStore = {
  currentJobIndex: 0,
  installed: { gear: null, spring: null, escapement: null, pendulum: null },
  lengthTune: 0,
  meshTune: 0,
  isTesting: false,
  testTimer: null,
  testHistory: [],
  feedbackTimers: {},
  jobBest: [],

  init() {
    JobStore.jobBest = JobData.JOBS.map(() => ({ score: null, error: null }));
  },

  getCurrentJob() {
    return JobData.JOBS[JobStore.currentJobIndex];
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
    if (index === JobStore.currentJobIndex) return false;
    JobStore.currentJobIndex = index;
    JobStore.resetWorkspace();
    return true;
  },

  placePart(slot, value) {
    if (JobStore.isTesting) return { success: false };
    const oldValue = JobStore.installed[slot];
    if (oldValue === value) return { success: false };
    const isReplace = oldValue !== null;
    const oldName = isReplace ? JobData.getPartName(slot, oldValue) : null;
    JobStore.installed[slot] = value;
    return { success: true, isReplace, oldName, slot };
  },

  snapshot() {
    return {
      installed: { ...JobStore.installed },
      lengthTune: JobStore.lengthTune,
      meshTune: JobStore.meshTune,
      jobIndex: JobStore.currentJobIndex
    };
  },

  calcError(snapshot) {
    const snap = snapshot || JobStore.snapshot();
    const job = JobData.JOBS[snap.jobIndex];
    let error = 0;
    Object.entries(job.target).forEach(([slot, wanted]) => {
      const value = snap.installed[slot];
      if (!value) error += slot === "escapement" ? 42 : 34;
      else error += Math.abs(JobData.PART_EFFECT[slot][value] - JobData.PART_EFFECT[slot][wanted]);
    });
    error += snap.lengthTune * -3;
    error += snap.meshTune * 2.2;
    error += Math.round((Math.random() - 0.5) * 5);
    return Math.abs(Math.round(error));
  },

  addTestRecord(record) {
    JobStore.testHistory.unshift(record);
    if (JobStore.testHistory.length > JobData.MAX_HISTORY) {
      JobStore.testHistory.pop();
    }
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
};
