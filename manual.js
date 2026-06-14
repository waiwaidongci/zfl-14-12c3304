window.ManualRenderer = {
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
    $("#adviceAcceptanceValue").textContent = `≤${job.acceptance.maxError}${job.acceptance.unit}`;

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
