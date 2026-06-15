window.Handler = {
  switchMode(mode) {
    const switched = JobStore.switchMode(mode);
    if (!switched) return;
    Renderer.fullWorkspace();
    Renderer.diagnosticTip(null);
    Renderer.testHistory();
    if (dom.manualOverlay.classList.contains("open")) ManualRenderer.refreshAll();
  },

  switchJob(index) {
    const switched = JobStore.switchJob(index);
    if (!switched) return;
    Renderer.fullWorkspace();
    Renderer.diagnosticTip(null);
    if (dom.manualOverlay.classList.contains("open")) ManualRenderer.refreshAll();
  },

  placePart(slot, value) {
    const result = JobStore.placePart(slot, value);
    if (!result.success) {
      if (result.reason === "out_of_stock") {
        Renderer.diagnosticTip({ type: "error", text: "该零件库存不足，请选择其他零件或更换已装配的零件。" });
      }
      return;
    }

    JobStore.lastTestConfigHash = null;
    JobStore.testAttemptCount = 0;

    Renderer.slots();
    Renderer.diagnosticTip(null);
    Renderer.resetTestDisplay();
    const socket = $(`[data-slot="${slot}"]`);
    socket.classList.add("filled");
    socket.querySelector("span").textContent = JobData.getPartName(slot, value);
    Renderer.triggerReplaceFeedback(slot, result.oldName, result.isReplace);

    if (JobStore.mode === "daily") {
      Renderer.inventory();
      Renderer.partButtons();
      if (result.partKey) {
        Renderer.highlightInventory(result.partKey);
      }
    }

    if (dom.manualOverlay.classList.contains("open")) ManualRenderer.refreshAll();
  },

  startTest() {
    if (JobStore.isTesting) return;
    if (JobStore.testTimer) {
      clearInterval(JobStore.testTimer);
      JobStore.testTimer = null;
    }

    const testResult = JobStore.startTestPhase();
    const totalSamples = testResult.samples.length;

    Renderer.testingControls(true);
    Renderer.testingProgress();
    Renderer.trendChart(testResult.samples, testResult.targetMax, 0);
    document.body.classList.add("testing");

    let sampleIndex = 0;
    let pulses = 0;

    JobStore.testTimer = setInterval(() => {
      pulses += 1;
      Renderer.animateHands(pulses);

      if (pulses % 2 === 0 && sampleIndex < totalSamples) {
        const sample = JobStore.advanceSample();
        if (sample) {
          Renderer.updateLiveSample(sample, sampleIndex, totalSamples);
          sampleIndex += 1;
        }
      }

      if (sampleIndex >= totalSamples && pulses >= totalSamples * 2 + 2) {
        clearInterval(JobStore.testTimer);
        JobStore.testTimer = null;
        document.body.classList.remove("testing");

        const record = JobStore.completeTest();

        if (record) {
          Renderer.showTestResult({
            ...record,
            samples: record.samples,
            statistics: record.statistics
          });

          Renderer.testHistory();

          if (JobStore.mode === "daily") {
            Renderer.challengeJobs();
            Renderer.challengeScore();
            Renderer.inventory();
            Renderer.partButtons();
          } else {
            Renderer.jobList();
          }
        }

        Renderer.testingControls(false);
      }
    }, JobData.TEST_CONFIG.sampleInterval / 2);
  },

  tuneInput() {
    JobStore.lengthTune = Number(dom.lengthTune.value);
    JobStore.meshTune = Number(dom.meshTune.value);
    JobStore.lastTestConfigHash = null;
    JobStore.testAttemptCount = 0;
    Renderer.testAttemptInfo();
    if (dom.manualOverlay.classList.contains("open")) ManualRenderer.renderCalcPanel();
  },

  runDiagnostics() {
    if (JobStore.isTesting) return;
    const tip = Diagnostics.analyze();
    Renderer.diagnosticTip(tip);
  }
};

function bindModeEvents() {
  dom.modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      Handler.switchMode(btn.dataset.mode);
    });
  });
}

