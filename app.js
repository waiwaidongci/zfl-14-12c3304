function init() {
  JobStore.init();
  bindEvents();

  Renderer.fullWorkspace();
  Renderer.testHistory();
}

init();
