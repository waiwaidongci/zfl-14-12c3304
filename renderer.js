window.Renderer = {
  jobList() {
    dom.jobList.innerHTML = JobData.JOBS.map((job, index) => {
      const isActive = index === JobStore.currentJobIndex;
      const best = JobStore.jobBest[index];
      const accepted = best.score && best.error <= job.acceptance.maxError;
      const statusText = best.score
        ? accepted
          ? `已完成 · ${best.score}（${best.error}秒/日）`
          : `最佳：${best.score}（${best.error}秒/日）`
        : "未测试";
      const statusClass = best.score
        ? accepted
          ? "job-status-completed"
          : "job-status-done"
        : "job-status-idle";
      return `
        <li class="job-list-item${isActive ? " active" : ""}" data-job-index="${index}" role="button" tabindex="0" aria-label="选择委托：${job.name}">
          <span class="job-list-item-name">${job.name}</span>
          <span class="job-list-item-fault">${job.fault}</span>
          <span class="job-list-item-target">验收目标：≤${job.acceptance.maxError}${job.acceptance.unit}</span>
          <span class="job-list-item-status ${statusClass}">${statusText}</span>
          <button class="job-list-item-start" ${isActive ? 'disabled' : ''}>${isActive ? "修理中" : "开始修理"}</button>
        </li>
      `;
    }).join("");
  },

  currentJob() {
    const job = JobStore.getCurrentJob();
    dom.jobName.textContent = job.name;
    dom.jobFault.textContent = job.fault;
    dom.jobAcceptanceValue.textContent = `≤${job.acceptance.maxError}${job.acceptance.unit}`;
  },

  slots() {
    Object.entries(JobStore.installed).forEach(([slot, part]) => {
      const span = $(`#${slot}Slot`);
      span.textContent = part ? JobData.getPartName(slot, part) : "空";
    });
    const swing = JobStore.installed.pendulum === "short" ? 0.95 : JobStore.installed.pendulum === "long" ? 1.8 : 1.3;
    dom.pendulum.style.animationDuration = `${swing}s`;
  },

  clockSockets() {
    dom.sockets.forEach((socket) => {
      const slot = socket.dataset.slot;
      const part = JobStore.installed[slot];
      if (part) {
        socket.classList.add("filled");
        socket.querySelector("span").textContent = JobData.getPartName(slot, part);
      } else {
        socket.classList.remove("filled", "over", "flash-in", "replacing");
        socket.querySelector("span").textContent = JobData.SLOT_DEFAULT_LABELS[slot] || slot;
      }
      socket.classList.remove("flash-in", "replacing");
      const badge = socket.querySelector(".socket-replace-badge");
      if (badge) badge.classList.remove("show");
    });
    const slotRow = $$(".installed [data-slot-row]");
    slotRow.forEach((row) => {
      row.classList.remove("flash-in", "replacing");
      const badge = row.querySelector(".replace-badge");
      if (badge) badge.classList.remove("show");
    });
  },

  readouts(error, score, acceptance) {
    if (error === undefined || score === undefined) {
      dom.errorReadout.textContent = "--";
      dom.scoreReadout.textContent = "--";
      const statusEl = $("#acceptanceStatus");
      if (statusEl) statusEl.remove();
    } else {
      dom.errorReadout.textContent = `${error}秒/日`;
      dom.scoreReadout.textContent = score;

      let statusEl = $("#acceptanceStatus");
      if (!statusEl) {
        statusEl = document.createElement("div");
        statusEl.id = "acceptanceStatus";
        dom.errorReadout.parentElement.parentElement.appendChild(statusEl);
      }

      if (acceptance) {
        const { accepted, gap, targetMax } = acceptance;
        statusEl.className = `acceptance-status ${accepted ? "accepted" : "rejected"}`;
        if (accepted) {
          statusEl.innerHTML = `<span class="status-icon">✓</span><span class="status-text">验收通过 · 误差≤${targetMax}秒/日</span>`;
        } else {
          statusEl.innerHTML = `<span class="status-icon">✗</span><span class="status-text">未达成目标 · 还差 ${gap} 秒/日</span>`;
        }
      }
    }
  },

  tuningControls() {
    dom.lengthTune.value = JobStore.lengthTune;
    dom.meshTune.value = JobStore.meshTune;
  },

  testHistory() {
    if (JobStore.testHistory.length === 0) {
      dom.historyList.innerHTML = '<li class="history-empty">暂无测试记录</li>';
      return;
    }

    dom.historyList.innerHTML = JobStore.testHistory.map((record, index) => {
      const gearName = record.parts.gear ? JobData.getPartName("gear", record.parts.gear) : "—";
      const springName = record.parts.spring ? JobData.getPartName("spring", record.parts.spring) : "—";
      const escapementName = record.parts.escapement ? JobData.getPartName("escapement", record.parts.escapement) : "—";
      const pendulumName = record.parts.pendulum ? JobData.getPartName("pendulum", record.parts.pendulum) : "—";

      const acceptedClass = record.accepted ? "history-accepted" : "history-rejected";
      const acceptedIcon = record.accepted ? "✓" : "✗";
      const acceptedText = record.accepted
        ? `验收通过 · ≤${record.targetMax}秒/日`
        : `未通过 · 还差 ${record.gap} 秒/日`;

      return `
        <li class="history-item ${acceptedClass}" style="animation-delay: ${index * 0.05}s">
          <div class="history-job">
            <span class="history-job-name">${record.jobName}</span>
            <span class="history-score score-${record.score.toLowerCase()}">${record.score}</span>
          </div>
          <div class="history-acceptance">
            <span class="history-acceptance-icon">${acceptedIcon}</span>
            <span class="history-acceptance-text">${acceptedText}</span>
          </div>
          <div class="history-error">误差：<strong>${record.error} 秒/日</strong></div>
          <div class="history-parts">
            <span>齿轮：<strong>${gearName}</strong></span>
            <span>发条：<strong>${springName}</strong></span>
            <span>擒纵：<strong>${escapementName}</strong></span>
            <span>摆轮：<strong>${pendulumName}</strong></span>
          </div>
          <div class="history-tune">
            <span>摆长：${record.lengthTune > 0 ? "+" : ""}${record.lengthTune}</span>
            <span>咬合：${record.meshTune > 0 ? "+" : ""}${record.meshTune}</span>
          </div>
        </li>
      `;
    }).join("");
  },

  fullWorkspace() {
    Renderer.currentJob();
    Renderer.clockSockets();
    Renderer.slots();
    Renderer.readouts();
    Renderer.tuningControls();
    Renderer.jobList();
  },

  testingControls(disabled) {
    JobStore.isTesting = disabled;

    dom.jobList.querySelectorAll(".job-list-item").forEach((item) => {
      item.classList.toggle("is-disabled", disabled);
      item.setAttribute("aria-disabled", String(disabled));
    });

    dom.partButtons.forEach((btn) => {
      btn.disabled = disabled;
      btn.classList.toggle("is-disabled", disabled);
      btn.setAttribute("aria-disabled", String(disabled));
      if (disabled) btn.removeAttribute("draggable");
      else btn.setAttribute("draggable", "true");
    });

    dom.sockets.forEach((socket) => {
      socket.classList.toggle("is-disabled", disabled);
      socket.setAttribute("aria-disabled", String(disabled));
    });

    dom.lengthTune.disabled = disabled;
    dom.lengthTune.classList.toggle("is-disabled", disabled);
    dom.lengthTune.setAttribute("aria-disabled", String(disabled));

    dom.meshTune.disabled = disabled;
    dom.meshTune.classList.toggle("is-disabled", disabled);
    dom.meshTune.setAttribute("aria-disabled", String(disabled));

    $(".parts").classList.toggle("is-disabled", disabled);
    $(".tuning").classList.toggle("is-disabled", disabled);

    dom.testBtn.disabled = disabled;
    dom.testBtn.classList.toggle("is-disabled", disabled);
    dom.testBtn.setAttribute("aria-disabled", String(disabled));

    dom.diagnoseBtn.disabled = disabled;
    dom.diagnoseBtn.classList.toggle("is-disabled", disabled);
    dom.diagnoseBtn.setAttribute("aria-disabled", String(disabled));
  },

  diagnosticTip(tip) {
    if (!tip) {
      dom.diagnosticTip.innerHTML = "";
      dom.diagnosticTip.className = "diagnostic-tip";
      return;
    }
    const icons = {
      info: "💡",
      warn: "⚠️",
      error: "🔧",
      good: "✨"
    };
    dom.diagnosticTip.innerHTML = `
      <span class="tip-icon">${icons[tip.type] || "💡"}</span>
      <span class="tip-text">${tip.text}</span>
    `;
    dom.diagnosticTip.className = `diagnostic-tip diagnostic-${tip.type}`;
  },

  clearFeedbackState(slot) {
    const socket = $(`[data-slot="${slot}"]`);
    const slotRow = $(`.installed [data-slot-row="${slot}"]`);
    if (!socket || !slotRow) return;

    socket.classList.remove("flash-in", "replacing");
    slotRow.classList.remove("flash-in", "replacing");

    const replaceBadge = slotRow.querySelector(".replace-badge");
    if (replaceBadge) replaceBadge.classList.remove("show");

    const socketReplaceBadge = socket.querySelector(".socket-replace-badge");
    if (socketReplaceBadge) socketReplaceBadge.classList.remove("show");
  },

  triggerReplaceFeedback(slot, oldName, isReplace) {
    const socket = $(`[data-slot="${slot}"]`);
    const slotRow = $(`.installed [data-slot-row="${slot}"]`);

    if (JobStore.feedbackTimers[slot]) {
      clearTimeout(JobStore.feedbackTimers[slot]);
    }
    Renderer.clearFeedbackState(slot);

    if (isReplace) {
      socket.classList.add("replacing");
      slotRow.classList.add("replacing");

      const replaceBadge = slotRow.querySelector(".replace-badge");
      if (replaceBadge) {
        replaceBadge.textContent = `替换：${oldName}`;
        replaceBadge.classList.add("show");
      }

      const socketReplaceBadge = socket.querySelector(".socket-replace-badge");
      if (socketReplaceBadge) {
        socketReplaceBadge.textContent = `← ${oldName}`;
        socketReplaceBadge.classList.add("show");
      }

      JobStore.feedbackTimers[slot] = setTimeout(() => {
        Renderer.clearFeedbackState(slot);
        JobStore.feedbackTimers[slot] = null;
      }, 1600);
    } else {
      void socket.offsetWidth;
      socket.classList.add("flash-in");
      slotRow.classList.add("flash-in");

      JobStore.feedbackTimers[slot] = setTimeout(() => {
        Renderer.clearFeedbackState(slot);
        JobStore.feedbackTimers[slot] = null;
      }, 900);
    }
  },

  testingProgress() {
    dom.errorReadout.textContent = "测试中";
    dom.scoreReadout.textContent = "--";
  },

  animateHands(pulses) {
    $(".minute").style.transform = `translate(-50%, -100%) rotate(${145 + pulses * 24}deg)`;
    $(".hour").style.transform = `translate(-50%, -100%) rotate(${45 + pulses * 2}deg)`;
  }
};
