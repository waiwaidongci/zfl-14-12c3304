window.$ = (sel) => document.querySelector(sel);
window.$$ = (sel) => [...document.querySelectorAll(sel)];

window.dom = {
  jobList: $("#jobList"),
  jobName: $("#jobName"),
  jobFault: $("#jobFault"),
  jobAcceptanceValue: $("#jobAcceptanceValue"),
  sockets: $$(".socket"),
  pendulum: $("#pendulum"),
  lengthTune: $("#lengthTune"),
  meshTune: $("#meshTune"),
  errorReadout: $("#errorReadout"),
  scoreReadout: $("#scoreReadout"),
  historyList: $("#historyList"),
  testBtn: $("#testBtn"),
  partButtons: $$(".parts button"),
  manualOverlay: $("#manualOverlay"),
  diagnoseBtn: $("#diagnoseBtn"),
  diagnosticTip: $("#diagnosticTip"),

  trendChart: $("#trendChart"),
  trendSvg: $("#trendSvg"),
  trendLine: $("#trendLine"),
  trendPoints: $("#trendPoints"),
  trendYMax: $("#trendYMax"),
  trendYMid: $("#trendYMid"),
  trendXAxis: $("#trendXAxis"),
  trendTargetLine: $("#trendTargetLine"),
  testStats: $("#testStats"),
  statMean: $("#statMean"),
  statRange: $("#statRange"),
  statTrend: $("#statTrend"),
  testAttemptInfo: $("#testAttemptInfo"),

  modeButtons: $$(".mode-btn"),
  dailyChallenge: $("#dailyChallenge"),
  commissionBoard: $("#commissionBoard"),
  challengeDate: $("#challengeDate"),
  challengeTotalScore: $("#challengeTotalScore"),
  challengeJobs: $("#challengeJobs"),
  inventoryGrid: $("#inventoryGrid")
};
