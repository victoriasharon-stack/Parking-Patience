const scenarios = [
  "A cart wobbles out of a row two lanes over. Someone's leaving.",
  "Brake lights flicker on near the front row. Could be nothing.",
  "A family loads groceries into a trunk, slow and unbothered.",
  "Someone's sitting in their car, not moving. Leaving, or just on their phone?",
  "Reverse lights. Real ones this time.",
  "A spot opens right by the entrance — everyone's seen it.",
  "Two spots down, someone's arguing with a shopping cart corral.",
  "It's raining. Nobody wants to walk far. This spot matters more.",
  "A delivery van double-parks, blocking the row. Everyone's stuck waiting anyway.",
  "Someone waves you off — they're saving it for a friend. Are they bluffing?",
  "A jogger cuts through the lot, oblivious to the standoff around them.",
  "The security guard's cart rolls by. Nobody wants to look too eager.",
  "Two spots open at once, on opposite ends. Split the difference or commit?",
  "It's getting dark. Headlights make it hard to tell who's actually leaving."
];

const drivers = [
  { name: "Minivan Dad", style: "aggressive", icon: "🚐" },
  { name: "Nervous Nelly", style: "cautious", icon: "🚗" },
  { name: "The Mirror", style: "mirror", icon: "🚙" }
];

let round = 0;
let score = 0;
let patience = 100;
let lastPlayerBid = 5;
const totalRounds = 8;

const roundNumEl = document.getElementById('roundNum');
const scoreNumEl = document.getElementById('scoreNum');
const patienceBar = document.getElementById('patience-bar');
const scenarioEl = document.getElementById('scenario');
const bidGrid = document.getElementById('bidGrid');
const bidArea = document.getElementById('bidArea');
const revealEl = document.getElementById('reveal');
const driverListEl = document.getElementById('driverList');
const resultTextEl = document.getElementById('resultText');
const nextBtn = document.getElementById('nextBtn');
const gameOverEl = document.getElementById('gameOver');
const scoreLineEl = document.getElementById('scoreLine');
const verdictEl = document.getElementById('verdict');
const restartBtn = document.getElementById('restartBtn');

// ---- Sound engine (all synthesized, no external files needed) ----
let audioCtx = null;
let soundOn = true;
let engineNodes = null;
function getCtx() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }

function startEngineHum() {
  if (!soundOn || engineNodes) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator(), osc2 = ctx.createOscillator();
  const gain = ctx.createGain(), filter = ctx.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = 220;
  osc.type = 'sawtooth'; osc.frequency.value = 45;
  osc2.type = 'sawtooth'; osc2.frequency.value = 46.5;
  gain.gain.value = 0.03;
  osc.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc2.start();
  engineNodes = { osc, osc2, gain };
}
function stopEngineHum() {
  if (!engineNodes) return;
  const { osc, osc2, gain } = engineNodes;
  gain.gain.setTargetAtTime(0, getCtx().currentTime, 0.1);
  osc.stop(getCtx().currentTime + 0.3); osc2.stop(getCtx().currentTime + 0.3);
  engineNodes = null;
}
function playClick() {
  if (!soundOn) return;
  const ctx = getCtx(), osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'square'; osc.frequency.value = 520; gain.gain.value = 0.05;
  osc.connect(gain); gain.connect(ctx.destination);
  gain.gain.setTargetAtTime(0, ctx.currentTime + 0.02, 0.03);
  osc.start(); osc.stop(ctx.currentTime + 0.1);
}
function playHonk() {
  if (!soundOn) return;
  const ctx = getCtx();
  [330, 262].forEach((freq, i) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = freq; gain.gain.value = 0.09;
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.setTargetAtTime(0, t + 0.15, 0.05);
    osc.start(t); osc.stop(t + 0.35);
  });
}
function playChime(win) {
  if (!soundOn) return;
  const ctx = getCtx();
  const notes = win ? [523, 659, 784, 1046] : [392, 330];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.value = freq; gain.gain.value = 0.001;
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.09;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.start(t); osc.stop(t + 0.4);
  });
}
document.getElementById('soundBtn').onclick = () => {
  soundOn = !soundOn;
  document.getElementById('soundBtn').textContent = soundOn ? '🔊' : '🔇';
  if (soundOn) { startEngineHum(); startMusic(); } else { stopEngineHum(); stopMusic(); }
};

// ---- Looping background music (bouncy synth bassline + melody) ----
let musicTimer = null;
let musicStep = 0;
const bassPattern = [110, 110, 146.8, 110, 130.8, 130.8, 98, 110];
const melodyPattern = [
  440, 0, 523, 0, 587, 0, 523, 440,
  392, 0, 440, 0, 523, 0, 440, 0
];

function playNote(freq, time, dur, type, vol) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(vol, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(time); osc.stop(time + dur + 0.05);
}

