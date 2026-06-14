// ===== JOB DATA =====
const JobData = {
  JOBS: [
    {
      name: "旧海军舱钟",
      fault: "快走明显，发条输出不稳，摆轮偏短。目标误差小于每天18秒。",
      target: { gear: "balanced", spring: "steady", escapement: "clean", pendulum: "long" }
    },
    {
      name: "剧院后台挂钟",
      fault: "慢走且齿轮磨损，擒纵需要清洁。目标误差小于每天22秒。",
      target: { gear: "fast", spring: "steady", escapement: "clean", pendulum: "short" }
    },
    {
      name: "旅行黄铜闹钟",
      fault: "运输后发条偏松，摆轮过长，齿轮需要更高传动比。目标误差小于每天20秒。",
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

// ===== JOB STORE =====
const JobStore = {
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
      JobStore.jobBest[record.jobIndex] = { score: record.score, error: record.error };
    }
  }
};

// ===== DOM REFS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const dom = {
  jobList: $("#jobList"),
  jobName: $("#jobName"),
  jobFault: $("#jobFault"),
  sockets: $$(".socket"),
  pendulum: $("#pendulum"),
  lengthTune: $("#lengthTune"),
  meshTune: $("#meshTune"),
  errorReadout: $("#errorReadout"),
  scoreReadout: $("#scoreReadout"),
  historyList: $("#historyList"),
  testBtn: $("#testBtn"),
  partButtons: $$(".parts button"),
  manualOverlay: $("#manualOverlay")
};

