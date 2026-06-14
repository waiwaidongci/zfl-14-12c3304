window.Diagnostics = {
  calcTheoreticalError() {
    return JobStore.calcTheoreticalError();
  },

  analyze() {
    const job = JobStore.getCurrentJob();
    const installed = JobStore.installed;
    const lengthTune = JobStore.lengthTune;
    const meshTune = JobStore.meshTune;

    const emptySlots = [];
    const wrongSlots = [];
    const correctSlots = [];

    Object.entries(job.target).forEach(([slot, wanted]) => {
      const current = installed[slot];
      if (!current) {
        emptySlots.push(slot);
      } else if (current !== wanted) {
        wrongSlots.push({ slot, current, wanted });
      } else {
        correctSlots.push(slot);
      }
    });

    const totalSlots = Object.keys(job.target).length;

    if (emptySlots.length === totalSlots) {
      return Diagnostics.tipEmptyAssembly(job);
    }

    if (emptySlots.length > 0) {
      return Diagnostics.tipPartialAssembly(job, emptySlots, wrongSlots);
    }

    if (wrongSlots.length > 0) {
      return Diagnostics.tipWrongParts(job, wrongSlots, correctSlots);
    }

    return Diagnostics.tipTuning(job, lengthTune, meshTune);
  },

  tipEmptyAssembly(job) {
    const fault = job.fault;
    const tips = [
      { type: "info", text: `工作台上还没有装配任何零件。参考故障记录：「${fault}」，从最相关的部位开始着手。` },
      { type: "info", text: `故障描述提到了具体问题：「${fault}」。对照零件效果，先选择一个可能解决问题的零件装上。` },
      { type: "info", text: `四个插槽全是空的。阅读委托描述：「${fault}」，思考哪种零件组合能应对这种症状。` }
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  },

  tipPartialAssembly(job, emptySlots, wrongSlots) {
    const slotNames = emptySlots.map(s => JobData.SLOT_LABELS[s]).join("、");
    const emptyCount = emptySlots.length;

    if (emptySlots.includes("escapement")) {
      return {
        type: "error",
        text: `擒纵机构尚未安装，这是走时系统的核心。${emptyCount > 1 ? `还有 ${slotNames} 也未装配。` : "先把擒纵装好吧。"}`
      };
    }

    if (wrongSlots.length > 0) {
      const wrongSlotNames = wrongSlots.map(w => JobData.SLOT_LABELS[w.slot]).join("、");
      return {
        type: "warn",
        text: `已装配的 ${wrongSlotNames} 可能需要再斟酌。此外还有 ${slotNames} 尚未安装，先把零件装齐再观察。`
      };
    }

    const faultHints = [
      { match: "快走明显", hint: "故障提到「发条输出不稳」和「摆轮偏短」，这两个部位优先级较高。" },
      { match: "慢走且齿轮磨损", hint: "故障提到「齿轮磨损」和「擒纵需要清洁」，先把这两个部位处理好。" },
      { match: "运输后发条偏松", hint: "故障提到「发条偏松」和「摆轮过长」，这是最明显的线索。" }
    ];

    const matched = faultHints.find(f => job.fault.includes(f.match));
    const hint = matched ? matched.hint : "对照委托描述，从提到的部位开始安装。";

    return {
      type: "warn",
      text: `还有 ${slotNames} 未安装（还差 ${emptyCount} 个）。${hint}`
    };
  },

  tipWrongParts(job, wrongSlots, correctSlots) {
    const theoreticalError = Diagnostics.calcTheoreticalError();

    const pendulumWrong = wrongSlots.find(w => w.slot === "pendulum");
    if (pendulumWrong) {
      const currentEffect = JobData.PART_EFFECT.pendulum[pendulumWrong.current];
      const wantedEffect = JobData.PART_EFFECT.pendulum[pendulumWrong.wanted];
      if (currentEffect > wantedEffect) {
        return { type: "warn", text: "摆轮周期似乎偏短，走时可能偏快。考虑换一种摆轮试试。" };
      } else {
        return { type: "warn", text: "摆轮周期似乎偏长，走时可能偏慢。试试调整摆轮类型。" };
      }
    }

    const springWrong = wrongSlots.find(w => w.slot === "spring");
    if (springWrong) {
      const currentEffect = JobData.PART_EFFECT.spring[springWrong.current];
      const wantedEffect = JobData.PART_EFFECT.spring[springWrong.wanted];
      if (currentEffect > wantedEffect) {
        return { type: "warn", text: "发条输出动力偏强，可能导致走时过快。换一种发条特性也许能改善。" };
      } else {
        return { type: "warn", text: "发条输出动力偏弱，走时可能偏慢。考虑更换动力更强的发条。" };
      }
    }

    const gearWrong = wrongSlots.find(w => w.slot === "gear");
    if (gearWrong) {
      return {
        type: "warn",
        text: `齿轮传动比与目标偏差 ${Math.abs(JobData.PART_EFFECT.gear[gearWrong.current] - JobData.PART_EFFECT.gear[gearWrong.wanted])} 秒/日。故障描述提到了齿轮相关的问题，也许应该重新选择。`
      };
    }

    const escapementWrong = wrongSlots.find(w => w.slot === "escapement");
    if (escapementWrong) {
      return {
        type: "error",
        text: "擒纵机构状态对走时精度影响很大。当前的擒纵似乎与故障描述不符，建议更换。"
      };
    }

    if (theoreticalError > 40) {
      return {
        type: "error",
        text: `理论误差偏大（约 ${Math.abs(Math.round(theoreticalError))} 秒/日）。有 ${wrongSlots.length} 个零件可能不合适，对照故障描述重新考虑。`
      };
    }

    return {
      type: "warn",
      text: `还有 ${wrongSlots.length} 个零件可能与目标不符。参考委托中的故障描述，逐一比对每个部位。`
    };
  },

  tipTuning(job, lengthTune, meshTune) {
    const theoreticalError = Diagnostics.calcTheoreticalError();
    const absError = Math.abs(Math.round(theoreticalError));

    if (Math.abs(lengthTune) >= 7 || Math.abs(meshTune) >= 7) {
      if (Math.abs(lengthTune) >= 7) {
        return {
          type: "warn",
          text: `摆长调节已接近极限（${lengthTune > 0 ? "+" : ""}${lengthTune} 格）。微调可以补偿误差，但过度调节可能导致其他问题，考虑是否零件本身就不合适。`
        };
      }
      return {
        type: "warn",
        text: `咬合调节已接近极限（${meshTune > 0 ? "+" : ""}${meshTune} 格）。咬合调得过紧或过松都可能影响长期稳定性。`
      };
    }

    if (absError <= job.acceptance.maxError) {
      if (lengthTune === 0 && meshTune === 0) {
        return {
          type: "good",
          text: "零件全部匹配！理论误差很小，可以先跑一次测试看看实际走时，再决定是否需要微调。"
        };
      }
      return {
        type: "good",
        text: `零件全部正确，当前微调理论误差约 ${absError} 秒/日。可以进行走时测试验证实际效果。`
      };
    }

    if (theoreticalError > 0) {
      if (lengthTune > -5) {
        return {
          type: "info",
          text: `理论上走时偏快约 ${absError} 秒/日。摆长调节还有向左调整的空间，每格可减少约 3 秒误差。`
        };
      }
      return {
        type: "warn",
        text: `理论误差仍有 ${absError} 秒/日，摆长已调至较左位置。也许应该重新考虑零件选择，而不是完全依赖微调补偿。`
      };
    }

    if (theoreticalError < 0) {
      if (meshTune < 5) {
        return {
          type: "info",
          text: `理论上走时偏慢约 ${absError} 秒/日。咬合调节还有向右调整的空间，每格可增加约 2.2 秒误差。`
        };
      }
      return {
        type: "warn",
        text: `理论误差仍有 ${absError} 秒/日，咬合已调至较右位置。微调补偿有限，也许零件本身需要重新评估。`
      };
    }

    return {
      type: "good",
      text: "零件装配正确，微调也在合理范围。理论误差接近零，可以进行走时测试。"
    };
  }
};