function startMusic() {
  if (!soundOn || musicTimer) return;
  const ctx = getCtx();
  const stepDur = 0.22;
  musicTimer = setInterval(() => {
    if (!soundOn) return;
    const t = ctx.currentTime + 0.02;
    const bassFreq = bassPattern[musicStep % bassPattern.length];
    playNote(bassFreq, t, stepDur * 0.9, 'triangle', 0.05);
    const melFreq = melodyPattern[musicStep % melodyPattern.length];
    if (melFreq > 0) playNote(melFreq, t, stepDur * 0.6, 'square', 0.025);
    musicStep++;
  }, stepDur * 1000);
}

function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; musicStep = 0; }
}

function confettiBurst() {
  const colors = ['#FF6B9D', '#FFD23F', '#5DC9F1', '#7ED957', '#9B5DE5'];
  for (let i = 0; i < 26; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = (Math.random() * 100) + 'vw';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
    c.style.width = c.style.height = (6 + Math.random() * 8) + 'px';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2800);
  }
}

function aiBid(driver) {
  let base;
  if (driver.style === "aggressive") base = 7 + Math.random() * 3;
  else if (driver.style === "cautious") base = 2 + Math.random() * 4;
  else base = lastPlayerBid + (Math.random() * 3 - 1.5);
  return Math.round(Math.max(1, Math.min(10, base)));
}

function startRound() {
  bidArea.style.display = 'block';
  revealEl.style.display = 'none';
  roundNumEl.textContent = round + 1;
  scenarioEl.textContent = scenarios[round % scenarios.length];
  bidGrid.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.className = 'bidBtn';
    btn.textContent = i;
    btn.onclick = () => playRound(i);
    bidGrid.appendChild(btn);
  }
}

function playRound(playerBid) {
  playClick();
  startEngineHum();
  startMusic();
  lastPlayerBid = playerBid;
  const results = [{ name: "You", bid: playerBid, isPlayer: true, icon: "🚕" }];
  drivers.forEach(d => results.push({ name: d.name, bid: aiBid(d), isPlayer: false, icon: d.icon }));

  const maxBid = Math.max(...results.map(r => r.bid));
  const winners = results.filter(r => r.bid === maxBid);
  patience -= playerBid;

  let resultMsg = "";
  if (winners.length > 1) {
    playHonk();
    if (winners.some(w => w.isPlayer)) {
      patience -= 10;
      resultMsg = `😬 Standoff! You and ${winners.filter(w=>!w.isPlayer).map(w=>w.name).join(", ")} both went ${maxBid}. Nobody moves. Everyone honks.`;
    } else {
      resultMsg = `📯 Standoff between ${winners.map(w=>w.name).join(" and ")}. Spot goes to neither. Not your problem!`;
    }
  } else {
    const winner = winners[0];
    if (winner.isPlayer) {
      score++;
      playChime(true);
      confettiBurst();
      resultMsg = `🎉 You committed hardest at ${maxBid}. The spot is yours!`;
    } else {
      playChime(false);
      resultMsg = `😅 ${winner.name} out-waited everyone with ${maxBid}. They pull in. You did not.`;
    }
  }

  patience = Math.max(0, patience);
  renderReveal(results, winners, resultMsg, maxBid);
}

function renderReveal(results, winners, resultMsg, maxBid) {
  bidArea.style.display = 'none';
  revealEl.style.display = 'block';
  driverListEl.innerHTML = '';

  results.forEach((r, idx) => {
    const row = document.createElement('div');
    row.className = 'driverRow';
    if (winners.length === 1 && r.bid === maxBid) row.classList.add('winner');
    if (winners.length > 1 && r.bid === maxBid) row.classList.add('tied');
    row.style.animationDelay = (idx * 0.12) + 's';
    row.innerHTML = `<span class="carIcon">${r.icon}</span><span class="name">${r.isPlayer ? 'You' : r.name}</span><span class="num">${r.bid}</span>`;
    driverListEl.appendChild(row);
  });

  resultTextEl.textContent = resultMsg;
  scoreNumEl.textContent = score;
  patienceBar.style.width = patience + '%';
  nextBtn.textContent = (patience <= 0) ? "See how it ends →" : "Next Round →";
}

nextBtn.onclick = () => {
  round++;
  if (round >= totalRounds || patience <= 0) endGame();
  else startRound();
};

function endGame() {
  stopEngineHum();
  stopMusic();
  bidArea.style.display = 'none';
  revealEl.style.display = 'none';
  gameOverEl.style.display = 'block';
  scoreLineEl.textContent = `You claimed ${score} out of ${round} spots. Patience left: ${patience} 😤`;

  let verdict;
  if (patience <= 0) verdict = "You ran out of patience before the lot ran out of cars. Somewhere, your engine is still running.";
  else if (score >= 6) { verdict = "You are the reason people hate parking lots. 👑"; confettiBurst(); }
  else if (score >= 3) verdict = "A reasonable number of spots, at a reasonable cost to your soul.";
  else verdict = "You gave up the spot almost every time. Some call that patience. Others call it a parking-lot personality disorder.";
  verdictEl.textContent = verdict;
}

restartBtn.onclick = () => {
  round = 0; score = 0; patience = 100; lastPlayerBid = 5;
  gameOverEl.style.display = 'none';
  patienceBar.style.width = '100%';
  startRound();
  startMusic();
};

startRound();