// ===== RENDERER =====
const Renderer = {
  jobList() {
    dom.jobList.innerHTML = JobData.JOBS.map((job, index) => {
      const isActive = index === JobStore.currentJobIndex;
      const best = JobStore.jobBest[index];
      const statusText = best.score
        ? `最佳：${best.score}（${best.error}秒/日）`
        : "未测试";
      const statusClass = best.score ? "job-status-done" : "job-status-idle";
      return `
        <li class="job-list-item${isActive ? " active" : ""}" data-job-index="${index}" role="button" tabindex="0" aria-label="选择委托：${job.name}">
          <span class="job-list-item-name">${job.name}</span>
          <span class="job-list-item-fault">${job.fault}</span>
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

  readouts(error, score) {
    if (error === undefined || score === undefined) {
      dom.errorReadout.textContent = "--";
      dom.scoreReadout.textContent = "--";
    } else {
      dom.errorReadout.textContent = `${error}秒/日`;
      dom.scoreReadout.textContent = score;
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

      return `
        <li class="history-item" style="animation-delay: ${index * 0.05}s">
          <div class="history-job">
            <span class="history-job-name">${record.jobName}</span>
            <span class="history-score score-${record.score.toLowerCase()}">${record.score}</span>
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

// ===== HANDLER =====
const Handler = {
  switchJob(index) {
    const switched = JobStore.switchJob(index);
    if (!switched) return;
    Renderer.fullWorkspace();
    if (dom.manualOverlay.classList.contains("open")) ManualRenderer.refreshAll();
  },

  placePart(slot, value) {
    const result = JobStore.placePart(slot, value);
    if (!result.success) return;
    Renderer.slots();
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
        Renderer.readouts(abs, score);

        const job = JobData.JOBS[testSnapshot.jobIndex];
        const record = {
          jobName: job.name,
          parts: { ...testSnapshot.installed },
          lengthTune: testSnapshot.lengthTune,
          meshTune: testSnapshot.meshTune,
          error: abs,
          score: score,
          jobIndex: testSnapshot.jobIndex,
          timestamp: Date.now()
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
  }
};

// ===== MANUAL OVERLAY RENDERER =====
const ManualRenderer = {
  switchTab(tabName) {
    $$(".manual-tab").forEach((btn) => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });
    $$(".manual-tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `tab-${tabName}`);
    });
  },

  renderAdvicePanel() {
    const job = JobStore.getCurrentJob();
    $("#adviceJobName").textContent = job.name;
    $("#adviceJobFault").textContent = job.fault;

    const targetList = $("#adviceTargetList");
    targetList.innerHTML = Object.entries(job.target)
      .map(([slot, variant]) => {
        const name = JobData.getPartName(slot, variant);
        return `<li><span class="slot-label">${JobData.SLOT_LABELS[slot]}</span><span class="part-name">${name}</span></li>`;
      })
      .join("");

    const statusList = $("#adviceStatusList");
    let correctCount = 0;
    let emptyCount = 0;

    statusList.innerHTML = Object.keys(job.target)
      .map((slot) => {
        const wanted = job.target[slot];
        const current = JobStore.installed[slot];
        let statusClass = "";
        let displayName = "";

        if (!current) {
          statusClass = "status-empty";
          displayName = "（空）";
          emptyCount++;
        } else if (current === wanted) {
          statusClass = "status-correct";
          displayName = JobData.getPartName(slot, current);
          correctCount++;
        } else {
          statusClass = "status-wrong";
          displayName = JobData.getPartName(slot, current);
        }

        return `<li class="${statusClass}"><span class="slot-label">${JobData.SLOT_LABELS[slot]}</span><span class="part-name">${displayName}</span></li>`;
      })
      .join("");

    const hint = $("#adviceStatusHint");
    const totalSlots = Object.keys(job.target).length;

    if (correctCount === totalSlots) {
      hint.className = "status-hint status-good";
      hint.textContent = "零件全部装配正确！现在调节摆长和咬合滑块，把总误差压到目标线以下。";
    } else if (emptyCount === totalSlots) {
      hint.className = "status-hint";
      hint.textContent = "还没有安装任何零件，按照上方「目标零件」清单依次选择，或从零件托盘拖拽到对应插槽。";
    } else if (emptyCount > 0) {
      hint.className = "status-hint";
      hint.textContent = `还有 ${emptyCount} 个插槽未填装，先把零件装齐再进行微调。`;
    } else {
      const wrongCount = totalSlots - correctCount;
      hint.className = "status-hint";
      hint.textContent = `有 ${wrongCount} 个零件与目标不符（✗ 标记），对照目标清单更换后再微调。`;
    }
  },

  renderPartsTable() {
    const tbody = $("#partsTableBody");
    let html = "";
    Object.entries(JobData.PART_EFFECT).forEach(([slot, variants]) => {
      Object.entries(variants).forEach(([variant, value], i) => {
        const name = JobData.getPartName(slot, variant);
        const cls = value > 0 ? "effect-pos" : value < 0 ? "effect-neg" : "";
        const sign = value > 0 ? "+" : "";
        const partKey = `${slot}:${variant}`;
        html += `<tr data-part="${partKey}"><td>${i === 0 ? JobData.SLOT_LABELS[slot] : ""}</td><td>${name}</td><td class="effect-num ${cls}">${sign}${value}</td></tr>`;
      });
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll("tr").forEach((row) => {
      row.addEventListener("click", () => {
        const partKey = row.dataset.part;
        const partBtn = $(`.parts button[data-part="${partKey}"]`);
        const tableRows = tbody.querySelectorAll("tr");
        tableRows.forEach((r) => r.classList.remove("row-highlight"));
        row.classList.add("row-highlight");

        if (partBtn) {
          partBtn.classList.remove("parts-button-highlight");
          void partBtn.offsetWidth;
          partBtn.classList.add("parts-button-highlight");
          partBtn.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          setTimeout(() => {
            partBtn.classList.remove("parts-button-highlight");
            row.classList.remove("row-highlight");
          }, 1200);
        }
      });
    });
  },

  renderTierList() {
    const tierList = $("#tierList");
    tierList.innerHTML = JobData.TIERS
      .map((t, idx) => {
        const bound = t.max === Infinity ? `> ${JobData.TIERS[idx - 1].max}` : `≤ ${t.max}`;
        return `<li class="tier-item tier-${t.grade.toLowerCase()}"><span class="tier-badge">${t.grade}</span><span>误差 ${bound} 秒/日 — ${t.desc}</span></li>`;
      })
      .join("");
  },

  renderCalcPanel() {
    const job = JobStore.getCurrentJob();
    const calcGrid = $("#calcGrid");
    let totalError = 0;
    let rowsHtml = "";

    Object.entries(job.target).forEach(([slot, wanted]) => {
      const current = JobStore.installed[slot];
      let errorVal;
      let partText;
      let rowClass = "";

      if (!current) {
        errorVal = slot === "escapement" ? 42 : 34;
        partText = "（空 — 罚分）";
        rowClass = "calc-empty";
      } else {
        errorVal = Math.abs(JobData.PART_EFFECT[slot][current] - JobData.PART_EFFECT[slot][wanted]);
        partText = JobData.getPartName(slot, current);
      }

      totalError += errorVal;
      const wantedName = JobData.getPartName(slot, wanted);
      const cls = errorVal > 0 ? "effect-pos" : "";
      const sign = errorVal > 0 ? "+" : "";

      rowsHtml += `<div class="calc-row ${rowClass}">
        <span class="calc-slot">${JobData.SLOT_LABELS[slot]}</span>
        <span class="calc-part">${partText}</span>
        <span class="calc-target">目标：${wantedName}</span>
        <span class="calc-error ${cls}">${sign}${errorVal}</span>
      </div>`;
    });

    calcGrid.innerHTML = rowsHtml;

    const calcLength = $("#calcLength");
    const calcMesh = $("#calcMesh");
    calcLength.value = JobStore.lengthTune;
    calcMesh.value = JobStore.meshTune;

    function computeTotal() {
      let tuneL = Number(calcLength.value) || 0;
      let tuneM = Number(calcMesh.value) || 0;
      tuneL = Math.max(-8, Math.min(8, tuneL));
      tuneM = Math.max(-8, Math.min(8, tuneM));
      calcLength.value = tuneL;
      calcMesh.value = tuneM;

      const tuneError = tuneL * -3 + tuneM * 2.2;
      const rawTotal = totalError + tuneError;
      const absTotal = Math.abs(Math.round(rawTotal));

      $("#calcTotal").textContent = `${absTotal} 秒/日`;

      const tier = JobData.getTier(absTotal);
      const hint = $("#calcHint");
      hint.className = `calc-hint calc-tier-${tier.grade.toLowerCase()}`;
      const nextTierIdx = JobData.TIERS.indexOf(tier) - 1;
      let upHint = "";
      if (nextTierIdx >= 0) {
        const gap = absTotal - JobData.TIERS[nextTierIdx].max;
        upHint = `距上一档（${JobData.TIERS[nextTierIdx].grade}）还差 ${gap} 秒。`;
      } else {
        upHint = "已达最高档位！";
      }
      hint.textContent = `理论档位：${tier.grade} — ${tier.desc}。${upHint}`;
    }

    computeTotal();
    calcLength.oninput = computeTotal;
    calcMesh.oninput = computeTotal;
  },

  refreshAll() {
    ManualRenderer.renderAdvicePanel();
    ManualRenderer.renderTierList();
    ManualRenderer.renderPartsTable();
    ManualRenderer.renderCalcPanel();
  }
};

// ===== EVENT BINDING =====
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

// ===== INIT =====
function init() {
  JobStore.init();
  bindJobListEvents();
  bindPartEvents();
  bindSocketEvents();
  bindTestEvent();
  bindTuneEvents();
  bindManualEvents();

  Renderer.fullWorkspace();
  Renderer.testHistory();
}

init();