function bindChallengeJobEvents() {
  dom.challengeJobs.addEventListener("click", (e) => {
    if (JobStore.mode !== "daily") return;
    const item = e.target.closest(".challenge-job-item");
    if (!item) return;
    if (item.classList.contains("locked")) return;
    if (item.classList.contains("is-disabled")) return;

    const idx = Number(item.dataset.challengeIndex);
    Handler.switchJob(idx);
  });

  dom.challengeJobs.addEventListener("keydown", (e) => {
    if (JobStore.mode !== "daily") return;
    const item = e.target.closest(".challenge-job-item");
    if (!item) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (item.classList.contains("locked")) return;
      const idx = Number(item.dataset.challengeIndex);
      Handler.switchJob(idx);
    }
  });
}

function bindJobListEvents() {
  dom.jobList.addEventListener("click", (e) => {
    if (JobStore.mode !== "free") return;
    const item = e.target.closest(".job-list-item");
    if (!item) return;
    if (item.classList.contains("is-disabled")) return;
    const idx = Number(item.dataset.jobIndex);
    Handler.switchJob(idx);
  });

  dom.jobList.addEventListener("keydown", (e) => {
    if (JobStore.mode !== "free") return;
    const item = e.target.closest(".job-list-item");
    if (!item) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const idx = Number(item.dataset.jobIndex);
      Handler.switchJob(idx);
    }
  });
}

function bindPartEvents() {
  dom.partButtons.forEach((button) => {
    button.addEventListener("dragstart", (event) => {
      if (JobStore.isTesting) {
        event.preventDefault();
        return;
      }
      const partKey = button.dataset.part;
      if (JobStore.mode === "daily" && JobStore.getPartStock(partKey) <= 0) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData("text/plain", button.dataset.part);
    });

    button.addEventListener("click", () => {
      if (JobStore.isTesting) return;
      const [slot, value] = button.dataset.part.split(":");
      Handler.placePart(slot, value);
    });
  });
}

function bindSocketEvents() {
  dom.sockets.forEach((socket) => {
    socket.addEventListener("dragover", (event) => {
      if (JobStore.isTesting) return;
      event.preventDefault();
      socket.classList.add("over");
    });
    socket.addEventListener("dragleave", () => socket.classList.remove("over"));
    socket.addEventListener("drop", (event) => {
      if (JobStore.isTesting) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      socket.classList.remove("over");
      const [slot, value] = event.dataTransfer.getData("text/plain").split(":");
      if (slot === socket.dataset.slot) Handler.placePart(slot, value);
    });
  });
}

function bindTestEvent() {
  dom.testBtn.addEventListener("click", () => Handler.startTest());
}

function bindDiagnoseEvent() {
  dom.diagnoseBtn.addEventListener("click", () => Handler.runDiagnostics());
}

function bindTuneEvents() {
  [dom.lengthTune, dom.meshTune].forEach((input) =>
    input.addEventListener("input", () => Handler.tuneInput())
  );
}

function bindManualEvents() {
  $("#manualBtn").addEventListener("click", () => {
    ManualRenderer.refreshAll();
    ManualRenderer.switchTab("advice");
    dom.manualOverlay.classList.add("open");
    dom.manualOverlay.setAttribute("aria-hidden", "false");
  });

  $("#manualClose").addEventListener("click", () => {
    dom.manualOverlay.classList.remove("open");
    dom.manualOverlay.setAttribute("aria-hidden", "true");
  });

  dom.manualOverlay.addEventListener("click", (e) => {
    if (e.target === dom.manualOverlay) {
      dom.manualOverlay.classList.remove("open");
      dom.manualOverlay.setAttribute("aria-hidden", "true");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dom.manualOverlay.classList.contains("open")) {
      dom.manualOverlay.classList.remove("open");
      dom.manualOverlay.setAttribute("aria-hidden", "true");
    }
  });

  $$(".manual-tab").forEach((btn) => {
    btn.addEventListener("click", () => ManualRenderer.switchTab(btn.dataset.tab));
  });
}

window.bindEvents = function () {
  bindModeEvents();
  bindChallengeJobEvents();
  bindJobListEvents();
  bindPartEvents();
  bindSocketEvents();
  bindTestEvent();
  bindDiagnoseEvent();
  bindTuneEvents();
  bindManualEvents();
};
