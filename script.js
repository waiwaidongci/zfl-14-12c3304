const jobs = [
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
];

const partNames = {
  "gear:balanced": "均衡齿轮",
  "gear:fast": "高速齿轮",
  "spring:steady": "稳压发条",
  "spring:tight": "紧绷发条",
  "escapement:clean": "清洁擒纵",
  "escapement:worn": "旧擒纵",
  "pendulum:short": "短摆轮",
  "pendulum:long": "长摆轮"
};

const effect = {
  gear: { balanced: 0, fast: 18 },
  spring: { steady: -4, tight: 12 },
  escapement: { clean: 0, worn: -28 },
  pendulum: { short: 20, long: -16 }
};

let jobIndex = 0;
let installed = { gear: null, spring: null, escapement: null, pendulum: null };
let testTimer = null;

const jobName = document.querySelector("#jobName");
const jobFault = document.querySelector("#jobFault");
const sockets = [...document.querySelectorAll(".socket")];
const pendulum = document.querySelector("#pendulum");
const lengthTune = document.querySelector("#lengthTune");
const meshTune = document.querySelector("#meshTune");
const errorReadout = document.querySelector("#errorReadout");
const scoreReadout = document.querySelector("#scoreReadout");

function loadJob() {
  const job = jobs[jobIndex];
  jobName.textContent = job.name;
  jobFault.textContent = job.fault;
  installed = { gear: null, spring: null, escapement: null, pendulum: null };
  lengthTune.value = 0;
  meshTune.value = 0;
  errorReadout.textContent = "--";
  scoreReadout.textContent = "--";
  sockets.forEach((socket) => {
    socket.classList.remove("filled", "over");
    socket.querySelector("span").textContent = socket.dataset.slot === "escapement" ? "擒纵" : socket.dataset.slot === "pendulum" ? "摆轮" : socket.dataset.slot === "spring" ? "发条" : "齿轮";
  });
  updateSlots();
  if (manualOverlay.classList.contains("open")) refreshAllManualPanels();
}

function updateSlots() {
  Object.entries(installed).forEach(([slot, part]) => {
    const span = document.querySelector(`#${slot}Slot`);
    span.textContent = part ? partNames[`${slot}:${part}`] : "空";
  });
  const swing = installed.pendulum === "short" ? 0.95 : installed.pendulum === "long" ? 1.8 : 1.3;
  pendulum.style.animationDuration = `${swing}s`;
}

function clearFeedbackState(slot) {
  const socket = document.querySelector(`[data-slot="${slot}"]`);
  const slotRow = document.querySelector(`.installed [data-slot-row="${slot}"]`);
  if (!socket || !slotRow) return;

  socket.classList.remove("flash-in", "replacing");
  slotRow.classList.remove("flash-in", "replacing");

  const replaceBadge = slotRow.querySelector(".replace-badge");
  if (replaceBadge) replaceBadge.classList.remove("show");

  const socketReplaceBadge = socket.querySelector(".socket-replace-badge");
  if (socketReplaceBadge) socketReplaceBadge.classList.remove("show");
}

function placePart(slot, value) {
  const oldValue = installed[slot];
  const isReplace = oldValue !== null && oldValue !== value;
  const oldName = isReplace ? partNames[`${slot}:${oldValue}`] : null;

  if (oldValue === value) return;

  installed[slot] = value;
  const socket = document.querySelector(`[data-slot="${slot}"]`);
  socket.classList.add("filled");
  socket.querySelector("span").textContent = partNames[`${slot}:${value}`];
  updateSlots();
  estimateError(false);

  triggerReplaceFeedback(slot, oldName, isReplace);

  if (manualOverlay.classList.contains("open")) refreshAllManualPanels();
}

let feedbackTimers = {};

function triggerReplaceFeedback(slot, oldName, isReplace) {
  const socket = document.querySelector(`[data-slot="${slot}"]`);
  const slotRow = document.querySelector(`.installed [data-slot-row="${slot}"]`);

  if (feedbackTimers[slot]) {
    clearTimeout(feedbackTimers[slot]);
  }
  clearFeedbackState(slot);

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

    feedbackTimers[slot] = setTimeout(() => {
      clearFeedbackState(slot);
      feedbackTimers[slot] = null;
    }, 1600);
  } else {
    void socket.offsetWidth;
    socket.classList.add("flash-in");
    slotRow.classList.add("flash-in");

    feedbackTimers[slot] = setTimeout(() => {
      clearFeedbackState(slot);
      feedbackTimers[slot] = null;
    }, 900);
  }
}

