window.Handler = {
  switchJob(index) {
    const switched = JobStore.switchJob(index);
    if (!switched) return;
    Renderer.fullWorkspace();
    Renderer.diagnosticTip(null);
    if (dom.manualOverlay.classList.contains("open")) ManualRenderer.refreshAll();
  },

  placePart(slot, value) {
    const result = JobStore.placePart(slot, value);
    if (!result.success) return;
    Renderer.slots();
    Renderer.diagnosticTip(null);
    const socket = $(`[data-slot="${slot}"]`);
    socket.classList.add("filled");
    socket.querySelector("span").textContent = JobData.getPartName(slot, value);
    Renderer.triggerReplaceFeedback(slot, result.oldName, result.isReplace);
    if (dom.manualOverlay.classList.contains("open")) ManualRenderer.refreshAll();
  },

  startTest() {
    if (JobStore.isTesting) return;
    if (JobStore.testTimer) clearInterval(JobStore.testTimer);

    const testSnapshot = JobStore.snapshot();

    Renderer.testingControls(true);
    Renderer.testingProgress();
    document.body.classList.add("testing");

    let pulses = 0;

    JobStore.testTimer = setInterval(() => {
      pulses += 1;
      Renderer.animateHands(pulses);
      if (pulses >= 9) {
        clearInterval(JobStore.testTimer);
        JobStore.testTimer = null;
        document.body.classList.remove("testing");

        const abs = JobStore.calcError(testSnapshot);
        const tier = JobData.getTier(abs);
        const score = tier.grade;

        const job = JobData.JOBS[testSnapshot.jobIndex];
        const targetMax = job.acceptance.maxError;
        const accepted = abs <= targetMax;
        const gap = abs - targetMax;

        Renderer.readouts(abs, score, { accepted, gap, targetMax });

        const record = {
          jobName: job.name,
          parts: { ...testSnapshot.installed },
          lengthTune: testSnapshot.lengthTune,
          meshTune: testSnapshot.meshTune,
          error: abs,
          score: score,
          jobIndex: testSnapshot.jobIndex,
          timestamp: Date.now(),
          accepted: accepted,
          gap: gap,
          targetMax: targetMax
        };
        JobStore.addTestRecord(record);

        Renderer.testHistory();
        Renderer.jobList();
        Renderer.testingControls(false);
      }
    }, 180);
  },

  tuneInput() {
    JobStore.lengthTune = Number(dom.lengthTune.value);
    JobStore.meshTune = Number(dom.meshTune.value);
    if (dom.manualOverlay.classList.contains("open")) ManualRenderer.renderCalcPanel();
  },

  runDiagnostics() {
    if (JobStore.isTesting) return;
    const tip = Diagnostics.analyze();
    Renderer.diagnosticTip(tip);
  }
};

function bindJobListEvents() {
  dom.jobList.addEventListener("click", (e) => {
    const item = e.target.closest(".job-list-item");
    if (!item) return;
    if (item.classList.contains("is-disabled")) return;
    const idx = Number(item.dataset.jobIndex);
    Handler.switchJob(idx);
  });

  dom.jobList.addEventListener("keydown", (e) => {
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
  bindJobListEvents();
  bindPartEvents();
  bindSocketEvents();
  bindTestEvent();
  bindDiagnoseEvent();
  bindTuneEvents();
  bindManualEvents();
};
