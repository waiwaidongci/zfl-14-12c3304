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
}

function updateSlots() {
  Object.entries(installed).forEach(([slot, part]) => {
    const dd = document.querySelector(`#${slot}Slot`);
    dd.textContent = part ? partNames[`${slot}:${part}`] : "空";
  });
  const swing = installed.pendulum === "short" ? 0.95 : installed.pendulum === "long" ? 1.8 : 1.3;
  pendulum.style.animationDuration = `${swing}s`;
}

function placePart(slot, value) {
  installed[slot] = value;
  const socket = document.querySelector(`[data-slot="${slot}"]`);
  socket.classList.add("filled");
  socket.querySelector("span").textContent = partNames[`${slot}:${value}`];
  updateSlots();
  estimateError(false);
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

[lengthTune, meshTune].forEach((input) => input.addEventListener("input", () => estimateError(false)));

loadJob();