function estimateError(show) {
  const job = jobs[jobIndex];
  let error = 0;
  Object.entries(job.target).forEach(([slot, wanted]) => {
    const value = installed[slot];
    if (!value) error += slot === "escapement" ? 42 : 34;
    else error += Math.abs(effect[slot][value] - effect[slot][wanted]);
  });
  error += Number(lengthTune.value) * -3;
  error += Number(meshTune.value) * 2.2;
  error += Math.round((Math.random() - 0.5) * 5);
  const abs = Math.abs(Math.round(error));
  if (show) {
    errorReadout.textContent = `${abs}秒/日`;
    scoreReadout.textContent = abs <= 12 ? "S" : abs <= 22 ? "A" : abs <= 38 ? "B" : abs <= 58 ? "C" : "D";
  }
  return abs;
}

document.querySelectorAll(".parts button").forEach((button) => {
  button.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", button.dataset.part);
  });

  button.addEventListener("click", () => {
    const [slot, value] = button.dataset.part.split(":");
    placePart(slot, value);
  });
});

sockets.forEach((socket) => {
  socket.addEventListener("dragover", (event) => {
    event.preventDefault();
    socket.classList.add("over");
  });
  socket.addEventListener("dragleave", () => socket.classList.remove("over"));
  socket.addEventListener("drop", (event) => {
    event.preventDefault();
    socket.classList.remove("over");
    const [slot, value] = event.dataTransfer.getData("text/plain").split(":");
    if (slot === socket.dataset.slot) placePart(slot, value);
  });
});

document.querySelector("#testBtn").addEventListener("click", () => {
  if (testTimer) clearInterval(testTimer);
  let pulses = 0;
  errorReadout.textContent = "测试中";
  scoreReadout.textContent = "--";
  document.body.classList.add("testing");
  testTimer = setInterval(() => {
    pulses += 1;
    document.querySelector(".minute").style.transform = `translate(-50%, -100%) rotate(${145 + pulses * 24}deg)`;
    document.querySelector(".hour").style.transform = `translate(-50%, -100%) rotate(${45 + pulses * 2}deg)`;
    if (pulses >= 9) {
      clearInterval(testTimer);
      document.body.classList.remove("testing");
      estimateError(true);
    }
  }, 180);
});

document.querySelector("#newJob").addEventListener("click", () => {
  jobIndex = (jobIndex + 1) % jobs.length;
  loadJob();
});

[lengthTune, meshTune].forEach((input) =>
  input.addEventListener("input", () => {
    estimateError(false);
    if (manualOverlay.classList.contains("open")) renderCalcPanel();
  })
);

const slotLabels = { gear: "齿轮", spring: "发条", escapement: "擒纵", pendulum: "摆轮" };
const tiers = [
  { grade: "S", max: 12, desc: "大师级精度" },
  { grade: "A", max: 22, desc: "优秀走时" },
  { grade: "B", max: 38, desc: "合格水准" },
  { grade: "C", max: 58, desc: "勉强可用" },
  { grade: "D", max: Infinity, desc: "需要返工" }
];

function getTier(error) {
  const abs = Math.abs(error);
  for (const t of tiers) {
    if (abs <= t.max) return t;
  }
  return tiers[tiers.length - 1];
}

