(() => {
"use strict";

const STORAGE_KEY = "t02-history-blitz-v1";
const DEFAULT_SAVE = {
  best: 0,
  settings: { muted: false, reducedMotion: false }
};

// T02 난이도 비교에서 바꾸는 값은 하나뿐입니다.
const DIFFICULTY = {
  label: "NORMAL",
  difficultyMode: "normal",
  timeLimit: 30
};

const QUESTIONS = [
  {q:"훈민정음을 창제한 조선의 왕은 누구인가?", a:["태종","세종","성종","영조"], c:1},
  {q:"고구려의 전성기를 이끈 왕으로 영토를 크게 확장한 인물은?", a:["광개토대왕","문무왕","무열왕","진흥왕"], c:0},
  {q:"삼국 통일 과정에서 신라가 동맹을 맺었던 나라는?", a:["백제","고구려","당","발해"], c:2},
  {q:"고려를 세운 인물은 누구인가?", a:["궁예","견훤","왕건","이성계"], c:2},
  {q:"고려의 대장경으로 현재 합천 해인사에 보관된 것은?", a:["팔만대장경","무구정광대다라니경","직지","삼국사기"], c:0},
  {q:"조선을 건국한 인물은 누구인가?", a:["정도전","이성계","최영","신숙주"], c:1},
  {q:"임진왜란이 시작된 해는?", a:["1492년","1592년","1623년","1728년"], c:1},
  {q:"병자호란 때 청과 맞서 싸운 조선의 왕은?", a:["선조","광해군","인조","숙종"], c:2},
  {q:"실학자로서 『목민심서』를 쓴 인물은?", a:["박지원","정약용","이익","홍대용"], c:1},
  {q:"대한민국 임시정부가 수립된 해는?", a:["1910년","1919년","1929년","1945년"], c:1},
  {q:"3·1 운동이 일어난 해는?", a:["1905년","1919년","1931년","1948년"], c:1},
  {q:"대한민국 정부가 수립된 해는?", a:["1945년","1948년","1950년","1953년"], c:1},
  {q:"6·25 전쟁이 시작된 날짜는?", a:["1945년 8월 15일","1948년 8월 15일","1950년 6월 25일","1953년 7월 27일"], c:2},
  {q:"발해를 건국한 인물은?", a:["대조영","궁예","장보고","을지문덕"], c:0},
  {q:"신라의 화랑도를 국가적으로 정비한 왕은?", a:["진흥왕","법흥왕","무열왕","문무왕"], c:0},
  {q:"직지를 인쇄한 기술은?", a:["금속 활자","목판 인쇄","석판 인쇄","활판 인쇄"], c:0},
  {q:"조선 시대의 최고 교육 기관인 성균관은 주로 무엇을 교육했는가?", a:["무예","유학","의학","상업"], c:1},
  {q:"독립협회가 활동한 시기의 대표적인 인물은?", a:["서재필","안중근","윤봉길","김구"], c:0}
];

const quiz = document.querySelector("#quiz");
const question = document.querySelector("#question");
const answers = document.querySelector("#answers");
const qIndex = document.querySelector("#qIndex");
const scoreEl = document.querySelector("#score");
const questionNoEl = document.querySelector("#questionNo");
const timeEl = document.querySelector("#time");
const bestEl = document.querySelector("#best");
const feedback = document.querySelector("#feedback");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayCopy = document.querySelector("#overlayCopy");
const startBtn = document.querySelector("#startBtn");
const continueBtn = document.querySelector("#continueBtn");
const restartBtn = document.querySelector("#restartBtn");
const pauseBtn = document.querySelector("#pauseBtn");
const settingsBtn = document.querySelector("#settingsBtn");
const settingsDialog = document.querySelector("#settingsDialog");
const muteToggle = document.querySelector("#muteToggle");
const reducedMotionToggle = document.querySelector("#reducedMotionToggle");
const resetSaveBtn = document.querySelector("#resetSaveBtn");

let save = loadSave();
let state = "ready";
let current = 0;
let order = [];
let score = 0;
let questionCount = 0;
let startedAt = 0;
let pausedElapsed = 0;
let raf = 0;
let audioCtx = null;
let answering = false;

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("bad save");
    return {
      best: Number.isFinite(parsed.best) && parsed.best >= 0 ? parsed.best : 0,
      settings: {
        muted: Boolean(parsed.settings?.muted),
        reducedMotion: Boolean(parsed.settings?.reducedMotion)
      }
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch {} }
function applySettings() {
  document.documentElement.classList.toggle("reduced-motion", save.settings.reducedMotion);
  muteToggle.checked = save.settings.muted;
  reducedMotionToggle.checked = save.settings.reducedMotion;
}
function updateHud() {
  scoreEl.textContent = score;
  questionNoEl.textContent = questionCount;
  bestEl.textContent = save.best;
  qIndex.textContent = Math.min(questionCount + 1, QUESTIONS.length);
  document.querySelector("#difficultyLabel").textContent = DIFFICULTY.label;
  document.querySelector("#limitLabel").textContent = `${DIFFICULTY.timeLimit}초`;
}
function showOverlay(title, copy, mode) {
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  startBtn.classList.toggle("hidden", mode !== "start");
  continueBtn.classList.toggle("hidden", mode !== "continue");
  restartBtn.classList.toggle("hidden", mode !== "restart");
  overlay.classList.remove("hidden");
}
function hideOverlay() { overlay.classList.add("hidden"); }

function shuffledQuestions() {
  const arr = QUESTIONS.map((_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function resetRound() {
  cancelAnimationFrame(raf);
  state = "ready";
  current = 0; order = shuffledQuestions(); score = 0; questionCount = 0;
  pausedElapsed = 0; startedAt = 0; answering = false;
  feedback.textContent = "";
  feedback.className = "feedback";
  renderQuestion();
  updateHud();
}
function startGame() {
  resetRound();
  state = "playing";
  startedAt = performance.now();
  lastTick = startedAt;
  hideOverlay();
  quiz.focus();
  raf = requestAnimationFrame(tick);
}
function finishGame() {
  state = "finished";
  cancelAnimationFrame(raf);
  if (score > save.best) {
    save.best = score;
    persist();
  }
  updateHud();
  showOverlay("시간 종료!", `30초 동안 ${questionCount}문제를 풀어 ${score}점을 얻었습니다.`, "restart");
  beep(740, .08);
}
let lastTick = 0;
function tick(now) {
  if (state !== "playing") return;
  const elapsed = (now - startedAt) / 1000;
  const remain = Math.max(0, DIFFICULTY.timeLimit - elapsed);
  timeEl.textContent = `${remain.toFixed(1)}s`;
  if (remain <= 0) { finishGame(); return; }
  raf = requestAnimationFrame(tick);
}
function pauseGame() {
  if (state !== "playing") return;
  pausedElapsed = Math.min(DIFFICULTY.timeLimit, (performance.now() - startedAt) / 1000);
  state = "paused";
  cancelAnimationFrame(raf);
  showOverlay("일시정지", "현재 점수와 문제 진행 상태를 그대로 보존합니다.", "continue");
}
function resumeGame() {
  if (state !== "paused") return;
  state = "playing";
  startedAt = performance.now() - pausedElapsed * 1000;
  hideOverlay();
  raf = requestAnimationFrame(tick);
  quiz.focus();
}
function renderQuestion() {
  const q = QUESTIONS[order[current % order.length]];
  question.textContent = q.q;
  answers.replaceChildren();
  q.a.forEach((text, idx) => {
    const button = document.createElement("button");
    button.className = "answer";
    button.type = "button";
    button.innerHTML = `<span class="num">${idx + 1}</span>${text}`;
    button.addEventListener("click", () => answer(idx));
    answers.appendChild(button);
  });
  updateHud();
}
function answer(selected) {
  if (state !== "playing" || answering) return;
  answering = true;
  const q = QUESTIONS[order[current % order.length]];
  const buttons = [...answers.querySelectorAll(".answer")];
  buttons.forEach(b => b.disabled = true);
  const correct = selected === q.c;
  if (correct) {
    score += 1;
    feedback.textContent = "정답! +1";
    feedback.className = "feedback good";
    buttons[selected].style.borderColor = "var(--good)";
    buttons[selected].style.background = "rgba(85,214,139,.13)";
    beep(880, .08);
  } else {
    feedback.textContent = `오답 · 정답은 ${q.a[q.c]}`;
    feedback.className = "feedback bad";
    buttons[selected].style.borderColor = "var(--bad)";
    buttons[selected].style.background = "rgba(255,104,123,.13)";
    buttons[q.c].style.borderColor = "var(--good)";
    buttons[q.c].style.background = "rgba(85,214,139,.13)";
    beep(230, .08);
  }
  questionCount += 1;
  updateHud();
  setTimeout(() => {
    if (state !== "playing") return;
    current += 1;
    answering = false;
    feedback.textContent = "";
    feedback.className = "feedback";
    renderQuestion();
  }, save.settings.reducedMotion ? 60 : 260);
}
function beep(freq, duration) {
  if (save.settings.muted) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(.035, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch {}
}
function resetSave() {
  save = structuredClone(DEFAULT_SAVE);
  persist();
  updateHud();
  applySettings();
}
function chooseByNumber(n) {
  if (state === "playing") {
    const buttons = answers.querySelectorAll(".answer");
    buttons[n - 1]?.click();
  }
}

window.addEventListener("keydown", e => {
  if (/^[1-4]$/.test(e.key)) { e.preventDefault(); chooseByNumber(Number(e.key)); }
  if (e.key === " " || e.key.toLowerCase() === "p") {
    e.preventDefault();
    if (state === "playing") pauseGame();
    else if (state === "paused") resumeGame();
  }
});
window.addEventListener("blur", () => {
  if (state === "playing") pauseGame();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") pauseGame();
});

startBtn.addEventListener("click", startGame);
continueBtn.addEventListener("click", resumeGame);
restartBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", pauseGame);
settingsBtn.addEventListener("click", () => {
  muteToggle.checked = save.settings.muted;
  reducedMotionToggle.checked = save.settings.reducedMotion;
  settingsDialog.showModal();
});
settingsDialog.addEventListener("close", () => {
  if (settingsDialog.returnValue === "ok") {
    save.settings.muted = muteToggle.checked;
    save.settings.reducedMotion = reducedMotionToggle.checked;
    persist(); applySettings();
  }
});
resetSaveBtn.addEventListener("click", () => {
  if (confirm("최고 점수를 초기화할까요?")) resetSave();
});

applySettings();
resetRound();
showOverlay("역사 퀴즈를 시작하세요", "30초 안에 최대한 많은 문제를 맞히세요.", "start");
})();
