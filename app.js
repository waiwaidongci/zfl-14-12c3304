function init() {
  JobStore.init();
  bindEvents();

  if (JobStore.mode === "daily") {
    JobStore.ensureDailyChallenge();
  }

  Renderer.fullWorkspace();
  Renderer.testHistory();
}

init();