function switchManualTab(tabName) {
  document.querySelectorAll(".manual-tab").forEach((btn) => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll(".manual-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
}

document.querySelectorAll(".manual-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchManualTab(btn.dataset.tab));
});

function renderAdvicePanel() {
  const job = jobs[jobIndex];
  document.getElementById("adviceJobName").textContent = job.name;
  document.getElementById("adviceJobFault").textContent = job.fault;

  const targetList = document.getElementById("adviceTargetList");
  targetList.innerHTML = Object.entries(job.target)
    .map(([slot, variant]) => {
      const name = partNames[`${slot}:${variant}`];
      return `<li><span class="slot-label">${slotLabels[slot]}</span><span class="part-name">${name}</span></li>`;
    })
    .join("");

  const statusList = document.getElementById("adviceStatusList");
  let correctCount = 0;
  let emptyCount = 0;

  statusList.innerHTML = Object.keys(job.target)
    .map((slot) => {
      const wanted = job.target[slot];
      const current = installed[slot];
      let statusClass = "";
      let displayName = "";

      if (!current) {
        statusClass = "status-empty";
        displayName = "（空）";
        emptyCount++;
      } else if (current === wanted) {
        statusClass = "status-correct";
        displayName = partNames[`${slot}:${current}`];
        correctCount++;
      } else {
        statusClass = "status-wrong";
        displayName = partNames[`${slot}:${current}`];
      }

      return `<li class="${statusClass}"><span class="slot-label">${slotLabels[slot]}</span><span class="part-name">${displayName}</span></li>`;
    })
    .join("");

  const hint = document.getElementById("adviceStatusHint");
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
}

function renderPartsTable() {
  const tbody = document.getElementById("partsTableBody");
  let html = "";
  Object.entries(effect).forEach(([slot, variants]) => {
    Object.entries(variants).forEach(([variant, value], i) => {
      const name = partNames[`${slot}:${variant}`];
      const cls = value > 0 ? "effect-pos" : value < 0 ? "effect-neg" : "";
      const sign = value > 0 ? "+" : "";
      const partKey = `${slot}:${variant}`;
      html += `<tr data-part="${partKey}"><td>${i === 0 ? slotLabels[slot] : ""}</td><td>${name}</td><td class="effect-num ${cls}">${sign}${value}</td></tr>`;
    });
  });
  tbody.innerHTML = html;

  tbody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => {
      const partKey = row.dataset.part;
      const partBtn = document.querySelector(`.parts button[data-part="${partKey}"]`);
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
}

function renderTierList() {
  const tierList = document.getElementById("tierList");
  tierList.innerHTML = tiers
    .map((t, idx) => {
      const bound = t.max === Infinity ? `> ${tiers[idx - 1].max}` : `≤ ${t.max}`;
      return `<li class="tier-item tier-${t.grade.toLowerCase()}"><span class="tier-badge">${t.grade}</span><span>误差 ${bound} 秒/日 — ${t.desc}</span></li>`;
    })
    .join("");
}

function renderCalcPanel() {
  const job = jobs[jobIndex];
  const calcGrid = document.getElementById("calcGrid");
  let totalError = 0;
  let rowsHtml = "";

  Object.entries(job.target).forEach(([slot, wanted]) => {
    const current = installed[slot];
    let errorVal;
    let partText;
    let rowClass = "";

    if (!current) {
      errorVal = slot === "escapement" ? 42 : 34;
      partText = "（空 — 罚分）";
      rowClass = "calc-empty";
    } else {
      errorVal = Math.abs(effect[slot][current] - effect[slot][wanted]);
      partText = partNames[`${slot}:${current}`];
    }

    totalError += errorVal;
    const wantedName = partNames[`${slot}:${wanted}`];
    const cls = errorVal > 0 ? "effect-pos" : "";
    const sign = errorVal > 0 ? "+" : "";

    rowsHtml += `<div class="calc-row ${rowClass}">
      <span class="calc-slot">${slotLabels[slot]}</span>
      <span class="calc-part">${partText}</span>
      <span class="calc-target">目标：${wantedName}</span>
      <span class="calc-error ${cls}">${sign}${errorVal}</span>
    </div>`;
  });

  calcGrid.innerHTML = rowsHtml;

  const calcLength = document.getElementById("calcLength");
  const calcMesh = document.getElementById("calcMesh");
  calcLength.value = lengthTune.value;
  calcMesh.value = meshTune.value;

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

    document.getElementById("calcTotal").textContent = `${absTotal} 秒/日`;

    const tier = getTier(absTotal);
    const hint = document.getElementById("calcHint");
    hint.className = `calc-hint calc-tier-${tier.grade.toLowerCase()}`;
    const nextTierIdx = tiers.indexOf(tier) - 1;
    let upHint = "";
    if (nextTierIdx >= 0) {
      const gap = absTotal - tiers[nextTierIdx].max;
      upHint = `距上一档（${tiers[nextTierIdx].grade}）还差 ${gap} 秒。`;
    } else {
      upHint = "已达最高档位！";
    }
    hint.textContent = `理论档位：${tier.grade} — ${tier.desc}。${upHint}`;
  }

  computeTotal();
  calcLength.oninput = computeTotal;
  calcMesh.oninput = computeTotal;
}

function refreshAllManualPanels() {
  renderAdvicePanel();
  renderTierList();
  renderPartsTable();
  renderCalcPanel();
}

const manualOverlay = document.getElementById("manualOverlay");
document.getElementById("manualBtn").addEventListener("click", () => {
  refreshAllManualPanels();
  switchManualTab("advice");
  manualOverlay.classList.add("open");
  manualOverlay.setAttribute("aria-hidden", "false");
});

function closeManual() {
  manualOverlay.classList.remove("open");
  manualOverlay.setAttribute("aria-hidden", "true");
}

document.getElementById("manualClose").addEventListener("click", closeManual);
manualOverlay.addEventListener("click", (e) => {
  if (e.target === manualOverlay) closeManual();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && manualOverlay.classList.contains("open")) closeManual();
});

loadJob();
