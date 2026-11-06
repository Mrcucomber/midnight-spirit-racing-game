/* ============================================================
   午夜之魂 / MIDNIGHT SPIRIT
   2D 第三人称首都高夜战 —— 单文件 Canvas 游戏
   ============================================================ */
'use strict';

/* ----------------------------- 基础工具 ----------------------------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const mod = (n, m) => ((n % m) + m) % m;
const pad = (n, len = 2) => String(Math.floor(n)).padStart(len, '0');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmtTime(sec, ms = true) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (!ms) return `${pad(m)}:${pad(s)}`;
  const milli = Math.floor((sec % 1) * 1000);
  return `${pad(m)}:${pad(s)}.${pad(milli, 3)}`;
}

function fmtGap(m) {
  const a = Math.abs(Math.round(m));
  return a === 0 ? '并排' : `${a} m`;
}

function kmh(v) { return Math.round(v * 3.6); }

function showFatal(err) {
  const el = document.getElementById('fatal');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = 'GAME ERROR\n' + (err && err.stack ? err.stack : String(err));
}
window.addEventListener('error', e => showFatal(e.error || e.message || 'Unknown error'));
window.addEventListener('unhandledrejection', e => showFatal(e.reason || 'Unhandled rejection'));

/* ----------------------------- 车辆数据 ----------------------------- */
const CARS = [
  {
    id: 'zero-z',
    name: 'ZERO-Z',
    sub: 'S30 · 3.1L TWIN TURBO',
    cls: 'BALANCED / FR',
    body: '#dfe8ef', light: '#ffffff', dark: '#77889a', accent: '#ff3b4e', accent2: '#ffc56d',
    topSpeed: 318, accel: 1.00, grip: 1.02,
    bars: { speed: 73, accel: 77, grip: 79 },
    labels: { speed: '318', accel: '8.2s', grip: 'A-' },
    desc: '沉寂多年的湾岸传说。轻量车身与高转双涡轮的组合，在两百公里之后才真正醒来。',
    special: '高转速 twin turbo：中后段加速凶猛，容错率均衡。',
    wing: false, livery: 'stripe'
  },
  {
    id: 'oni-gtr',
    name: 'ONI GT-R',
    sub: 'R34 · 2.8L TWIN TURBO',
    cls: 'POWER / AWD',
    body: '#202b3a', light: '#40566a', dark: '#090e15', accent: '#59e8ff', accent2: '#ffb35c',
    topSpeed: 327, accel: 1.14, grip: 0.91,
    bars: { speed: 84, accel: 89, grip: 68 },
    labels: { speed: '327', accel: '7.6s', grip: 'B+' },
    desc: '黑色四驱怪物。涡轮压力上来时像被一只看不见的手推着走，代价是车头更沉、更不肯转。',
    special: '直道怪物：极速与出弯爆发最强，连续弯道需要提前收油。',
    wing: true, livery: 'cyan'
  },
  {
    id: 'kaze-rx7',
    name: 'KAZE RX-7',
    sub: 'FD3S · 13B-REW',
    cls: 'AGILE / FR',
    body: '#f2f0e6', light: '#ffffff', dark: '#9c9a8c', accent: '#ffb14e', accent2: '#ff5f86',
    topSpeed: 306, accel: 1.05, grip: 1.16,
    bars: { speed: 67, accel: 80, grip: 94 },
    labels: { speed: '306', accel: '8.0s', grip: 'S-' },
    desc: '轻得像一片纸的转子机器。它不靠蛮力，靠的是在车流缝隙里写下的一条干净弧线。',
    special: '弯道猎手：转向响应最快，贴车流超车的容错更高。',
    wing: true, livery: 'amber'
  }
];

const RIVAL_DEF = {
  id: 'blackwing',
  name: 'BLACKWING',
  sub: '911 · 3.8L FLAT-6',
  driver: '岛达也',
  body: '#0d1218', light: '#334150', dark: '#030507', accent: '#ff2947', accent2: '#ffc35a',
  topSpeed: 326, accel: 1.10, grip: 1.00,
  wing: true, livery: 'gold', rival: true
};

const DEVIL_Z_DEF = {
  id: 'devil-z',
  name: 'DEVIL Z',
  sub: 'NISSAN S30 · 3.1L L28',
  driver: '朝仓晶夫',
  body: '#1c4f92', light: '#4f8fd4', dark: '#06172f', accent: '#ff2f45', accent2: '#edf7ff',
  topSpeed: 320, accel: 1.04, grip: 1.06,
  wing: false, livery: 'devil'
};

const SECRET_CARS = [DEVIL_Z_DEF, RIVAL_DEF];
const SECRET_CHASE_LEN = 4000;

// 原创致敬台词：不直接引用漫画/动画原文。
const CHASE_STORY = {
  devil: [
    { at: 30, who: 'rival', text: '又见面了，恶魔 Z。今晚的湾岸，只跑一趟。' },
    { at: 360, who: 'player', text: '追走战。你先走，我会跟上来。' },
    { at: 880, who: 'rival', text: '别让我等太久。我的后视镜里，不想看到空荡荡的路。' },
    { at: 1480, who: 'player', text: '这台 Z 的极限，连我自己都还没见过。' },
    { at: 2160, who: 'rival', text: '手术台上不能犹豫。方向盘上，也一样。' },
    { at: 2960, who: 'player', text: '那就别眨眼。' }
  ],
  blackwing: [
    { at: 30, who: 'rival', text: '黑色保时捷……今晚换你来追我？' },
    { at: 360, who: 'player', text: '我只想确认一件事。那台 Z，究竟是不是被诅咒了。' },
    { at: 880, who: 'rival', text: '那你最好跟紧。被甩掉的话，答案就留在风里了。' },
    { at: 1480, who: 'player', text: '湾岸的夜，会替我做判断。' },
    { at: 2160, who: 'rival', text: '别在时速三百的时候思考人生。' },
    { at: 2960, who: 'player', text: '我从不犹豫。' }
  ]
};

const LANE_X = [-5.55, -1.85, 1.85, 5.55];
const ROAD_HALF = 7.8;
const START_S = 40;
const RACE_LEN = 8000;
const FINISH_S = START_S + RACE_LEN;
const CAM_BACK = 2.7;
const CAM_HEIGHT = 1.34;

const ZONES = [
  { a: 0, b: 1500, name: 'BAYSIDE', jp: '湾岸線', flavor: 'TOKYO BAY SHORE', tint: '#6df3ff' },
  { a: 1500, b: 2600, name: 'C1 TUNNEL', jp: '都心環状', flavor: 'C1 UNDERGROUND', tint: '#ffb64e', tunnel: true },
  { a: 2600, b: 4300, name: 'WANGAN', jp: '湾岸線', flavor: 'WANGAN SOUTHBOUND', tint: '#6df3ff' },
  { a: 4300, b: 5300, name: 'RAINBOW BRIDGE', jp: '彩虹橋', flavor: 'RAINBOW BRIDGE', tint: '#ff70b7' },
  { a: 5300, b: 7200, name: 'WANGAN STRAIGHT', jp: '湾岸直線', flavor: 'FINAL STRAIGHT', tint: '#b8ff95' },
  { a: 7200, b: 99999, name: 'FINISH', jp: 'FINISH LINE', flavor: 'CHECKERED FLAG', tint: '#ffffff' }
];

function zoneAt(s) {
  for (let i = 0; i < ZONES.length; i++) if (s >= ZONES[i].a && s < ZONES[i].b) return ZONES[i];
  return ZONES[ZONES.length - 1];
}
function isTunnelAt(s) {
  const z = zoneAt(s);
  return !!z.tunnel;
}

/* ----------------------------- 路线 / 透视 ----------------------------- */
const ROUTE_STEP = 2;
const routePts = [];

function routeCurve(s) {
  let k = 0;
  const turn = (a, b, amt) => {
    if (s > a && s < b) {
      const u = (s - a) / (b - a);
      k += Math.sin(u * Math.PI) * amt;
    }
  };
  turn(420, 1220, 0.00105);
  turn(1260, 1840, -0.00072);
  turn(2160, 2740, -0.00118);
  turn(2860, 3380, 0.00064);
  turn(3520, 4130, 0.00112);
  turn(4380, 4820, 0.00070);
  turn(4980, 5240, -0.00056);
  turn(5460, 5940, -0.00092);
  turn(6140, 6780, 0.00084);
  turn(7040, 7360, -0.00050);
  k += 0.00009 * Math.sin(s / 95) + 0.000035 * Math.sin(s / 37 + 2.2);
  return k;
}

function routeElevation(s) {
  return 2.3 * Math.sin(s / 720) + 1.15 * Math.sin(s / 293 + 1.1) + 0.42 * Math.sin(s / 117 + 0.2);
}

function buildRoute() {
  let x = 0, z = 0, th = 0;
  for (let s = 0; s <= FINISH_S + 750; s += ROUTE_STEP) {
    routePts.push({ s, x, y: routeElevation(s), z, th });
    const k = routeCurve(s + ROUTE_STEP * 0.5);
    th += k * ROUTE_STEP;
    x += Math.sin(th) * ROUTE_STEP;
    z += Math.cos(th) * ROUTE_STEP;
  }
}
buildRoute();

function sampleRoute(s) {
  s = clamp(s, 0, (routePts.length - 1) * ROUTE_STEP);
  const fi = s / ROUTE_STEP;
  const i = Math.min(routePts.length - 2, Math.floor(fi));
  const f = fi - i;
  const a = routePts[i], b = routePts[i + 1];
  return {
    s,
    x: lerp(a.x, b.x, f),
    y: lerp(a.y, b.y, f),
    z: lerp(a.z, b.z, f),
    th: lerp(a.th, b.th, f)
  };
}

function projectPoint(x, y, z) {
  const cam = world.cam;
  if (!cam) return null;
  const dx = x - cam.x;
  const dz = z - cam.z;
  const sin = Math.sin(cam.th);
  const cos = Math.cos(cam.th);
  const fwd = dx * sin + dz * cos;
  if (fwd < 0.82) return null;
  const lat = dx * cos - dz * sin;
  const scale = FOCAL / fwd;
  return {
    x: W * 0.5 + lat * scale,
    y: HORIZON + (cam.y - y) * scale,
    scale,
    fwd,
    lat
  };
}

function projectAt(s, lateral, up = 0) {
  const q = sampleRoute(s);
  const rx = Math.cos(q.th), rz = -Math.sin(q.th);
  return projectPoint(q.x + rx * lateral, q.y + up, q.z + rz * lateral);
}

function projectOn(q, lateral, up = 0) {
  const rx = Math.cos(q.th), rz = -Math.sin(q.th);
  return projectPoint(q.x + rx * lateral, q.y + up, q.z + rz * lateral);
}

/* ----------------------------- 画布 / 全局状态 ----------------------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let W = 1, H = 1, DPR = 1;
let HORIZON = 300;
let FOCAL = 700;

let mode = 'menu';             // menu | garage | race | paused | result
let race = null;
let selectedCar = 0;
let attract = null;
let debugAuto = false;
let lastFrame = 0;
let uiTime = 0;

const SECRET_PHRASE = 'wangan midnight';
const secretMode = {
  active: false,
  unlocked: false,
  trafficCollision: false,
  buffer: '',
  timer: 0
};
let secretCarIndex = 0;

const world = { cam: null };

const visuals = {
  time: 0,
  shake: 0,
  flash: 0,
  flashColor: '255,255,255',
  sparks: []
};

const keys = { up: false, down: false, left: false, right: false, nitro: false };
const touchState = { up: false, down: false, left: false, right: false, nitro: false };

const UI = {};
function cacheUI() {
  [
    'menu', 'garage', 'hud', 'pause', 'result', 'secretMenu', 'fatal',
    'btnStart', 'btnHelp', 'helpPanel', 'btnHelpClose', 'bestTime', 'menuCarName', 'menuCarSub', 'menuCarClass', 'menuCarDots',
    'btnSecretRace', 'btnSecretClose', 'secretTitle', 'secretPreview', 'secretPreviewTag', 'secretCarOptions',
    'secretDesc', 'secretRival', 'secretWatermark', 'btnTrafficCollision', 'secretCollisionState',
    'storyBox', 'storyKicker', 'storyChapter', 'storySpeaker',
    'storyYou', 'storyText',
    'btnBack', 'carPreview', 'previewTag', 'carIndex', 'carName', 'carSub', 'carDesc',
    'statSpeed', 'statAccel', 'statGrip', 'statSpeedVal', 'statAccelVal', 'statGripVal', 'carSpecial',
    'btnRace', 'carCards', 'btnCarPrev', 'btnCarNext', 'spBattleTag', 'playerSpBar', 'playerSpText', 'rivalShort', 'rivalSpBar', 'rivalSpText',
    'zoneJp', 'zoneName', 'progressFill', 'playerPin', 'rivalPin', 'gapText', 'positionText',
    'raceTimer', 'remainDist', 'topSpeedHud', 'centerMessage', 'msgKicker', 'msgTitle', 'msgSub',
    'popupLayer', 'battleGlow', 'hudCarName', 'comboHud', 'comboVal', 'nitroSegments', 'nitroPct',
    'rpmFill', 'speedVal', 'gearVal', 'shiftHint', 'touchControls', 'zoneFlavor',
    'btnResume', 'btnRestartPause', 'btnQuitPause', 'btnAgain', 'btnGarage', 'btnMenu', 'btnMute',
    'resultKicker', 'resultTitle', 'resultSub', 'resTime', 'resTopSpeed', 'resDistance', 'resNearMiss',
    'resHits', 'resSp', 'resGrade', 'resRecord', 'toast', 'rotateHint'
  ].forEach(id => { UI[id] = document.getElementById(id); });
}

/* ----------------------------- 天际线生成 ----------------------------- */
let skyFar = null;
let skyNear = null;
let stars = [];
const glowSprites = {};

function makeSkyline(width, height, seed, opts) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.ceil(width));
  c.height = Math.max(2, Math.ceil(height));
  const g = c.getContext('2d');
  const rnd = mulberry32(seed);
  let x = -30;
  while (x < c.width + 30) {
    const bw = rnd() * (opts.maxW - opts.minW) + opts.minW;
    const bh = rnd() * (opts.maxH - opts.minH) + opts.minH;
    const top = c.height - bh;
    const shade = Math.floor(rnd() * 3);
    g.fillStyle = opts.colors[shade];
    g.fillRect(x, top, bw, bh + 2);

    // 屋顶轮廓
    if (rnd() > 0.7) {
      g.fillRect(x + bw * 0.3, top - 4 - rnd() * 10, bw * 0.4, 18);
    }
    if (rnd() > 0.82) {
      g.fillRect(x + bw * 0.48, top - 14 - rnd() * 16, 1.5, 22);
      g.fillStyle = '#ff4a5f';
      g.fillRect(x + bw * 0.48, top - 15 - rnd() * 3, 1.5, 1.5);
    }

    // 窗户
    const winColor = rnd() > 0.82 ? opts.warm : opts.cool;
    for (let wy = top + 5; wy < c.height - 4; wy += opts.winGap) {
      for (let wx = x + 4; wx < x + bw - 3; wx += opts.winGap) {
        if (rnd() > opts.lit) {
          g.fillStyle = rnd() > 0.75 ? opts.warm : winColor;
          g.globalAlpha = 0.35 + rnd() * 0.5;
          g.fillRect(wx, wy, opts.winSize, opts.winSize * 0.72);
        }
      }
    }
    g.globalAlpha = 1;
    x += bw + opts.gap + rnd() * 9;
  }
  return c;
}

function makeGlowSprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(0.18, color.replace('1)', '0.75)'));
  grad.addColorStop(0.48, color.replace('1)', '0.18)'));
  grad.addColorStop(1, color.replace('1)', '0)'));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

function rebuildBackdrop() {
  skyFar = makeSkyline(W * 2.4, H * 0.25, 8127, {
    minW: 24, maxW: 72, minH: H * 0.05, maxH: H * 0.24,
    colors: ['#0a1521', '#08121d', '#0c1824'], cool: '#7ad9ef', warm: '#ffbf70',
    winGap: 7, winSize: 2, lit: 0.62, gap: 3
  });
  skyNear = makeSkyline(W * 2.4, H * 0.17, 4431, {
    minW: 36, maxW: 96, minH: H * 0.035, maxH: H * 0.16,
    colors: ['#050b12', '#04090f', '#060d15'], cool: '#7bdff7', warm: '#ffbd6a',
    winGap: 8, winSize: 2, lit: 0.56, gap: 5
  });

  const rnd = mulberry32(8821);
  stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: rnd() * W,
      y: rnd() * HORIZON * 0.72,
      r: rnd() * 1.2 + 0.25,
      a: rnd() * 0.55 + 0.15,
      ph: rnd() * TAU
    });
  }

  glowSprites.white = makeGlowSprite('rgba(255,255,255,1)');
  glowSprites.cyan = makeGlowSprite('rgba(99,239,255,1)');
  glowSprites.red = makeGlowSprite('rgba(255,55,82,1)');
  glowSprites.amber = makeGlowSprite('rgba(255,182,78,1)');
  glowSprites.pink = makeGlowSprite('rgba(255,88,155,1)');
}

/* ----------------------------- 音效 / 音乐 ----------------------------- */
const audio = {
  ctx: null, master: null, musicBus: null, engineBus: null, sfxBus: null,
  eng1: null, eng2: null, engineFilter: null, windGain: null,
  muted: false, ready: false, nextNote: 0, step: 0, timer: null,

  init() {
    if (this.ctx || this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ac = this.ctx = new AC();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 16;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      comp.connect(ac.destination);

      this.master = ac.createGain();
      this.master.gain.value = this.muted ? 0 : 0.62;
      this.master.connect(comp);

      this.musicBus = ac.createGain();
      this.musicBus.gain.value = 0.075;
      this.musicBus.connect(this.master);

      this.engineBus = ac.createGain();
      this.engineBus.gain.value = 0.55;
      this.engineBus.connect(this.master);

      this.sfxBus = ac.createGain();
      this.sfxBus.gain.value = 0.6;
      this.sfxBus.connect(this.master);

      // 引擎
      this.engineFilter = ac.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineFilter.Q.value = 1.4;
      this.engineFilter.connect(this.engineBus);

      this.engineGain = ac.createGain();
      this.engineGain.gain.value = 0;
      this.engineGain.connect(this.engineFilter);

      this.eng1 = ac.createOscillator();
      this.eng1.type = 'sawtooth';
      this.eng1.frequency.value = 58;
      this.eng2 = ac.createOscillator();
      this.eng2.type = 'square';
      this.eng2.frequency.value = 117;
      const g1 = ac.createGain(); g1.gain.value = 0.28;
      const g2 = ac.createGain(); g2.gain.value = 0.12;
      this.eng1.connect(g1); g1.connect(this.engineGain);
      this.eng2.connect(g2); g2.connect(this.engineGain);
      this.eng1.start(); this.eng2.start();

      // 风噪
      const len = ac.sampleRate * 2;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
      const noise = ac.createBufferSource();
      noise.buffer = buf; noise.loop = true;
      const nf = ac.createBiquadFilter();
      nf.type = 'bandpass'; nf.frequency.value = 1200; nf.Q.value = 0.5;
      this.windGain = ac.createGain();
      this.windGain.gain.value = 0;
      noise.connect(nf); nf.connect(this.windGain); this.windGain.connect(this.master);
      noise.start();

      this.ready = true;
      this.nextNote = ac.currentTime + 0.2;
      this.timer = setInterval(() => this.schedule(), 110);
    } catch (e) {
      console.warn('Audio unavailable', e);
    }
  },

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.62, this.ctx.currentTime, 0.03);
    UI.btnMute.classList.toggle('muted', m);
    UI.btnMute.textContent = m ? '×' : '♪';
  },

  updateEngine(speed, maxSpeed, rpm, throttle, nitro, active) {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    const norm = clamp(speed / Math.max(1, maxSpeed), 0, 1.2);
    const f = 40 + rpm * 0.0155 + norm * 14;
    this.eng1.frequency.setTargetAtTime(f, t, 0.045);
    this.eng2.frequency.setTargetAtTime(f * 2.01, t, 0.045);
    this.engineFilter.frequency.setTargetAtTime(280 + norm * 1050 + (nitro ? 500 : 0), t, 0.08);
    const gain = active ? (0.028 + norm * 0.075 + (nitro ? 0.035 : 0)) : 0.012;
    this.engineGain.gain.setTargetAtTime(gain, t, 0.08);
    this.windGain.gain.setTargetAtTime(active ? Math.pow(norm, 2) * 0.16 : 0.01, t, 0.1);
    this.musicBus.gain.setTargetAtTime(active ? 0.105 : 0.06, t, 0.5);
  },

  blip(freq = 600, dur = 0.08, type = 'sine', vol = 0.13) {
    if (!this.ready || !this.ctx) return;
    const ac = this.ctx;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(this.sfxBus);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  },

  noiseBurst(dur = 0.25, vol = 0.25, freq = 700, type = 'lowpass') {
    if (!this.ready || !this.ctx) return;
    const ac = this.ctx;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start();
  },

  crash() {
    this.noiseBurst(0.42, 0.42, 620);
    this.blip(90, 0.35, 'sawtooth', 0.18);
  },

  wall() {
    this.noiseBurst(0.2, 0.22, 1500, 'highpass');
    this.blip(140, 0.12, 'square', 0.06);
  },

  nearMiss() {
    this.noiseBurst(0.18, 0.13, 2400, 'bandpass');
    this.blip(980, 0.07, 'sine', 0.045);
  },

  nitro() {
    this.noiseBurst(0.65, 0.2, 600, 'bandpass');
    this.blip(180, 0.4, 'sawtooth', 0.08);
  },

  count() { this.blip(520, 0.09, 'square', 0.1); },
  go() { this.blip(880, 0.16, 'square', 0.12); setTimeout(() => this.blip(1320, 0.25, 'square', 0.08), 90); },

  finish(win) {
    const base = win ? 523 : 220;
    [0, 4, 7, 12].forEach((semi, i) => {
      setTimeout(() => this.blip(base * Math.pow(2, semi / 12), 0.55, win ? 'triangle' : 'sawtooth', 0.08), i * 150);
    });
  },

  secretUnlock() {
    const notes = [196, 247, 294, 392, 494, 588];
    notes.forEach((freq, i) => {
      setTimeout(() => this.blip(freq, 0.22, i < 3 ? 'sawtooth' : 'triangle', 0.075), i * 90);
    });
    this.noiseBurst(0.55, 0.12, 1600, 'bandpass');
  },

  pause() {
    if (!this.ready) return;
    this.engineGain.gain.setTargetAtTime(0.002, this.ctx.currentTime, 0.08);
    this.windGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.08);
    this.musicBus.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.2);
  },

  /* 极简 synthwave 循环 */
  schedule() {
    if (!this.ready || !this.ctx) return;
    const ac = this.ctx;
    const stepDur = 60 / 112 / 4;
    while (this.nextNote < ac.currentTime + 0.3) {
      this.playStep(this.step, this.nextNote);
      this.nextNote += stepDur;
      this.step = (this.step + 1) % 128;
    }
  },

  playStep(step, when) {
    const ac = this.ctx;
    const roots = [45, 41, 48, 43]; // A2 F2 C3 G2
    const chord = roots[Math.floor(step / 32) % 4];
    const barStep = step % 16;
    const stepInBeat = step % 4;

    if (stepInBeat === 0) {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(120, when);
      o.frequency.exponentialRampToValueAtTime(42, when + 0.16);
      g.gain.setValueAtTime(0.17, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.24);
      o.connect(g); g.connect(this.musicBus); o.start(when); o.stop(when + 0.26);
    }
    if (barStep === 4 || barStep === 12) {
      const len = 0.13;
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1600;
      const g = ac.createGain(); g.gain.setValueAtTime(0.08, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + len);
      src.connect(f); f.connect(g); g.connect(this.musicBus); src.start(when);
    }
    if (step % 2 === 1) {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = 'square';
      o.frequency.value = 7000;
      g.gain.setValueAtTime(0.012, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.025);
      o.connect(g); g.connect(this.musicBus); o.start(when); o.stop(when + 0.03);
    }
    if (step % 8 === 0 || step % 8 === 6) {
      const midi = chord - 12;
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const o = ac.createOscillator(); const g = ac.createGain();
      const flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 280;
      o.type = 'sawtooth'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.06, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.5);
      o.connect(flt); flt.connect(g); g.connect(this.musicBus);
      o.start(when); o.stop(when + 0.52);
    }
    if (step % 2 === 0) {
      const arp = [0, 7, 12, 7, 15, 12, 7, 19][Math.floor(step / 2) % 8];
      const midi = chord + 12 + arp;
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.025, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
      o.connect(g); g.connect(this.musicBus); o.start(when); o.stop(when + 0.2);
    }
  }
};

/* ----------------------------- 交通车辆 ----------------------------- */
const TRAFFIC_TYPES = [
  { id: 'sedan', w: 1.82, h: 1.35, speed: [21, 31], colors: ['#5b6874', '#384b5a', '#6d3e46', '#365967', '#8a877d'], roof: '#1b252e' },
  { id: 'van', w: 2.02, h: 1.92, speed: [19, 27], colors: ['#b9bcb7', '#3c515f', '#6e7378', '#8e4e3e'], roof: '#202b33' },
  { id: 'truck', w: 2.46, h: 3.05, speed: [17, 23], colors: ['#7d858b', '#515a63', '#8f5b38', '#314b62'], roof: '#1a222a' },
  { id: 'taxi', w: 1.8, h: 1.42, speed: [22, 30], colors: ['#b89635', '#a9852c'], roof: '#3b3320' },
  { id: 'sports', w: 1.86, h: 1.18, speed: [26, 36], colors: ['#8c2534', '#e1e4e2', '#273c55', '#303034'], roof: '#11161c' }
];

// 碰撞箱刻意比车身贴图收窄，留出擦身而过的空间。
// 玩家和交通车各取一半宽度/长度，相加后才是中心距离阈值。
const PLAYER_HITBOX = { halfW: 0.55, halfL: 1.55 };
const TRAFFIC_HITBOX = {
  sedan: { halfW: 0.75, halfL: 1.90 },
  van: { halfW: 0.86, halfL: 2.20 },
  truck: { halfW: 1.08, halfL: 2.55 },
  taxi: { halfW: 0.72, halfL: 1.85 },
  sports: { halfW: 0.78, halfL: 1.85 }
};

function trafficHitbox(t) {
  return TRAFFIC_HITBOX[t.type] || TRAFFIC_HITBOX.sedan;
}

let trafficId = 0;
function createTrafficAt(s, lane, forceType) {
  const type = forceType || (Math.random() < 0.07 ? TRAFFIC_TYPES[2] : Math.random() < 0.16 ? TRAFFIC_TYPES[3] : pick(TRAFFIC_TYPES));
  const color = pick(type.colors);
  return {
    id: ++trafficId,
    s,
    lane,
    x: LANE_X[lane],
    speed: rand(type.speed[0], type.speed[1]),
    type: type.id,
    w: type.w,
    h: type.h,
    color,
    roof: type.roof,
    taillight: Math.random() < 0.18 ? '#ffd27b' : '#ff253c',
    hitCd: 0,
    nearMissed: false,
    laneTimer: rand(3, 10),
    targetLane: lane,
    aiWeave: Math.random() < 0.28
  };
}

function createTrafficField(baseS, count = 20) {
  const list = [];
  let s = baseS + 185;
  for (let i = 0; i < count; i++) {
    s += rand(42, 100);
    let lane = randInt(0, 3);
    if (i > 2 && list[list.length - 1].lane === lane && s - list[list.length - 1].s < 25) {
      lane = (lane + 2) % 4;
    }
    list.push(createTrafficAt(s, lane));
  }
  return list;
}

function recycleTraffic(t, refS) {
  let lane = randInt(0, 3);
  t.s = refS + rand(720, 1260);
  t.lane = lane;
  t.targetLane = lane;
  t.x = LANE_X[lane];
  t.speed = rand(18, 32);
  t.hitCd = 0;
  t.nearMissed = false;
  t.laneTimer = rand(3, 10);
  t.aiWeave = Math.random() < 0.24;
  if (Math.random() < 0.08) {
    t.type = 'truck'; t.w = 2.46; t.h = 3.05; t.color = pick(TRAFFIC_TYPES[2].colors); t.roof = '#1a222a';
  }
}

function updateTrafficList(list, refS, dt) {
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    t.s += t.speed * dt;
    t.hitCd = Math.max(0, t.hitCd - dt);
    t.laneTimer -= dt;
    if (t.aiWeave && t.laneTimer <= 0 && t.type !== 'truck') {
      t.targetLane = clamp(t.lane + (Math.random() < 0.5 ? -1 : 1), 0, 3);
      t.laneTimer = rand(4, 11);
    }
    t.lane = t.targetLane;
    t.x = damp(t.x, LANE_X[t.lane], 1.25, dt);
    if (t.s < refS - 95 || t.s > refS + 1280) recycleTraffic(t, refS);
  }
}

/* ----------------------------- 车手 / 比赛状态 ----------------------------- */
function createRacer(def, isPlayer) {
  return {
    def,
    isPlayer,
    s: START_S + (isPlayer ? -2.2 : 1.4),
    x: isPlayer ? LANE_X[1] : LANE_X[2],
    speed: 32,
    steer: 0,
    sp: 1000,
    nitro: isPlayer ? 100 : 100,
    topSpeed: 0,
    hits: 0,
    nearMisses: 0,
    combo: 0,
    wallCd: 0,
    collisionCd: 0,
    lastWallMsg: -10,
    gear: 2,
    rpm: 2600,
    boostVisual: false,
    lane: 2,
    targetLane: 2,
    aiTimer: 0,
    nitroWas: false
  };
}

function createRace(carDef, rivalDef = RIVAL_DEF) {
  const isSecret = secretMode.active;
  const player = createRacer(carDef, true);
  const rival = createRacer(rivalDef, false);
  const finishS = isSecret ? START_S + SECRET_CHASE_LEN : FINISH_S;
  const r = {
    player,
    rival,
    rivalDef,
    secret: isSecret,
    story: isSecret,
    trafficCollision: isSecret ? secretMode.trafficCollision : true,
    storyScript: isSecret ? CHASE_STORY[secretCarIndex === 0 ? 'devil' : 'blackwing'] : [],
    storyIndex: 0,
    storyActive: false,
    storyUntil: 0,
    storyReveal: 0,
    storyText: '',
    storyStartedAt: 0,
    finishS,
    raceLen: finishS - START_S,
    rivalFinished: false,
    traffic: [],
    countdown: 2.999,
    started: false,
    over: false,
    win: false,
    reason: '',
    time: 0,
    resultTimer: 0,
    resultShown: false,
    camLateral: player.x,
    camYaw: 0,
    battle: 0,
    gap: 0,
    msgTimer: 0,
    zone: zoneAt(player.s),
    zoneChanged: 0,
    lastCount: 3,
    finishSpeed: 0,
    newRecord: false,
    finalWarn: false,
    debugAuto: debugAuto
  };
  if (isSecret) {
    player.s = START_S;
    rival.s = START_S + 48;
    rival.x = LANE_X[2];
    rival.lane = 2;
    rival.targetLane = 2;
    r.zone = zoneAt(player.s);
    r.traffic = createTrafficField(player.s, 18);
  } else {
    r.traffic = createTrafficField(player.s, 21);
  }
  return r;
}

function startRace(carIndex = selectedCar) {
  selectedCar = clamp(carIndex, 0, CARS.length - 1);
  const isSecret = secretMode.active;
  const playerDef = isSecret ? SECRET_CARS[secretCarIndex] : CARS[selectedCar];
  const rivalDef = isSecret ? SECRET_CARS[1 - secretCarIndex] : RIVAL_DEF;
  audio.resume();
  audio.blip(660, 0.09, 'square', 0.08);
  race = createRace(playerDef, rivalDef);
  mode = 'race';
  document.body.classList.add('racing');
  document.body.classList.toggle('secret-on', isSecret);
  UI.secretMenu.classList.add('hidden');
  hideStoryBox();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  keys.up = keys.down = keys.left = keys.right = keys.nitro = false;
  attachCarUI(selectedCar);
  hideScreensForRace();
  showHudHUD();
  UI.hudCarName.textContent = playerDef.name;
  UI.rivalShort.textContent = rivalDef.name;
  UI.spBattleTag.textContent = isSecret ? 'INVINCIBLE' : 'SP BATTLE';
  UI.spBattleTag.classList.toggle('invincible', isSecret);
  UI.zoneJp.textContent = zoneAt(race.player.s).jp;
  UI.zoneName.textContent = zoneAt(race.player.s).name;
  UI.zoneFlavor.textContent = zoneAt(race.player.s).flavor;
  UI.comboHud.classList.remove('on');
  UI.battleGlow.classList.remove('on');
  UI.spBattleTag.classList.remove('on');
  UI.centerMessage.className = 'center-message';
  UI.progressFill.style.width = '0%';
  UI.playerPin.style.left = '0%';
  UI.rivalPin.style.left = '0%';
  visuals.sparks.length = 0;
  visuals.shake = 0;
  visuals.flash = 0;
  showMessage(
    isSecret ? `追走战 // ${playerDef.name} → ${rivalDef.name}` : 'WANGAN BATTLE // VS BLACKWING',
    '3',
    isSecret ? `4.0 KM · 目标 ${rivalDef.name}` : '首都高湾岸線 · 8.0 KM',
    'count',
    0.9
  );
  audio.count();
  updateCameraRace(0.016, true);
  updateHud(0);
  if (race.debugAuto) debugAuto = true;
}

function updateCameraRace(dt, snap = false) {
  if (!race) return;
  const p = race.player;
  const camS = p.s - CAM_BACK;
  const q = sampleRoute(camS);
  const follow = W < 700 ? 0.985 : 0.9;
  race.camLateral = snap ? p.x * follow : damp(race.camLateral, p.x * follow, 9.5, dt);
  race.camYaw = snap ? p.steer * 0.022 : damp(race.camYaw, p.steer * 0.022, 6, dt);
  const rx = Math.cos(q.th), rz = -Math.sin(q.th);
  world.cam = {
    s: camS,
    lateral: race.camLateral,
    x: q.x + rx * race.camLateral,
    y: q.y + CAM_HEIGHT,
    z: q.z + rz * race.camLateral,
    th: q.th + race.camYaw
  };
}

function updateCameraAttract(dt) {
  if (!attract) return;
  const camS = attract.s - CAM_BACK;
  const q = sampleRoute(camS);
  const camLat = attract.lateral - (W > 700 ? 0.9 : 0);
  attract.camLateral = camLat;
  attract.camYaw = attract.steer * 0.012;
  const rx = Math.cos(q.th), rz = -Math.sin(q.th);
  world.cam = {
    s: camS,
    lateral: camLat,
    x: q.x + rx * camLat,
    y: q.y + CAM_HEIGHT,
    z: q.z + rz * camLat,
    th: q.th + attract.camYaw
  };
}

function initAttract() {
  attract = {
    s: 430,
    lateral: 0.6,
    speed: 35,
    t: 0,
    steer: 0,
    camLateral: 0,
    camYaw: 0,
    traffic: createTrafficField(430, 17)
  };
  updateCameraAttract(0.016);
}

function updateAttract(dt) {
  attract.t += dt;
  attract.s += attract.speed * dt;
  attract.lateral = Math.sin(attract.t * 0.21) * 3.4 + Math.sin(attract.t * 0.071 + 1.2) * 0.8;
  attract.steer = Math.cos(attract.t * 0.21) * 0.52;
  if (attract.s > FINISH_S - 500) attract.s = START_S + 320;
  updateTrafficList(attract.traffic, attract.s, dt);
  updateCameraAttract(dt);
}

/* ----------------------------- 玩家物理 ----------------------------- */
function computeGear(speed, maxSpeed) {
  const bands = [0.145, 0.285, 0.44, 0.615, 0.805, 1.02];
  const ratio = clamp(speed / Math.max(maxSpeed, 1), 0, 1.02);
  let i = 0;
  while (i < bands.length - 1 && ratio > bands[i]) i++;
  const lo = i === 0 ? 0 : bands[i - 1];
  const hi = bands[i];
  const local = clamp((ratio - lo) / Math.max(0.001, hi - lo), 0, 1);
  return { gear: i + 1, rpm: 1100 + local * 7800 };
}

function debugSteer(dt) {
  if (!race || !debugAuto) return 0;
  const p = race.player;
  let bestLane = 1, bestGap = -1;
  for (let lane = 0; lane < 4; lane++) {
    let gap = 180;
    for (const t of race.traffic) {
      if (t.lane !== lane) continue;
      const ds = t.s - p.s;
      if (ds > 0 && ds < gap) gap = ds;
    }
    if (gap > bestGap) { bestGap = gap; bestLane = lane; }
  }
  const target = LANE_X[bestLane];
  return clamp((target - p.x) * 0.55, -1, 1);
}

function addWallHit(p) {
  p.sp = Math.max(0, p.sp - 32);
  p.speed *= 0.955;
  visuals.shake = Math.min(1.3, visuals.shake + 0.5);
  visuals.flash = Math.max(visuals.flash, 0.18);
  visuals.flashColor = '255,80,82';
  audio.wall();
  if (race.time - p.lastWallMsg > 1.6) {
    p.lastWallMsg = race.time;
    popup('刮墙 / WALL -32 SP', 'warn');
  }
  const pos = projectAt(p.s, p.x, 0.7);
  if (pos) spawnSparks(pos.x, pos.y, 10, '#ffd28a');
  p.wallCd = 0.32;
}

function addCollision(p, t, isPlayer) {
  p.hits++;
  p.collisionCd = 1.15;
  p.combo = 0;
  t.hitCd = 1.35;
  const box = trafficHitbox(t);
  if (isPlayer) {
    const invincible = !!race.secret;
    if (!invincible) p.sp = Math.max(0, p.sp - 66);
    p.s = Math.min(p.s, t.s - (box.halfL + 2.0));
    p.speed = Math.min(p.speed * 0.45, t.speed * 0.72);
    p.x += (p.x >= t.x ? 1 : -1) * 0.8;
    p.x = clamp(p.x, -6.95, 6.95);
    visuals.shake = Math.min(1.4, visuals.shake + 0.95);
    visuals.flash = 0.6;
    visuals.flashColor = '255,66,80';
    audio.crash();
    popup(invincible ? '追尾 / TRAFFIC HIT · SP 锁定' : '追尾 / TRAFFIC HIT -66 SP', 'warn');
    const pos = projectAt(p.s, p.x, 0.8);
    if (pos) spawnSparks(pos.x, pos.y, 26, '#ffcf74');
  } else {
    p.sp = Math.max(0, p.sp - 52);
    p.s = Math.min(p.s, t.s - (box.halfL + 2.2));
    p.speed = Math.min(p.speed * 0.55, t.speed * 0.8);
    visuals.shake = Math.max(visuals.shake, 0.18);
    if (Math.random() < 0.7) popup('对手追尾 / RIVAL HIT', 'gold');
    const pos = projectAt(p.s, p.x, 0.8);
    if (pos) spawnSparks(pos.x, pos.y, 14, '#ffd28a');
  }
  t.speed = clamp(t.speed - 2.2, 12, 40);
}

function checkTrafficCollision(p, isPlayer) {
  if (p.collisionCd > 0) return;
  for (const t of race.traffic) {
    if (t.hitCd > 0) continue;
    const box = trafficHitbox(t);
    const ds = Math.abs(p.s - t.s);
    if (ds > box.halfL + PLAYER_HITBOX.halfL) continue;
    const lat = Math.abs(p.x - t.x);
    if (lat < box.halfW + PLAYER_HITBOX.halfW) {
      addCollision(p, t, isPlayer);
      break;
    }
  }
}

function checkNearMiss(dt) {
  const p = race.player;
  if (p.speed < 42) return;
  for (const t of race.traffic) {
    const ds = p.s - t.s;
    const box = trafficHitbox(t);
    const safeGap = box.halfW + PLAYER_HITBOX.halfW;
    const dx = Math.abs(p.x - t.x);
    if (!t.nearMissed && Math.abs(ds) < 4.2 && dx > safeGap + 0.14 && dx < safeGap + 2.15) {
      t.nearMissed = true;
      p.nearMisses++;
      p.combo++;
      p.nitro = Math.min(100, p.nitro + 6.5);
      audio.nearMiss();
      if (p.combo % 3 === 0) {
        popup(`NEAR MISS ×${p.combo}  +N₂O`, 'gold');
      }
      const pos = projectAt(t.s, t.x, 1.0);
      if (pos) spawnSparks(pos.x, pos.y, 4, '#8ff7ff');
    }
    if (Math.abs(ds) > 32) t.nearMissed = false;
  }
}

function updatePlayer(dt) {
  const p = race.player;
  const r = race;
  const active = r.started && !r.over;
  const inputThrottle = active && (keys.up || touchState.up || (debugAuto && r.started));
  const inputBrake = active && (keys.down || touchState.down);
  const inputNitro = active && (keys.nitro || touchState.nitro || (debugAuto && r.speed > 55 && p.nitro > 20));
  let steerInput = 0;
  if (active) {
    if (keys.left || touchState.left) steerInput -= 1;
    if (keys.right || touchState.right) steerInput += 1;
    if (debugAuto) steerInput = debugSteer(dt);
  }
  p.steer = damp(p.steer, steerInput, 7.5, dt);
  p.wallCd = Math.max(0, p.wallCd - dt);
  p.collisionCd = Math.max(0, p.collisionCd - dt);

  const topV = p.def.topSpeed / 3.6;
  const usingNitro = inputNitro && p.nitro > 0.4 && p.speed > 12;
  if (usingNitro !== p.nitroWas) {
    if (usingNitro) audio.nitro();
    p.nitroWas = usingNitro;
  }

  if (!r.started) {
    p.speed = damp(p.speed, 32, 1.8, dt);
    p.s += p.speed * dt;
    p.x += p.steer * 3.2 * dt;
  } else if (!r.over) {
    let maxV = topV * (usingNitro ? 1.095 : 1);
    if (inputThrottle) {
      const ratio = clamp(p.speed / maxV, 0, 1);
      let a = p.def.accel * 12.8 * (1 - Math.pow(ratio, 1.55)) + 0.55;
      if (usingNitro) a *= 1.48;
      p.speed += a * dt;
    } else {
      p.speed -= (0.32 + p.speed * 0.007) * dt;
    }
    if (inputBrake) p.speed -= 14.5 * dt;
    if (usingNitro) p.speed += 2.1 * dt;
    if (p.speed > maxV) p.speed = Math.max(maxV, p.speed - 8.5 * dt);
    p.speed = clamp(p.speed, 0, topV * 1.12);
    p.s += p.speed * dt;

    // 弯道离心力：高速时需要轻微反打方向
    const k = routeCurve(p.s);
    p.x -= k * p.speed * p.speed * 0.115 * dt;

    const lateralRate = (1.9 + p.speed * 0.057) * p.def.grip * (usingNitro ? 0.9 : 1);
    p.x += p.steer * lateralRate * dt;

    if (usingNitro) {
      p.nitro = Math.max(0, p.nitro - 24 * dt);
    } else {
      p.nitro = Math.min(100, p.nitro + 1.75 * dt);
    }

    if (Math.abs(p.x) > 6.95) {
      p.x = Math.sign(p.x) * 6.95;
      if (!r.secret && p.wallCd <= 0) addWallHit(p);
    }

    if (!r.secret || r.trafficCollision) checkTrafficCollision(p, true);
    checkNearMiss(dt);
    p.topSpeed = Math.max(p.topSpeed, p.speed);
    p.sp = r.secret ? 1000 : clamp(p.sp, 0, 1000);
  } else {
    p.speed = damp(p.speed, 0, 0.55, dt);
    p.s += p.speed * dt;
  }

  const gr = computeGear(p.speed, topV);
  p.gear = gr.gear;
  p.rpm = gr.rpm;
  updateCameraRace(dt);
  audio.updateEngine(p.speed, topV, p.rpm, inputThrottle, usingNitro, mode === 'race');
}

/* ----------------------------- 对手 AI ----------------------------- */
function chooseRivalLane() {
  const rv = race.rival;
  const pl = race.player;
  let best = rv.lane;
  let bestScore = -1e9;
  for (let lane = 0; lane < 4; lane++) {
    let score = 22 - Math.abs(lane - rv.lane) * 14 + rand(0, 9);
    for (const t of race.traffic) {
      if (t.lane !== lane) continue;
      const ds = t.s - rv.s;
      if (ds > -12 && ds < 145) {
        score -= (150 - Math.max(0, ds)) * 0.72;
      }
    }
    if (Math.abs(rv.s - pl.s) < 32) {
      score += Math.abs(LANE_X[lane] - pl.x) < 2.2 ? 8 : 0;
    }
    if (lane === 0 || lane === 3) score -= 5;
    if (score > bestScore) { bestScore = score; best = lane; }
  }
  rv.targetLane = best;
}

function nearestTrafficAhead(racer, range) {
  let best = null;
  for (const t of race.traffic) {
    const ds = t.s - racer.s;
    if (ds > 0 && ds < range && Math.abs(t.x - racer.x) < 2.0) {
      if (!best || ds < best.s - racer.s) best = t;
    }
  }
  return best;
}

function updateRival(dt) {
  const rv = race.rival;
  const pl = race.player;
  const active = race.started && !race.over;
  if (race.rivalFinished) {
    rv.s = race.finishS;
    rv.speed = 0;
    rv.sp = clamp(rv.sp, 0, 1000);
    return;
  }
  rv.wallCd = Math.max(0, rv.wallCd - dt);
  rv.collisionCd = Math.max(0, rv.collisionCd - dt);

  let target = rv.def.topSpeed / 3.6 * 0.958;
  if (!race.started) {
    target = 32;
  } else if (active) {
    const gap = pl.s - rv.s;
    if (gap > 35) target += clamp(gap * 0.018, 0, 5.4);
    else if (gap < -90) target -= 3.2;
    if (race.time > 55) target += 0.8;
    if (rv.sp < 320) target += 2.0;
    if (Math.abs(gap) < 25) target += 1.1;
    target += Math.sin(race.time * 0.55) * 1.2;

    const ahead = nearestTrafficAhead(rv, 64);
    if (ahead) target = Math.min(target, ahead.speed + 1.8);
    if (ahead && ahead.s - rv.s < 25) {
      target = Math.min(target, ahead.speed + 0.5);
    }
    target = clamp(target, 18, 92);
    rv.boostVisual = gap > 20 && rv.speed > 60 && Math.sin(race.time * 3.1) > -0.1;
  } else {
    target = 0;
  }

  if (!race.started) {
    rv.speed = damp(rv.speed, 32, 1.8, dt);
  } else if (active) {
    const dv = target - rv.speed;
    rv.speed += clamp(dv, -10.5 * dt, 6.2 * dt);
  } else {
    rv.speed = damp(rv.speed, 0, 0.55, dt);
  }
  rv.s += rv.speed * dt;

  rv.aiTimer -= dt;
  if (rv.aiTimer <= 0 && race.started) {
    chooseRivalLane();
    rv.aiTimer = rand(1.0, 1.9);
  }
  rv.lane = rv.targetLane;
  rv.x = damp(rv.x, LANE_X[rv.lane], 1.7, dt);
  rv.x = clamp(rv.x, -6.9, 6.9);

  if (active) {
    if (!race.secret || race.trafficCollision) checkTrafficCollision(rv, false);
    rv.topSpeed = Math.max(rv.topSpeed, rv.speed);
    rv.sp = clamp(rv.sp, 0, 1000);
  }
  const guide = computeGear(rv.speed, rv.def.topSpeed / 3.6);
  rv.gear = guide.gear;
  rv.rpm = guide.rpm;
}

/* ----------------------------- 战斗 / 结算 ----------------------------- */
function updateBattle(dt) {
  const p = race.player, rv = race.rival;
  const gap = rv.s - p.s;
  race.gap = gap;
  let battle = 0;
  if (race.started && !race.over) {
    const ad = Math.abs(gap);
    if (ad < 28) {
      battle = 1 - ad / 28;
      if (ad < 2.6) {
        if (!race.secret) p.sp -= 7.2 * battle * dt;
        rv.sp -= 7.2 * battle * dt;
      } else if (gap > 0) {
        if (!race.secret) p.sp -= (9 + 19 * battle) * dt;
      } else {
        rv.sp -= (9 + 19 * battle) * dt;
      }
    }
  }
  race.battle = battle;
  p.sp = race.secret ? 1000 : clamp(p.sp, 0, 1000);
  rv.sp = clamp(rv.sp, 0, 1000);
}

function hideStoryBox() {
  if (!UI.storyBox) return;
  UI.storyBox.classList.remove('show', 'player-line', 'rival-line');
  UI.storyYou.classList.remove('on');
  UI.storyText.textContent = '';
  if (race) {
    race.storyActive = false;
    race.storyReveal = 0;
    race.storyText = '';
  }
}

function showStoryLine(line, index) {
  if (!race) return;
  const r = race;
  const isPlayer = line.who === 'player';
  const speaker = isPlayer ? r.player.def : r.rival.def;
  const total = r.storyScript.length;
  UI.storySpeaker.textContent = `${speaker.name} / ${speaker.driver}`;
  UI.storyYou.classList.toggle('on', isPlayer);
  UI.storyBox.classList.toggle('player-line', isPlayer);
  UI.storyBox.classList.toggle('rival-line', !isPlayer);
  UI.storyKicker.textContent = '追走战 // CHASE BATTLE';
  UI.storyChapter.textContent = `${pad(index + 1)} / ${pad(total)}`;
  UI.storyText.textContent = '';
  UI.storyBox.classList.add('show');
  r.storyActive = true;
  r.storyReveal = 0;
  r.storyText = line.text;
  r.storyUntil = r.time + 4.7;
}

function updateStory(dt) {
  if (!race) return;
  const r = race;
  if (!r.story || !r.started || r.over) {
    if (r.storyActive) hideStoryBox();
    return;
  }
  if (r.storyActive) {
    r.storyReveal += dt * 46;
    const n = Math.min(r.storyText.length, Math.floor(r.storyReveal));
    UI.storyText.textContent = r.storyText.slice(0, n);
    if (r.time > r.storyUntil) {
      r.storyActive = false;
      UI.storyBox.classList.remove('show');
    }
    return;
  }
  if (r.storyIndex < r.storyScript.length &&
      (r.player.s - START_S) >= r.storyScript[r.storyIndex].at &&
      r.time > 1.2) {
    const index = r.storyIndex++;
    showStoryLine(r.storyScript[index], index);
  }
}

function updateRace(dt) {
  if (!race) return;
  const r = race;
  r.msgTimer = Math.max(0, r.msgTimer - dt);
  if (r.msgTimer <= 0) UI.centerMessage.classList.remove('show');

  if (!r.started) {
    r.countdown -= dt;
    const n = Math.max(1, Math.ceil(r.countdown));
    if (n !== r.lastCount) {
      r.lastCount = n;
      showMessage(
        r.secret ? `追走战 // ${r.player.def.name} vs ${r.rival.def.name}` : 'WANGAN BATTLE // VS BLACKWING',
        String(n),
        r.secret ? '4.0 KM · 无敌模式' : '首都高湾岸線 · 8.0 KM',
        'count',
        0.9
      );
      audio.count();
    }
    if (r.countdown <= 0) {
      r.started = true;
      r.time = 0;
      showMessage(
        r.secret ? '追走战 // CHASE BATTLE' : 'WANGAN LINE',
        'GO',
        r.secret ? `盯住 ${r.rival.def.name} 的尾灯` : '全油门 · 咬住 BLACKWING 的尾灯',
        'count',
        1.0
      );
      audio.go();
      UI.msgTitle.style.color = '';
    }
  } else if (!r.over) {
    r.time += dt;
  }

  updatePlayer(dt);
  updateRival(dt);
  updateTrafficList(r.traffic, r.player.s, dt);
  updateBattle(dt);
  updateStory(dt);
  updateEffects(dt);

  // 区域切换提示
  const z = zoneAt(r.player.s);
  if (z !== r.zone) {
    r.zone = z;
    popup(`${z.name} / ${z.jp}`, '');
    UI.zoneJp.textContent = z.jp;
    UI.zoneName.textContent = z.name;
    UI.zoneFlavor.textContent = z.flavor;
    if (!r.story) {
      if (z.tunnel) showMessage('C1 UNDERGROUND', '进入隧道', '灯光会欺骗你的距离感', '', 1.3);
      else if (z.name === 'RAINBOW BRIDGE') showMessage('RAINBOW BRIDGE', '彩虹桥', '湾岸的灯海在脚下展开', '', 1.3);
      else if (z.name === 'WANGAN STRAIGHT') showMessage('FINAL STRAIGHT', '最终直线', '把氮气留到最后', '', 1.3);
    }
  }

  // 最终 500 米提示
  if (!r.finalWarn && r.started && !r.over && r.player.s > r.finishS - 500) {
    r.finalWarn = true;
    if (r.story) popup('追走决胜段 / FINAL 500 M', 'gold');
    else showMessage('FINAL 500 M // WANGAN STRAIGHT', '最后冲刺', '终点就在灯海尽头', 'gold', 1.5);
  }

  // 胜负判定
  if (!r.over) {
    if (!r.secret && r.player.sp <= 0) {
      completeRace(false, 'SP ZERO // 精神值归零');
    } else if (r.rival.sp <= 0) {
      completeRace(true, r.secret ? `追走成功 // ${r.rival.def.name} 精神值归零` : 'K.O. // BLACKWING 精神值归零');
    } else if (r.player.s >= r.finishS) {
      const secretReason = r.rivalFinished
        ? `追走完成 // ${r.rival.def.name} 已先行冲线`
        : `追走成功 // ${r.rival.def.name} 被甩在身后`;
      completeRace(true, r.secret ? secretReason : 'FINISH // 率先冲线');
    } else if (r.rival.s >= r.finishS) {
      if (r.secret) {
        if (!r.rivalFinished) {
          r.rivalFinished = true;
          r.rival.s = r.finishS;
          r.rival.speed = 0;
          popup(`${r.rival.def.name} 已冲线 / 追走继续`, 'gold');
        }
      } else {
        completeRace(false, 'FINISH // BLACKWING 率先冲线');
      }
    }
  }

  if (r.over) {
    r.resultTimer -= dt;
    if (r.resultTimer <= 0 && !r.resultShown) {
      r.resultShown = true;
      showResultScreen();
    }
  }

  // 区域 hud
  updateHud(dt);
}

function completeRace(win, reason) {
  if (!race || race.over) return;
  const r = race;
  r.over = true;
  r.win = win;
  r.reason = reason;
  r.finishSpeed = r.player.speed;
  r.resultTimer = 1.15;
  r.finishedAt = r.time;
  uiTime = 0;
  UI.centerMessage.classList.remove('show');
  hideStoryBox();
  showMessage(
    r.secret ? '追走战 // CHASE BATTLE' : win ? 'WANGAN BATTLE // WIN' : 'WANGAN BATTLE // LOSE',
    win ? 'WIN' : 'LOSE',
    reason,
    win ? 'gold' : 'alert',
    1.35
  );
  audio.finish(win);

  if (win && !r.secret && r.reason.includes('FINISH')) {
    const best = loadBest();
    if (!best || r.time < best.time) {
      r.newRecord = true;
      saveBest({ time: r.time, car: CARS[selectedCar].name, date: Date.now() });
    }
  }
  updateMenuBest();
}

function updateEffects(dt) {
  visuals.time += dt;
  visuals.shake = Math.max(0, visuals.shake - dt * 2.6);
  visuals.flash = Math.max(0, visuals.flash - dt * 2.8);
  const parts = visuals.sparks;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += 980 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;
  }
}

function spawnSparks(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU);
    const sp = rand(80, 520);
    visuals.sparks.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - rand(40, 160),
      life: rand(0.2, 0.7),
      max: 0.7,
      size: rand(1, 3),
      color
    });
  }
  if (visuals.sparks.length > 120) visuals.sparks.splice(0, visuals.sparks.length - 120);
}

/* ----------------------------- 消息 / 弹窗 ----------------------------- */
function showMessage(kicker, title, sub = '', cls = '', duration = 1.3) {
  UI.msgKicker.textContent = kicker;
  UI.msgTitle.textContent = title;
  UI.msgSub.textContent = sub;
  UI.msgTitle.style.animation = 'none';
  void UI.msgTitle.offsetWidth;
  UI.msgTitle.style.animation = '';
  UI.centerMessage.className = 'center-message ' + cls;
  // 强制重启动画
  void UI.msgTitle.offsetWidth;
  UI.centerMessage.classList.add('show');
  if (race) race.msgTimer = duration;
}

function popup(text, cls = '') {
  if (!UI.popupLayer) return;
  while (UI.popupLayer.children.length >= 5) UI.popupLayer.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = 'popup ' + cls;
  el.textContent = text;
  UI.popupLayer.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 340);
  }, 1050);
}

let toastTimer = null;
function toast(text) {
  UI.toast.textContent = text;
  UI.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => UI.toast.classList.remove('on'), 1500);
}

/* ----------------------------- 成绩存档 ----------------------------- */
const BEST_KEY = 'midnightSpirit.best.v1';
function loadBest() {
  try {
    const d = JSON.parse(localStorage.getItem(BEST_KEY) || 'null');
    if (d && typeof d.time === 'number' && isFinite(d.time)) return d;
  } catch (e) { /* ignore */ }
  return null;
}
function saveBest(d) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
}
function updateMenuBest() {
  const best = loadBest();
  if (UI.bestTime) UI.bestTime.textContent = best ? fmtTime(best.time) : '--:--.---';
}

/* ============================================================
   渲染
   ============================================================ */

function resizeCanvas() {
  W = Math.max(320, window.innerWidth);
  H = Math.max(240, window.innerHeight);
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  HORIZON = H * 0.365;
  FOCAL = H * 0.862;
  rebuildBackdrop();
  if (race) updateCameraRace(0.016, true);
  if (attract) updateCameraAttract(0.016);
}

function drawPoly(pts, fill, stroke, lineWidth) {
  if (!pts || pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
}

function drawGlow(name, x, y, size, alpha) {
  const spr = glowSprites[name] || glowSprites.white;
  if (!spr || alpha <= 0 || size <= 0) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, x - size * 0.5, y - size * 0.5, size, size);
  ctx.globalAlpha = prev;
}

/* ----------------------------- 天空 / 背景 ----------------------------- */
function drawSky(cam) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + H * 0.1);
  g.addColorStop(0, '#03060d');
  g.addColorStop(0.35, '#071120');
  g.addColorStop(0.68, '#12243a');
  g.addColorStop(0.88, '#47313f');
  g.addColorStop(1, '#98624d');
  ctx.fillStyle = g;
  ctx.fillRect(-30, -30, W + 60, HORIZON + 40);

  // 星星
  for (let i = 0; i < stars.length; i++) {
    const st = stars[i];
    const tw = 0.72 + Math.sin(visuals.time * 1.2 + st.ph) * 0.28;
    ctx.fillStyle = `rgba(210,242,255,${st.a * tw})`;
    ctx.fillRect(st.x, st.y, st.r, st.r);
  }

  // 月亮 / 月晕
  const mx = W * 0.755 - cam.th * 26;
  const my = HORIZON - H * 0.29;
  const moonR = Math.max(18, H * 0.035);
  const halo = ctx.createRadialGradient(mx, my, moonR * 0.4, mx, my, moonR * 6.5);
  halo.addColorStop(0, 'rgba(255,238,205,0.13)');
  halo.addColorStop(0.35, 'rgba(255,220,190,0.055)');
  halo.addColorStop(1, 'rgba(255,220,190,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(mx - moonR * 7, my - moonR * 7, moonR * 14, moonR * 14);
  const moon = ctx.createRadialGradient(mx - moonR * 0.3, my - moonR * 0.35, 1, mx, my, moonR);
  moon.addColorStop(0, '#fffaf0');
  moon.addColorStop(0.65, '#f4e3c9');
  moon.addColorStop(1, '#c8b8a2');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(mx, my, moonR, 0, TAU);
  ctx.fill();

  // 城市天际线（视差）
  const offset = cam.th * W * 1.5 + cam.lateral * 1.4 + cam.s * 0.021;
  drawSkylineLayer(skyFar, HORIZON - skyFar.height + H * 0.025, offset * 0.24, 0.95);
  drawSkylineLayer(skyNear, HORIZON - skyNear.height + H * 0.04, W * 0.16 + offset * 0.52, 1);

  // 地平线光雾
  const fog = ctx.createLinearGradient(0, HORIZON - H * 0.13, 0, HORIZON + H * 0.035);
  fog.addColorStop(0, 'rgba(255,112,83,0)');
  fog.addColorStop(0.52, 'rgba(255,117,93,0.065)');
  fog.addColorStop(0.82, 'rgba(255,154,110,0.12)');
  fog.addColorStop(1, 'rgba(10,16,24,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, HORIZON - H * 0.13, W, H * 0.18);

  // 远处海面 / 城市灯带
  const baseGrad = ctx.createLinearGradient(0, HORIZON, 0, H);
  baseGrad.addColorStop(0, '#080f17');
  baseGrad.addColorStop(0.16, '#04080e');
  baseGrad.addColorStop(1, '#010306');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(-20, HORIZON - 1, W + 40, H - HORIZON + 30);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const lx = mod(W * 0.06 + i * 53 + offset * 0.08, W + 120) - 60;
    const ly = HORIZON + 3 + (i % 4) * 2.2;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,182,98,0.23)' : 'rgba(110,223,244,0.19)';
    ctx.fillRect(lx, ly, 12 + (i % 5) * 7, 0.8);
  }
  ctx.restore();

  // 地平线上的高架灯
  ctx.strokeStyle = 'rgba(130,185,205,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, HORIZON + H * 0.008);
  ctx.bezierCurveTo(W * 0.3, HORIZON - H * 0.006, W * 0.68, HORIZON + H * 0.01, W + 10, HORIZON - H * 0.003);
  ctx.stroke();
}

function drawSkylineLayer(img, y, offset, alpha) {
  if (!img) return;
  const w = img.width;
  let x = -mod(offset, w);
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  while (x < W) {
    ctx.drawImage(img, Math.floor(x), Math.round(y));
    x += w;
  }
  ctx.globalAlpha = prev;
}

/* ----------------------------- 道路 ----------------------------- */
function buildRoadSamples(cam) {
  const pts = [];
  let d = 1.35;
  while (d < 385) {
    const s = cam.s + d;
    const q = sampleRoute(s);
    const p = {
      s,
      center: projectOn(q, 0, 0),
      roadL: projectOn(q, -ROAD_HALF, 0),
      roadR: projectOn(q, ROAD_HALF, 0),
      shoulderL: projectOn(q, -9.45, -0.06),
      shoulderR: projectOn(q, 9.45, -0.06),
      edgeL: projectOn(q, -7.06, 0.015),
      edgeR: projectOn(q, 7.06, 0.015),
      lane0: projectOn(q, -3.7, 0.015),
      lane1: projectOn(q, 0, 0.015),
      lane2: projectOn(q, 3.7, 0.015),
      railL: projectOn(q, -8.35, 0),
      railR: projectOn(q, 8.35, 0),
      railTopL: projectOn(q, -8.35, 0.93),
      railTopR: projectOn(q, 8.35, 0.93),
      wallTopL: projectOn(q, -8.55, 5.9),
      wallTopR: projectOn(q, 8.55, 5.9),
      wallStripL: projectOn(q, -8.5, 2.15),
      wallStripR: projectOn(q, 8.5, 2.15)
    };
    if (p.center && p.roadL && p.roadR) pts.push(p);
    d += d < 30 ? 2.2 : d < 80 ? 4.4 : d < 165 ? 8.5 : 16;
  }
  return pts;
}

function drawRoad(cam, refS) {
  const pts = buildRoadSamples(cam);
  const tunnel = isTunnelAt(refS);
  const horizonGrad = ctx.createLinearGradient(0, HORIZON - 10, 0, H * 0.84);
  horizonGrad.addColorStop(0, 'rgba(14,27,38,0.6)');
  horizonGrad.addColorStop(0.4, 'rgba(7,13,21,1)');
  horizonGrad.addColorStop(1, 'rgba(3,6,10,1)');
  ctx.fillStyle = horizonGrad;
  ctx.fillRect(-20, HORIZON - 8, W + 40, H - HORIZON + 40);

  // 从远到近绘制
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i], b = pts[i + 1];
    if (!a.roadL || !b.roadL) continue;

    // 路肩
    drawPoly(
      [a.shoulderL, b.shoulderL, b.shoulderR, a.shoulderR],
      '#080d13'
    );

    // 沥青
    const band = Math.floor(a.s / 18) % 2 === 0;
    drawPoly(
      [a.roadL, b.roadL, b.roadR, a.roadR],
      band ? '#101923' : '#0d151e'
    );

    // 中央微弱反光
    if (band) {
      drawPoly(
        [a.lane0, b.lane0, b.lane2, a.lane2],
        'rgba(46,74,88,0.09)'
      );
    }

    // 车道虚线
    const dashOn = Math.floor(a.s / 13) % 2 === 0;
    if (dashOn) {
      ctx.strokeStyle = 'rgba(216,235,244,0.56)';
      for (const key of ['lane0', 'lane1', 'lane2']) {
        if (!a[key] || !b[key]) continue;
        ctx.lineWidth = clamp(a[key].scale * 0.14, 0.55, 3.2);
        ctx.beginPath();
        ctx.moveTo(a[key].x, a[key].y);
        ctx.lineTo(b[key].x, b[key].y);
        ctx.stroke();
      }
    }

    // 两侧实线
    ctx.strokeStyle = 'rgba(224,240,247,0.7)';
    for (const key of ['edgeL', 'edgeR']) {
      if (!a[key] || !b[key]) continue;
      ctx.lineWidth = clamp(a[key].scale * 0.17, 0.7, 4.2);
      ctx.beginPath();
      ctx.moveTo(a[key].x, a[key].y);
      ctx.lineTo(b[key].x, b[key].y);
      ctx.stroke();
    }

    // 护栏 / 隧道墙
    if (tunnel) {
      drawPoly(
        [a.railL, b.railL, b.wallTopL, a.wallTopL],
        '#0b1118'
      );
      drawPoly(
        [a.railR, b.railR, b.wallTopR, a.wallTopR],
        '#0b1118'
      );
      if (a.wallStripL && b.wallStripL) {
        ctx.strokeStyle = 'rgba(255,163,70,0.48)';
        ctx.lineWidth = clamp(a.wallStripL.scale * 0.11, 0.7, 5);
        ctx.beginPath();
        ctx.moveTo(a.wallStripL.x, a.wallStripL.y);
        ctx.lineTo(b.wallStripL.x, b.wallStripL.y);
        ctx.moveTo(a.wallStripR.x, a.wallStripR.y);
        ctx.lineTo(b.wallStripR.x, b.wallStripR.y);
        ctx.stroke();
      }
    } else {
      drawPoly(
        [a.railL, b.railL, b.railTopL, a.railTopL],
        '#172630'
      );
      drawPoly(
        [a.railR, b.railR, b.railTopR, a.railTopR],
        '#14222c'
      );
      if (a.railTopL && b.railTopL) {
        ctx.strokeStyle = 'rgba(127,196,217,0.27)';
        ctx.lineWidth = clamp(a.railTopL.scale * 0.055, 0.5, 2.4);
        ctx.beginPath();
        ctx.moveTo(a.railTopL.x, a.railTopL.y);
        ctx.lineTo(b.railTopL.x, b.railTopL.y);
        ctx.moveTo(a.railTopR.x, a.railTopR.y);
        ctx.lineTo(b.railTopR.x, b.railTopR.y);
        ctx.stroke();
      }
    }
  }

  // 近端沥青补光
  const near = pts[0];
  if (near && near.center) {
    const grad = ctx.createLinearGradient(0, H * 0.72, 0, H);
    grad.addColorStop(0, 'rgba(18,31,43,0)');
    grad.addColorStop(1, 'rgba(5,10,16,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H * 0.7, W, H * 0.31);
  }
  drawRoadDetails(cam, pts, tunnel);
}

function drawRoadDetails(cam, pts, tunnel) {
  // 路面伸缩缝：给高速一个近处的参照
  const jointStart = Math.ceil((cam.s + 8) / 32) * 32;
  for (let s = jointStart; s < cam.s + 235; s += 32) {
    const l = projectAt(s, -ROAD_HALF, 0.012);
    const r = projectAt(s, ROAD_HALF, 0.012);
    if (!l || !r) continue;
    const fade = clamp(1 - (s - cam.s) / 245, 0.1, 1);
    ctx.strokeStyle = `rgba(105,143,157,${0.16 * fade})`;
    ctx.lineWidth = clamp(l.scale * 0.022, 0.5, 2);
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(r.x, r.y);
    ctx.stroke();
  }

  // 车道反光钉
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const studStart = Math.ceil((cam.s + 5) / 19) * 19;
  for (let s = studStart; s < cam.s + 175; s += 19) {
    const fade = clamp(1 - (s - cam.s) / 185, 0, 1);
    for (const lat of [-3.7, 0, 3.7]) {
      const p = projectAt(s, lat, 0.02);
      if (!p) continue;
      const size = clamp(p.scale * 0.055, 1, 10);
      ctx.globalAlpha = 0.34 * fade;
      ctx.fillStyle = 'rgba(208,244,255,0.9)';
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
  }
  ctx.restore();

  // 反光路钉
  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    if (!p.railTopL || !p.railTopR) continue;
    if (Math.floor(p.s / 24) % 2 === 0) continue;
    const fade = clamp(1 - (p.s - cam.s) / 340, 0, 1);
    ctx.fillStyle = `rgba(255,191,103,${0.38 * fade})`;
    ctx.fillRect(p.railTopL.x - 1, p.railTopL.y - 1, 2, 2);
    ctx.fillStyle = `rgba(107,242,255,${0.34 * fade})`;
    ctx.fillRect(p.railTopR.x - 1, p.railTopR.y - 1, 2, 2);
  }

  if (!tunnel) return;
  // 隧道顶部灯带
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const start = Math.ceil((cam.s + 8) / 19) * 19;
  for (let s = start; s < cam.s + 135; s += 19) {
    const p = projectAt(s, 0, 5.7);
    if (!p) continue;
    const fade = clamp(1 - (s - cam.s) / 150, 0, 1);
    drawGlow('amber', p.x, p.y, clamp(p.scale * 1.4, 8, 90), 0.22 * fade);
    ctx.fillStyle = `rgba(255,225,180,${0.55 * fade})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, clamp(p.scale * 0.23, 1.3, 18), clamp(p.scale * 0.05, 0.7, 3), 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ----------------------------- 路边设施 ----------------------------- */
const BILLBOARDS = [];
(function initBillboards() {
  const texts = [
    ['WANGAN', 'BAYSHORE 01', '#63efff'],
    ['湾岸線', 'TOKYO EXPRESSWAY', '#ff70b7'],
    ['NIGHT RUN', '00:00 — 05:00', '#ffb64e'],
    ['首都高', 'C1 / WANGAN', '#63efff'],
    ['SPEED', 'IS A LANGUAGE', '#ff415e'],
    ['TOKYO BAY', 'MIDNIGHT SPIRIT', '#7ff5d0'],
    ['0 — 300', 'IN 13 SECONDS', '#ffb64e'],
    ['湾岸', 'NO LIMIT', '#ff70b7']
  ];
  for (let i = 0; i < 20; i++) {
    const item = texts[i % texts.length];
    BILLBOARDS.push({
      s: 210 + i * 300,
      side: i % 2 === 0 ? -1 : 1,
      text: item[0], sub: item[1], color: item[2],
      h: 5.4
    });
  }
})();

const GANTRIES = [];
(function initGantries() {
  GANTRIES.push({ s: 360 }, { s: 520 });
  for (let i = 0; i < 16; i++) {
    GANTRIES.push({ s: 830 + i * 470 });
  }
})();

function drawStreetlights(cam) {
  const ref = cam.s + 9;
  const first = Math.ceil(ref / 57) * 57;
  const items = [];
  for (let s = first; s < cam.s + 310; s += 57) {
    if (isTunnelAt(s)) continue;
    for (const side of [-1, 1]) items.push({ s, side, d: s - cam.s });
  }
  items.sort((a, b) => b.d - a.d);
  ctx.save();
  ctx.lineCap = 'round';
  for (const it of items) {
    const base = projectAt(it.s, it.side * 9.45, 0);
    const top = projectAt(it.s, it.side * 9.45, 8.7);
    const lamp = projectAt(it.s, it.side * 6.9, 8.25);
    if (!base || !top || !lamp) continue;
    const fade = clamp(1 - (it.s - cam.s) / 320, 0, 1);
    ctx.strokeStyle = `rgba(44,65,78,${0.55 * fade + 0.15})`;
    ctx.lineWidth = clamp(base.scale * 0.13, 0.7, 5.5);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.lineTo(lamp.x, lamp.y);
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('amber', lamp.x, lamp.y, clamp(lamp.scale * 3.2, 16, 260), 0.46 * fade);
    ctx.fillStyle = `rgba(255,239,205,${0.86 * fade})`;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, clamp(lamp.scale * 0.075, 0.9, 3.6), 0, TAU);
    ctx.fill();
    const refl = projectAt(it.s, it.side * 6.6, 0.03);
    if (refl) {
      ctx.save();
      ctx.translate(refl.x, refl.y);
      ctx.scale(1, 0.22);
      drawGlow('amber', 0, 0, clamp(refl.scale * 4.4, 40, 380), 0.1 * fade);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawBillboards(cam) {
  for (const b of BILLBOARDS) {
    const ds = b.s - cam.s;
    if (ds < 14 || ds > 310) continue;
    if (isTunnelAt(b.s)) continue;
    const lat = b.side * 15.4;
    const q = sampleRoute(b.s);
    const lb = projectOn(q, lat - 4.4, 4.0);
    const rb = projectOn(q, lat + 4.4, 4.0);
    const lt = projectOn(q, lat - 4.4, 4.0 + b.h);
    const rt = projectOn(q, lat + 4.4, 4.0 + b.h);
    if (!lb || !rb || !lt || !rt) continue;
    const w = Math.abs(rb.x - lb.x);
    if (w < 3) continue;
    const fade = clamp(1 - (ds - 150) / 180, 0.32, 1);
    const alpha = fade;
    ctx.save();
    ctx.globalAlpha = alpha;

    // 支撑柱
    const legA = projectOn(q, lat - 3.4, 0);
    const legB = projectOn(q, lat + 3.4, 0);
    if (legA && legB) {
      ctx.strokeStyle = '#1b2c36';
      ctx.lineWidth = clamp((legA.scale + legB.scale) * 0.04, 0.8, 4);
      ctx.beginPath();
      ctx.moveTo(legA.x, legA.y); ctx.lineTo(lb.x, lb.y);
      ctx.moveTo(legB.x, legB.y); ctx.lineTo(rb.x, rb.y);
      ctx.stroke();
    }

    // 面板
    ctx.beginPath();
    ctx.moveTo(lb.x, lb.y);
    ctx.lineTo(rb.x, rb.y);
    ctx.lineTo(rt.x, rt.y);
    ctx.lineTo(lt.x, lt.y);
    ctx.closePath();
    const pg = ctx.createLinearGradient(0, lt.y, 0, lb.y);
    pg.addColorStop(0, 'rgba(8,18,28,0.97)');
    pg.addColorStop(0.55, 'rgba(4,10,16,0.97)');
    pg.addColorStop(1, 'rgba(12,25,34,0.98)');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = alpha * 0.8;
    ctx.lineWidth = clamp(w * 0.006, 0.8, 2.2);
    ctx.stroke();
    ctx.globalAlpha = alpha;

    if (w > 24) {
      ctx.save();
      ctx.clip();
      const cx = (lb.x + rb.x + lt.x + rt.x) / 4;
      const cy = (lb.y + rb.y + lt.y + rt.y) / 4;
      const panelH = Math.abs(lb.y - lt.y);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 16;
      ctx.font = `700 ${clamp(panelH * 0.22, 7, 44)}px "Bahnschrift","Arial Narrow",sans-serif`;
      ctx.fillText(b.text, cx, cy - panelH * 0.1);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(210,236,244,0.66)';
      ctx.font = `500 ${clamp(panelH * 0.075, 4, 14)}px "Bahnschrift","Microsoft YaHei",sans-serif`;
      ctx.fillText(b.sub, cx, cy + panelH * 0.19);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.35, cy + panelH * 0.05);
      ctx.lineTo(cx + w * 0.35, cy + panelH * 0.05);
      ctx.stroke();
      ctx.restore();
    }
    // 顶部灯条
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(b.color === '#ff70b7' ? 'pink' : b.color === '#ffb64e' ? 'amber' : 'cyan', (lb.x + rb.x) / 2, (lb.y + rb.y) / 2, w * 0.75, 0.1);
    ctx.restore();
    ctx.restore();
  }
}

function drawGantries(cam) {
  for (const gt of GANTRIES) {
    const ds = gt.s - cam.s;
    if (ds < 28 || ds > 310) continue;
    if (isTunnelAt(gt.s)) continue;
    const q = sampleRoute(gt.s);
    const lb = projectOn(q, -9.1, 0);
    const rb = projectOn(q, 9.1, 0);
    const lt = projectOn(q, -9.1, 6.2);
    const rt = projectOn(q, 9.1, 6.2);
    if (!lb || !rb || !lt || !rt) continue;
    const fade = clamp(1 - (ds - 160) / 170, 0.35, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#263a47';
    ctx.lineWidth = clamp((lb.scale + rb.scale) * 0.035, 1, 7);
    ctx.beginPath();
    ctx.moveTo(lb.x, lb.y); ctx.lineTo(lt.x, lt.y);
    ctx.moveTo(rb.x, rb.y); ctx.lineTo(rt.x, rt.y);
    ctx.moveTo(lt.x, lt.y); ctx.lineTo(rt.x, rt.y);
    ctx.stroke();

    // 门架信号灯
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k <= 7; k++) {
      const t = k / 7;
      const x = lerp(lt.x, rt.x, t);
      const y = lerp(lt.y, rt.y, t) + Math.abs(rt.x - lt.x) * 0.006;
      drawGlow('cyan', x, y, clamp(Math.abs(rt.x - lt.x) * 0.035, 5, 26), 0.18);
    }
    ctx.restore();

    if (Math.abs(rt.x - lt.x) > 70) {
      // 绿色高速指示牌
      const sl = projectOn(q, -4.4, 6.55);
      const sr = projectOn(q, 4.4, 6.55);
      const stl = projectOn(q, -4.4, 8.25);
      const str = projectOn(q, 4.4, 8.25);
      if (sl && sr && stl && str) {
        ctx.beginPath();
        ctx.moveTo(sl.x, sl.y); ctx.lineTo(sr.x, sr.y);
        ctx.lineTo(str.x, str.y); ctx.lineTo(stl.x, stl.y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(10,52,44,0.96)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(147,255,207,0.7)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        if (Math.abs(sr.x - sl.x) > 55) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(sl.x, sl.y); ctx.lineTo(sr.x, sr.y);
          ctx.lineTo(str.x, str.y); ctx.lineTo(stl.x, stl.y);
          ctx.closePath();
          ctx.clip();
          const cx = (sl.x + sr.x) / 2;
          const cy = (sl.y + str.y) / 2;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(219,255,240,0.95)';
          ctx.font = `700 ${clamp(Math.abs(sr.x - sl.x) * 0.045, 7, 30)}px "Microsoft YaHei","Bahnschrift",sans-serif`;
          ctx.fillText('湾岸線  WANGAN', cx, cy - 5);
          ctx.font = `500 ${clamp(Math.abs(sr.x - sl.x) * 0.025, 5, 17)}px "Bahnschrift",sans-serif`;
          ctx.fillStyle = 'rgba(170,255,220,0.7)';
          ctx.fillText('TOKYO  /  BAYSHORE  /  C1', cx, cy + 13);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }
}

function drawBridgeTowers(cam) {
  const towers = [4380, 4770, 5160];
  for (const ts of towers) {
    const ds = ts - cam.s;
    if (ds < -80 || ds > 390) continue;
    const q = sampleRoute(ts);
    const lb = projectOn(q, -11.5, 0);
    const rb = projectOn(q, 11.5, 0);
    const lt = projectOn(q, -11.5, 31);
    const rt = projectOn(q, 11.5, 31);
    if (!lb || !rb || !lt || !rt) continue;
    const fade = clamp(1 - Math.abs(ds - 80) / 310, 0.25, 1);

    // 悬索
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const top = side < 0 ? lt : rt;
      for (const dir of [-1, 1]) {
        const deck = projectAt(ts + dir * 115, side * 10.4, 1.8);
        if (!deck) continue;
        ctx.strokeStyle = `rgba(255,116,178,${0.18 * fade})`;
        ctx.lineWidth = clamp((top.scale + deck.scale) * 0.014, 0.9, 5);
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.quadraticCurveTo((top.x + deck.x) * 0.5, top.y + 48, deck.x, deck.y);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,100,170,0.28)';
    ctx.lineWidth = clamp((lb.scale + rb.scale) * 0.08, 2, 16);
    ctx.beginPath();
    ctx.moveTo(lb.x, lb.y); ctx.lineTo(lt.x, lt.y);
    ctx.moveTo(rb.x, rb.y); ctx.lineTo(rt.x, rt.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(115,232,255,0.36)';
    ctx.lineWidth = clamp((lb.scale + rb.scale) * 0.025, 1, 6);
    ctx.beginPath();
    ctx.moveTo(lb.x, lb.y); ctx.lineTo(lt.x, lt.y);
    ctx.moveTo(rb.x, rb.y); ctx.lineTo(rt.x, rt.y);
    ctx.stroke();
    // 横梁
    for (const hh of [13, 26]) {
      const a = projectOn(q, -11.5, hh);
      const b = projectOn(q, 11.5, hh);
      if (!a || !b) continue;
      ctx.strokeStyle = 'rgba(255,102,171,0.26)';
      ctx.lineWidth = clamp((a.scale + b.scale) * 0.03, 1, 7);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // 桥塔灯
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const hh of [13, 26, 31]) {
      const a = projectOn(q, -11.5, hh);
      if (a) drawGlow('pink', a.x, a.y, clamp(a.scale * 1.5, 8, 110), 0.22 * fade);
      const b = projectOn(q, 11.5, hh);
      if (b) drawGlow('pink', b.x, b.y, clamp(b.scale * 1.5, 8, 110), 0.22 * fade);
    }
    ctx.restore();
    ctx.restore();
  }
}

function drawFinishGate(cam, finishS = FINISH_S) {
  const ds = finishS - cam.s;
  if (ds < 18 || ds > 430) return;
  const q = sampleRoute(finishS);
  const lb = projectOn(q, -9.4, 0);
  const rb = projectOn(q, 9.4, 0);
  const lt = projectOn(q, -9.4, 6.6);
  const rt = projectOn(q, 9.4, 6.6);
  if (!lb || !rb || !lt || !rt) return;
  const fade = clamp(1 - (ds - 260) / 260, 0.4, 1);
  ctx.save();
  ctx.globalAlpha = fade;

  // 立柱
  ctx.strokeStyle = 'rgba(99,239,255,0.45)';
  ctx.lineWidth = clamp((lb.scale + rb.scale) * 0.045, 1.2, 9);
  ctx.beginPath();
  ctx.moveTo(lb.x, lb.y); ctx.lineTo(lt.x, lt.y);
  ctx.moveTo(rb.x, rb.y); ctx.lineTo(rt.x, rt.y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = clamp((lb.scale + rb.scale) * 0.012, 0.8, 3);
  ctx.beginPath();
  ctx.moveTo(lb.x, lb.y); ctx.lineTo(lt.x, lt.y);
  ctx.moveTo(rb.x, rb.y); ctx.lineTo(rt.x, rt.y);
  ctx.stroke();

  // 棋盘横幅
  const bl = projectOn(q, -4.8, 6.8);
  const br = projectOn(q, 4.8, 6.8);
  const tl = projectOn(q, -4.8, 8.25);
  const tr = projectOn(q, 4.8, 8.25);
  if (bl && br && tl && tr) {
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
    ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4,8,12,0.96)';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const minX = Math.min(bl.x, br.x, tl.x, tr.x);
    const maxX = Math.max(bl.x, br.x, tl.x, tr.x);
    const minY = Math.min(bl.y, br.y, tl.y, tr.y);
    const maxY = Math.max(bl.y, br.y, tl.y, tr.y);
    const bw = (maxX - minX) / 14;
    const bh = (maxY - minY) / 7;
    for (let yy = 0; yy < 7; yy++) {
      for (let xx = 0; xx < 14; xx++) {
        if ((xx + yy) % 2 === 0) {
          ctx.fillStyle = 'rgba(236,249,252,0.9)';
          ctx.fillRect(minX + xx * bw, minY + yy * bh, bw + 0.5, bh + 0.5);
        }
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(99,239,255,0.65)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (maxX - minX > 100) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(7,15,20,0.92)';
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const fs = clamp((maxX - minX) * 0.082, 9, 34);
      ctx.font = `800 ${fs}px "Bahnschrift","Microsoft YaHei",sans-serif`;
      ctx.fillText('FINISH', cx, cy);
      ctx.restore();
    }
  }
  ctx.restore();

  // 终点线
  const fl = projectOn(q, -7.7, 0.025);
  const fr = projectOn(q, 7.7, 0.025);
  if (fl && fr) {
    const w = Math.abs(fr.x - fl.x);
    if (w > 2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(235,250,255,0.75)';
      ctx.lineWidth = clamp(w * 0.035, 1, 30);
      ctx.setLineDash([Math.max(2, w * 0.025), Math.max(2, w * 0.025)]);
      ctx.beginPath();
      ctx.moveTo(fl.x, fl.y);
      ctx.lineTo(fr.x, fr.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawProps(cam, refS, finishS = FINISH_S) {
  drawBridgeTowers(cam);
  drawGantries(cam);
  drawBillboards(cam);
  drawStreetlights(cam);
  drawFinishGate(cam, finishS);
}

/* ----------------------------- 车辆绘制 ----------------------------- */
function roundRectPath(g, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

function drawCarRear(g, x, y, w, o) {
  if (w < 1) return;
  const def = o.def;
  const speedN = clamp((o.speed || 0) / 85, 0, 1.2);
  const bounce = o.bounce !== undefined ? o.bounce : Math.sin((o.time || 0) * 31) * speedN * 1.6;
  const tilt = o.tilt || 0;
  const brake = o.brake;
  const nitro = o.nitro;

  g.save();
  g.translate(x, y + bounce);
  g.rotate(tilt);
  const h = w * 0.63;
  const detail = w > 54;
  const tiny = w < 18;

  // 地面阴影
  g.save();
  g.scale(1, 0.17);
  const sh = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.55);
  sh.addColorStop(0, 'rgba(0,0,0,0.72)');
  sh.addColorStop(0.65, 'rgba(0,0,0,0.32)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.beginPath();
  g.arc(0, 0, w * 0.56, 0, TAU);
  g.fill();
  g.restore();

  if (tiny) {
    g.fillStyle = def.body;
    g.fillRect(-w * 0.45, -w * 0.38, w * 0.9, w * 0.35);
    g.fillStyle = def.accent;
    g.fillRect(-w * 0.38, -w * 0.24, w * 0.16, w * 0.08);
    g.fillRect(w * 0.22, -w * 0.24, w * 0.16, w * 0.08);
    g.restore();
    return;
  }

  // 氮气地光 / 底盘光
  if (nitro) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const ug = g.createRadialGradient(0, -w * 0.03, 0, 0, -w * 0.03, w * 0.62);
    ug.addColorStop(0, 'rgba(255,136,57,0.42)');
    ug.addColorStop(0.5, 'rgba(255,64,73,0.14)');
    ug.addColorStop(1, 'rgba(255,64,73,0)');
    g.fillStyle = ug;
    g.beginPath(); g.ellipse(0, -w * 0.04, w * 0.66, w * 0.18, 0, 0, TAU); g.fill();
    g.restore();
  }

  // 轮胎
  g.fillStyle = '#05070a';
  g.beginPath();
  g.ellipse(-w * 0.445, -w * 0.072, w * 0.082, w * 0.112, 0, 0, TAU);
  g.ellipse(w * 0.445, -w * 0.072, w * 0.082, w * 0.112, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(135,170,185,0.16)';
  g.beginPath();
  g.ellipse(-w * 0.445, -w * 0.072, w * 0.032, w * 0.062, 0, 0, TAU);
  g.ellipse(w * 0.445, -w * 0.072, w * 0.032, w * 0.062, 0, 0, TAU);
  g.fill();

  // 车身
  const bodyGrad = g.createLinearGradient(0, -h * 0.95, 0, 0);
  bodyGrad.addColorStop(0, def.light || def.body);
  bodyGrad.addColorStop(0.22, def.body);
  bodyGrad.addColorStop(0.7, def.body);
  bodyGrad.addColorStop(1, def.dark || '#080b10');
  g.fillStyle = bodyGrad;
  g.beginPath();
  g.moveTo(-w * 0.462, -w * 0.035);
  g.lineTo(-w * 0.487, -w * 0.255);
  g.quadraticCurveTo(-w * 0.49, -w * 0.335, -w * 0.426, -w * 0.374);
  g.lineTo(-w * 0.37, -w * 0.48);
  g.lineTo(-w * 0.255, -w * 0.63);
  g.lineTo(w * 0.255, -w * 0.63);
  g.lineTo(w * 0.37, -w * 0.48);
  g.lineTo(w * 0.426, -w * 0.374);
  g.quadraticCurveTo(w * 0.49, -w * 0.335, w * 0.487, -w * 0.255);
  g.lineTo(w * 0.462, -w * 0.035);
  g.quadraticCurveTo(w * 0.42, -w * 0.005, w * 0.28, -w * 0.002);
  g.lineTo(-w * 0.28, -w * 0.002);
  g.quadraticCurveTo(-w * 0.42, -w * 0.005, -w * 0.462, -w * 0.035);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.34)';
  g.lineWidth = Math.max(0.7, w * 0.0026);
  g.stroke();

  // 后翼子板
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.beginPath();
  g.ellipse(-w * 0.383, -w * 0.20, w * 0.108, w * 0.185, -0.08, 0, TAU);
  g.ellipse(w * 0.383, -w * 0.20, w * 0.108, w * 0.185, 0.08, 0, TAU);
  g.fill();

  // 露出的后轮
  g.fillStyle = '#05070a';
  g.beginPath();
  g.ellipse(-w * 0.446, -w * 0.062, w * 0.078, w * 0.105, 0, 0, TAU);
  g.ellipse(w * 0.446, -w * 0.062, w * 0.078, w * 0.105, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(104,142,158,0.34)';
  g.lineWidth = Math.max(0.7, w * 0.003);
  g.beginPath();
  g.ellipse(-w * 0.446, -w * 0.062, w * 0.035, w * 0.057, 0, 0, TAU);
  g.ellipse(w * 0.446, -w * 0.062, w * 0.035, w * 0.057, 0, 0, TAU);
  g.stroke();

  // 后备厢 / 保险杠接缝
  g.strokeStyle = 'rgba(0,0,0,0.24)';
  g.lineWidth = Math.max(0.55, w * 0.0022);
  g.beginPath();
  g.moveTo(-w * 0.355, -w * 0.362);
  g.quadraticCurveTo(0, -w * 0.382, w * 0.355, -w * 0.362);
  g.moveTo(-w * 0.438, -w * 0.138);
  g.quadraticCurveTo(0, -w * 0.153, w * 0.438, -w * 0.138);
  g.stroke();

  // 车肩高光
  g.strokeStyle = 'rgba(255,255,255,0.20)';
  g.lineWidth = Math.max(0.6, w * 0.0025);
  g.beginPath();
  g.moveTo(-w * 0.475, -w * 0.31);
  g.quadraticCurveTo(-w * 0.39, -w * 0.43, -w * 0.30, -w * 0.475);
  g.moveTo(w * 0.475, -w * 0.31);
  g.quadraticCurveTo(w * 0.39, -w * 0.43, w * 0.30, -w * 0.475);
  g.stroke();

  // 车顶 / 后窗
  const roofGrad = g.createLinearGradient(0, -w * 0.64, 0, -w * 0.36);
  roofGrad.addColorStop(0, def.dark || '#080b10');
  roofGrad.addColorStop(0.3, '#07111a');
  roofGrad.addColorStop(0.7, '#102331');
  roofGrad.addColorStop(1, '#050b11');
  g.fillStyle = roofGrad;
  g.beginPath();
  g.moveTo(-w * 0.247, -w * 0.597);
  g.lineTo(w * 0.247, -w * 0.597);
  g.lineTo(w * 0.305, -w * 0.402);
  g.quadraticCurveTo(0, -w * 0.372, -w * 0.305, -w * 0.402);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(150,210,230,0.13)';
  g.lineWidth = Math.max(0.6, w * 0.002);
  g.stroke();

  // 后窗反光
  g.fillStyle = 'rgba(151,222,245,0.10)';
  g.beginPath();
  g.moveTo(-w * 0.22, -w * 0.575);
  g.lineTo(-w * 0.06, -w * 0.575);
  g.lineTo(-w * 0.16, -w * 0.407);
  g.lineTo(-w * 0.27, -w * 0.407);
  g.closePath();
  g.fill();

  // 后窗除雾线
  g.strokeStyle = 'rgba(123,188,210,0.10)';
  g.lineWidth = Math.max(0.5, w * 0.0014);
  for (let i = 0; i < 4; i++) {
    const yy = -w * (0.55 - i * 0.028);
    g.beginPath();
    g.moveTo(-w * 0.22, yy);
    g.lineTo(w * 0.22, yy);
    g.stroke();
  }

  // 顶棚高光
  g.strokeStyle = 'rgba(255,255,255,0.23)';
  g.lineWidth = Math.max(0.7, w * 0.004);
  g.beginPath();
  g.moveTo(-w * 0.238, -w * 0.617);
  g.lineTo(w * 0.238, -w * 0.617);
  g.stroke();

  // 后扰流板
  if (def.wing) {
    g.fillStyle = def.dark || '#06080c';
    g.fillRect(-w * 0.21, -w * 0.515, w * 0.028, w * 0.1);
    g.fillRect(w * 0.182, -w * 0.515, w * 0.028, w * 0.1);
    g.fillStyle = def.body;
    roundRectPath(g, -w * 0.385, -w * 0.555, w * 0.77, w * 0.052, w * 0.018);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(-w * 0.36, -w * 0.552, w * 0.72, Math.max(0.6, w * 0.006));
  }

  // 尾灯底板
  g.fillStyle = 'rgba(3,5,9,0.9)';
  roundRectPath(g, -w * 0.375, -w * 0.326, w * 0.75, w * 0.122, w * 0.024);
  g.fill();
  g.strokeStyle = 'rgba(180,218,230,0.12)';
  g.lineWidth = Math.max(0.5, w * 0.0018);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.04)';
  g.fillRect(-w * 0.34, -w * 0.316, w * 0.68, Math.max(0.6, w * 0.003));

  // 尾灯
  const lightY = -w * 0.263;
  const glowColor = brake ? '#ff6372' : def.accent;
  g.save();
  g.shadowColor = glowColor;
  g.shadowBlur = brake ? w * 0.08 : w * 0.045;
  g.fillStyle = glowColor;
  if (def.id === 'oni-gtr') {
    const r = w * 0.038;
    for (const sx of [-0.318, -0.235, 0.235, 0.318]) {
      g.beginPath();
      g.arc(w * sx, lightY, r, 0, TAU);
      g.fill();
    }
  } else if (def.id === 'kaze-rx7') {
    for (const sx of [-0.315, 0.315]) {
      g.beginPath();
      g.ellipse(w * sx, lightY, w * 0.092, w * 0.025, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#0a0c10';
      g.beginPath();
      g.ellipse(w * sx, lightY, w * 0.058, w * 0.009, 0, 0, TAU);
      g.fill();
      g.fillStyle = glowColor;
    }
  } else if (def.rival) {
    g.fillRect(-w * 0.35, lightY - w * 0.012, w * 0.7, w * 0.024);
    g.fillStyle = '#0a0c0f';
    g.fillRect(-w * 0.31, lightY - w * 0.005, w * 0.62, w * 0.01);
    g.fillStyle = glowColor;
    for (const sx of [-0.30, 0.30]) {
      g.beginPath();
      g.arc(w * sx, lightY, w * 0.026, 0, TAU);
      g.fill();
    }
  } else {
    roundRectPath(g, -w * 0.345, lightY - w * 0.019, w * 0.24, w * 0.038, w * 0.008);
    g.fill();
    roundRectPath(g, w * 0.105, lightY - w * 0.019, w * 0.24, w * 0.038, w * 0.008);
    g.fill();
    g.fillStyle = 'rgba(255,245,225,0.72)';
    g.fillRect(-w * 0.33, lightY - w * 0.007, w * 0.21, w * 0.014);
    g.fillRect(w * 0.12, lightY - w * 0.007, w * 0.21, w * 0.014);
    g.fillStyle = 'rgba(255,174,78,0.75)';
    g.fillRect(-w * 0.385, lightY - w * 0.008, w * 0.027, w * 0.016);
    g.fillRect(w * 0.358, lightY - w * 0.008, w * 0.027, w * 0.016);
  }
  g.restore();

  // 牌照
  if (detail) {
    g.fillStyle = 'rgba(224,238,240,0.9)';
    roundRectPath(g, -w * 0.08, -w * 0.163, w * 0.16, w * 0.058, w * 0.008);
    g.fill();
    g.fillStyle = '#1b2c33';
    g.font = `600 ${Math.max(4, w * 0.026)}px "Bahnschrift","Microsoft YaHei",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('湾岸 300', 0, -w * 0.134);
  }

  // 保险杠 / 扩散器
  g.fillStyle = 'rgba(3,6,9,0.55)';
  roundRectPath(g, -w * 0.39, -w * 0.098, w * 0.78, w * 0.062, w * 0.014);
  g.fill();
  g.strokeStyle = 'rgba(130,180,200,0.18)';
  g.lineWidth = Math.max(0.5, w * 0.0022);
  g.beginPath();
  g.moveTo(-w * 0.43, -w * 0.105);
  g.lineTo(w * 0.43, -w * 0.105);
  g.stroke();

  g.fillStyle = '#05080b';
  g.fillRect(-w * 0.20, -w * 0.022, w * 0.40, w * 0.035);
  g.fillStyle = 'rgba(140,170,185,0.28)';
  for (let i = -2; i <= 2; i++) g.fillRect(w * i * 0.035, -w * 0.019, Math.max(0.6, w * 0.003), w * 0.027);

  // 排气与氮气火焰
  const exhaustY = -w * 0.028;
  for (const sx of [-0.115, 0.115]) {
    g.fillStyle = '#27313a';
    g.beginPath();
    g.arc(w * sx, exhaustY, Math.max(1.3, w * 0.027), 0, TAU);
    g.fill();
    g.fillStyle = '#0a0d10';
    g.beginPath();
    g.arc(w * sx, exhaustY, Math.max(0.8, w * 0.017), 0, TAU);
    g.fill();
    if (nitro) {
      const fl = (0.7 + Math.sin((o.time || 0) * 48 + sx * 20) * 0.25) * w * 0.19;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const fg = g.createRadialGradient(w * sx, exhaustY, 0, w * sx, exhaustY, fl);
      fg.addColorStop(0, 'rgba(255,245,205,0.95)');
      fg.addColorStop(0.24, 'rgba(255,172,63,0.75)');
      fg.addColorStop(0.55, 'rgba(255,66,59,0.28)');
      fg.addColorStop(1, 'rgba(255,40,20,0)');
      g.fillStyle = fg;
      g.beginPath();
      g.ellipse(w * sx, exhaustY + fl * 0.32, fl * 0.36, fl * 0.85, 0, 0, TAU);
      g.fill();
      g.restore();
    }
  }

  // 车型条纹
  if (def.livery && detail) {
    g.save();
    g.globalAlpha = 0.8;
    g.fillStyle = def.accent2 || def.accent;
    if (def.livery === 'stripe') {
      g.fillStyle = def.accent;
      g.fillRect(-w * 0.294, -w * 0.606, w * 0.022, w * 0.205);
      g.fillRect(w * 0.272, -w * 0.606, w * 0.022, w * 0.205);
      g.fillStyle = def.accent2 || def.accent;
      g.fillRect(-w * 0.32, -w * 0.347, w * 0.64, Math.max(0.8, w * 0.004));
    } else if (def.livery === 'cyan') {
      g.fillRect(-w * 0.43, -w * 0.205, w * 0.86, Math.max(0.7, w * 0.004));
    } else if (def.livery === 'gold') {
      g.fillRect(-w * 0.45, -w * 0.348, w * 0.9, Math.max(0.8, w * 0.006));
    } else if (def.livery === 'devil') {
      g.fillStyle = 'rgba(237,247,255,0.82)';
      g.fillRect(-w * 0.058, -w * 0.622, w * 0.044, w * 0.215);
      g.fillRect(w * 0.012, -w * 0.622, w * 0.044, w * 0.215);
      g.fillStyle = 'rgba(237,247,255,0.9)';
      g.fillRect(-w * 0.44, -w * 0.148, w * 0.88, Math.max(0.8, w * 0.0045));
    } else {
      g.fillRect(-w * 0.31, -w * 0.36, w * 0.62, Math.max(0.8, w * 0.005));
    }
    g.restore();
  }

  // 边缘高光
  g.strokeStyle = 'rgba(210,244,255,0.20)';
  g.lineWidth = Math.max(0.6, w * 0.0025);
  g.beginPath();
  g.moveTo(-w * 0.462, -w * 0.035);
  g.lineTo(-w * 0.487, -w * 0.255);
  g.stroke();

  g.restore();
}

function drawTrafficRear(g, t, p) {
  const w = t.w * p.scale;
  if (w < 2.2 || p.fwd < 0.9) return;
  const x = p.x;
  const y = p.y;
  if (x < -w * 2 || x > W + w * 2) return;

  const isTruck = t.type === 'truck';
  const isVan = t.type === 'van';
  const h = (isTruck ? 2.8 : isVan ? 1.65 : 1.15) * p.scale;

  g.save();
  // 影子
  g.save();
  g.globalAlpha = 0.55;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(x, y, w * 0.6, Math.max(1, w * 0.08), 0, 0, TAU);
  g.fill();
  g.restore();

  if (w < 7) {
    g.fillStyle = '#06090d';
    g.fillRect(x - w * 0.5, y - h * 0.8, w, h * 0.8);
    g.fillStyle = t.taillight;
    g.fillRect(x - w * 0.35, y - h * 0.47, w * 0.2, Math.max(0.6, w * 0.12));
    g.fillRect(x + w * 0.15, y - h * 0.47, w * 0.2, Math.max(0.6, w * 0.12));
    g.restore();
    return;
  }

  const bodyGrad = g.createLinearGradient(0, y - h, 0, y);
  bodyGrad.addColorStop(0, t.roof || '#1a232c');
  bodyGrad.addColorStop(0.15, t.color);
  bodyGrad.addColorStop(1, '#080c11');

  if (isTruck) {
    // 车厢
    g.fillStyle = bodyGrad;
    roundRectPath(g, x - w * 0.5, y - h, w, h * 0.88, Math.max(1, w * 0.025));
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.lineWidth = Math.max(0.7, w * 0.008);
    g.beginPath();
    g.moveTo(x, y - h);
    g.lineTo(x, y - h * 0.12);
    g.moveTo(x - w * 0.5, y - h * 0.64);
    g.lineTo(x + w * 0.5, y - h * 0.64);
    g.stroke();
    // 反光条
    g.fillStyle = 'rgba(255,211,94,0.64)';
    g.fillRect(x - w * 0.48, y - h * 0.24, w * 0.96, Math.max(1, h * 0.02));
    g.fillStyle = t.taillight;
    g.fillRect(x - w * 0.44, y - h * 0.18, w * 0.1, Math.max(1, h * 0.045));
    g.fillRect(x + w * 0.34, y - h * 0.18, w * 0.1, Math.max(1, h * 0.045));
    g.fillStyle = 'rgba(255,184,83,0.9)';
    for (let i = 0; i < 5; i++) g.fillRect(x - w * 0.4 + i * w * 0.2, y - h - Math.max(0.8, h * 0.02), Math.max(1, w * 0.03), Math.max(1, h * 0.018));
    // 保险杠
    g.fillStyle = '#0a0e13';
    g.fillRect(x - w * 0.52, y - h * 0.13, w * 1.04, h * 0.1);
  } else {
    const bodyH = h * 0.78;
    // 车身
    g.fillStyle = bodyGrad;
    roundRectPath(g, x - w * 0.5, y - bodyH, w, bodyH * 0.94, Math.max(1, w * 0.07));
    g.fill();
    // 车顶
    g.fillStyle = t.roof || '#111820';
    roundRectPath(g, x - w * 0.34, y - bodyH * 1.13, w * 0.68, bodyH * 0.52, Math.max(1, w * 0.05));
    g.fill();
    // 后窗
    const winGrad = g.createLinearGradient(0, y - bodyH * 1.05, 0, y - bodyH * 0.76);
    winGrad.addColorStop(0, '#07121b');
    winGrad.addColorStop(1, '#1a3340');
    g.fillStyle = winGrad;
    g.beginPath();
    g.moveTo(x - w * 0.28, y - bodyH * 1.08);
    g.lineTo(x + w * 0.28, y - bodyH * 1.08);
    g.lineTo(x + w * 0.31, y - bodyH * 0.74);
    g.lineTo(x - w * 0.31, y - bodyH * 0.74);
    g.closePath();
    g.fill();
    // 尾灯
    g.save();
    g.shadowColor = t.taillight;
    g.shadowBlur = w * 0.08;
    g.fillStyle = t.taillight;
    g.fillRect(x - w * 0.43, y - bodyH * 0.43, w * 0.22, Math.max(1, bodyH * 0.075));
    g.fillRect(x + w * 0.21, y - bodyH * 0.43, w * 0.22, Math.max(1, bodyH * 0.075));
    g.restore();
    // 牌照
    g.fillStyle = 'rgba(222,233,231,0.7)';
    g.fillRect(x - w * 0.1, y - bodyH * 0.23, w * 0.2, Math.max(1, bodyH * 0.08));
    // 保险杠 / 排气
    g.fillStyle = 'rgba(0,0,0,0.42)';
    g.fillRect(x - w * 0.5, y - bodyH * 0.14, w, bodyH * 0.12);
  }

  // 远距离的尾灯晕
  if (w > 10) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    drawGlow(t.taillight === '#ffd27b' ? 'amber' : 'red', x - w * 0.31, y - (isTruck ? h * 0.2 : h * 0.3), w * 0.45, 0.25);
    drawGlow(t.taillight === '#ffd27b' ? 'amber' : 'red', x + w * 0.31, y - (isTruck ? h * 0.2 : h * 0.3), w * 0.45, 0.25);
    g.restore();
  }
  g.restore();
}

function drawVehicles(cam) {
  const list = [];
  if (race) {
    const rv = race.rival;
    const ds = rv.s - cam.s;
    if (ds > 0.9) {
      const p = projectAt(rv.s, rv.x, 0);
      if (p) list.push({ kind: 'rival', p, obj: rv, fwd: p.fwd });
    }
  } else if (attract) {
    // 菜单里让对手从远处驶过
    const ghost = attract.ghost;
    if (ghost) {
      const ds = ghost.s - cam.s;
      if (ds > 0.9) {
        const p = projectAt(ghost.s, ghost.x, 0);
        if (p) list.push({ kind: 'rival', p, obj: ghost, fwd: p.fwd });
      }
    }
  }

  const traffic = race ? race.traffic : attract ? attract.traffic : [];
  for (const t of traffic) {
    const ds = t.s - cam.s;
    if (ds < 1 || ds > 330) continue;
    const p = projectAt(t.s, t.x, 0);
    if (p) list.push({ kind: 'traffic', p, obj: t, fwd: p.fwd });
  }
  list.sort((a, b) => b.fwd - a.fwd);

  for (const item of list) {
    if (item.kind === 'traffic') {
      drawTrafficRear(ctx, item.obj, item.p);
    } else {
      const rv = item.obj;
      const w = wForProjection(rv, item.p);
      if (w < 1) continue;
      const isPlayerCar = false;
      drawCarRear(ctx, item.p.x, item.p.y, w, {
        def: rv.def,
        speed: rv.speed,
        time: visuals.time,
        tilt: -rv.steer * 0.02,
        brake: false,
        nitro: !!rv.boostVisual,
        bounce: Math.sin(visuals.time * 26 + 1.4) * clamp(rv.speed / 80, 0, 1) * 0.8
      });
      // 对手标签
      if (item.p.fwd < 190 && w > 8) {
        const y = item.p.y - w * 0.82;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = `600 ${clamp(w * 0.055, 7, 14)}px "Bahnschrift",sans-serif`;
        ctx.fillStyle = 'rgba(255,84,102,0.9)';
        ctx.fillText(item.obj.def.name, item.p.x, y - 9);
        ctx.strokeStyle = 'rgba(255,60,83,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(item.p.x - Math.min(42, w * 0.32), y - 5);
        ctx.lineTo(item.p.x + Math.min(42, w * 0.32), y - 5);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function wForProjection(obj, p) {
  const widthM = 1.92;
  return clamp(widthM * p.scale, 1.2, W * 1.5);
}

function drawPlayerCar(cam) {
  let p, def, speed, steer, brake, nitro;
  if (race) {
    p = race.player;
    def = p.def;
    speed = p.speed;
    steer = p.steer;
    brake = keys.down || touchState.down;
    nitro = p.nitroWas || (p.nitro > 0 && (keys.nitro || touchState.nitro));
  } else if (attract) {
    def = secretMode.active ? SECRET_CARS[secretCarIndex] : CARS[selectedCar];
    speed = attract.speed;
    steer = attract.steer;
    brake = false;
    nitro = false;
    p = attract;
  } else {
    return;
  }
  const lateral = race ? p.x : p.lateral;
  const pos = projectAt(p.s, lateral, 0);
  if (!pos) return;
  const w = clamp(Math.min(W * 0.43, H * 0.305), 150, 370);
  const carX = clamp(pos.x, w * 0.56, W - w * 0.56);
  drawCarRear(ctx, carX, pos.y, w, {
    def,
    speed,
    time: visuals.time,
    tilt: -steer * 0.027,
    brake,
    nitro,
    bounce: Math.sin(visuals.time * 39) * clamp(speed / 90, 0, 1) * 2.1
  });
}

function drawRivalGhost(dt) {
  if (!attract) return;
  if (!attract.ghost) {
    attract.ghost = createRacer(RIVAL_DEF, false);
    attract.ghost.s = attract.s + 135;
    attract.ghost.x = LANE_X[2];
    attract.ghost.speed = 36;
  }
  const gh = attract.ghost;
  gh.s += (gh.speed - attract.speed) * dt;
  if (gh.s < attract.s - 50) {
    gh.s = attract.s + rand(160, 260);
    gh.x = LANE_X[randInt(0, 3)];
    gh.speed = rand(33, 43);
  }
}

/* ----------------------------- 屏幕效果 ----------------------------- */
function drawSpeedLines(norm, nitro) {
  if (norm < 0.38) return;
  const strength = Math.pow(clamp((norm - 0.38) / 0.62, 0, 1), 1.7);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < (nitro ? 34 : 24); i++) {
    const seed = Math.sin(i * 127.1 + 31.7) * 43758.5453;
    const a = (seed - Math.floor(seed)) * TAU;
    const phase = mod(visuals.time * (1.8 + strength * 3.4) + i * 0.137, 1);
    const r0 = H * (0.17 + phase * 0.46);
    const r1 = r0 + H * (0.09 + strength * 0.17) * (0.3 + (i % 5) * 0.18);
    const cx = W * 0.5;
    const cy = HORIZON + H * 0.03;
    const x0 = cx + Math.cos(a) * r0 * (W / H) * 0.78;
    const y0 = cy + Math.sin(a) * r0;
    const x1 = cx + Math.cos(a) * r1 * (W / H) * 0.78;
    const y1 = cy + Math.sin(a) * r1;
    const fade = Math.sin(phase * Math.PI);
    ctx.strokeStyle = nitro
      ? `rgba(255,${160 + (i % 4) * 18},${70 + (i % 3) * 30},${0.12 * strength * fade})`
      : `rgba(203,246,255,${0.10 * strength * fade})`;
    ctx.lineWidth = 1 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  if (nitro) {
    const edge = ctx.createLinearGradient(0, 0, W, 0);
    edge.addColorStop(0, 'rgba(255,82,40,0.24)');
    edge.addColorStop(0.2, 'rgba(255,82,40,0)');
    edge.addColorStop(0.8, 'rgba(60,224,255,0)');
    edge.addColorStop(1, 'rgba(60,224,255,0.18)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawSparks() {
  if (!visuals.sparks.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of visuals.sparks) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

function drawScreenFx() {
  const p = race ? race.player : null;
  const speedNorm = p ? clamp(p.speed / (p.def.topSpeed / 3.6), 0, 1.15) : attract ? 0.36 : 0;
  const nitro = p ? p.nitroWas : false;
  drawSpeedLines(speedNorm, nitro);
  drawSparks();

  if (visuals.flash > 0.01) {
    ctx.fillStyle = `rgba(${visuals.flashColor},${clamp(visuals.flash, 0, 0.75)})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (p && p.sp < 260 && !race.over && mode === 'race') {
    const a = (1 - p.sp / 260) * (0.14 + Math.sin(visuals.time * 6) * 0.05);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.68);
    g.addColorStop(0, 'rgba(255,27,58,0)');
    g.addColorStop(1, `rgba(255,27,58,${clamp(a, 0, 0.3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 隧道暗角 / 顶部灯带
  const refS = race ? race.player.s : attract ? attract.s : 0;
  if (isTunnelAt(refS)) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,2,6,0.88)');
    g.addColorStop(0.36, 'rgba(1,4,8,0.62)');
    g.addColorStop(0.7, 'rgba(1,4,8,0.14)');
    g.addColorStop(1, 'rgba(0,2,6,0.26)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const cam = world.cam;
    if (cam) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const start = Math.ceil((cam.s + 4) / 18) * 18;
      for (let s = start; s < cam.s + 210; s += 18) {
        const fade = clamp(1 - (s - cam.s) / 220, 0, 1);
        for (const lat of [-3.4, 3.4]) {
          const p = projectAt(s, lat, 5.65);
          if (!p) continue;
          drawGlow('amber', p.x, p.y, clamp(p.scale * 2.6, 8, 150), 0.3 * fade);
          ctx.fillStyle = `rgba(255,228,178,${0.72 * fade})`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, clamp(p.scale * 0.2, 1, 12), clamp(p.scale * 0.05, 0.6, 3), 0, 0, TAU);
          ctx.fill();
        }
      }
      // 顶部弧线
      ctx.strokeStyle = 'rgba(255,157,72,0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let started = false;
      for (let s = cam.s + 8; s < cam.s + 200; s += 16) {
        const p = projectAt(s, 0, 5.9);
        if (!p) continue;
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawRearviewMirror() {
  if (!race || race.story || W < 700 || H < 520 || mode === 'result') return;
  const mw = Math.min(260, W * 0.19);
  const mh = mw * 0.235;
  const x = W * 0.5;
  const y = H * 0.142;
  const left = x - mw / 2;
  const top = y;
  const p = race.player;
  const rv = race.rival;

  ctx.save();
  // 镜框外壳
  ctx.fillStyle = 'rgba(2,5,9,0.88)';
  roundRectPath(ctx, left - 4, top - 4, mw + 8, mh + 8, 10);
  ctx.fill();
  ctx.beginPath();
  roundRectPath(ctx, left, top, mw, mh, 7);
  ctx.clip();

  const bg = ctx.createLinearGradient(0, top, 0, top + mh);
  bg.addColorStop(0, 'rgba(30,49,63,0.9)');
  bg.addColorStop(0.4, 'rgba(10,20,30,0.96)');
  bg.addColorStop(1, 'rgba(4,8,13,0.98)');
  ctx.fillStyle = bg;
  ctx.fillRect(left, top, mw, mh);

  // 镜中道路
  const hz = top + mh * 0.4;
  ctx.fillStyle = 'rgba(8,15,23,0.98)';
  ctx.fillRect(left, hz, mw, mh);
  const mfog = ctx.createLinearGradient(0, hz - mh * 0.25, 0, hz);
  mfog.addColorStop(0, 'rgba(255,140,100,0)');
  mfog.addColorStop(1, 'rgba(255,140,100,0.08)');
  ctx.fillStyle = mfog;
  ctx.fillRect(left, hz - mh * 0.25, mw, mh * 0.25);
  ctx.strokeStyle = 'rgba(137,198,217,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, hz);
  ctx.lineTo(left + mw, hz);
  ctx.stroke();
  ctx.fillStyle = 'rgba(25,42,55,1)';
  ctx.beginPath();
  ctx.moveTo(x - mw * 0.5, top + mh);
  ctx.lineTo(x - mw * 0.08, hz + 1);
  ctx.lineTo(x + mw * 0.08, hz + 1);
  ctx.lineTo(x + mw * 0.5, top + mh);
  ctx.closePath();
  ctx.fill();
  // 镜中护栏
  ctx.strokeStyle = 'rgba(87,135,151,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(left + 2, top + mh);
  ctx.lineTo(x - mw * 0.08, hz + 1);
  ctx.moveTo(left + mw - 2, top + mh);
  ctx.lineTo(x + mw * 0.08, hz + 1);
  ctx.stroke();
  // 车道线
  ctx.strokeStyle = 'rgba(225,242,247,0.51)';
  ctx.lineWidth = 1;
  for (const off of [-0.26, 0, 0.26]) {
    ctx.beginPath();
    ctx.moveTo(x + mw * off * 0.6, top + mh);
    ctx.lineTo(x + mw * off * 0.17, hz + 1);
    ctx.stroke();
  }
  // 地平线灯火
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const lx = left + 12 + ((i * 37 + 17) % (mw - 24));
    drawGlow(i % 2 ? 'amber' : 'cyan', lx, hz - 2, 13, 0.1);
  }
  ctx.restore();

  const drawBehindLight = (carX, dist, isRival) => {
    const rel = clamp((carX - p.x) / 7.6, -1, 1);
    const cx = x + rel * mw * 0.33;
    const depth = clamp(1 - dist / 100, 0, 1);
    const cy = top + mh * (0.63 + depth * 0.24);
    const sz = clamp(9 + depth * 26, 7, 34);
    if (isRival) {
      // 对手车头 / 大灯
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('cyan', cx - sz * 0.34, cy, sz * 1.7, 0.24 + depth * 0.25);
      drawGlow('cyan', cx + sz * 0.34, cy, sz * 1.7, 0.24 + depth * 0.25);
      ctx.restore();
      ctx.fillStyle = 'rgba(3,6,10,0.97)';
      roundRectPath(ctx, cx - sz * 0.5, cy - sz * 0.3, sz, sz * 0.48, sz * 0.14);
      ctx.fill();
      ctx.fillStyle = 'rgba(225,250,255,0.92)';
      ctx.beginPath();
      ctx.arc(cx - sz * 0.34, cy, Math.max(1, sz * 0.075), 0, TAU);
      ctx.arc(cx + sz * 0.34, cy, Math.max(1, sz * 0.075), 0, TAU);
      ctx.fill();
      if (depth > 0.55) {
        ctx.fillStyle = 'rgba(255,64,83,0.78)';
        ctx.font = '600 7px "Bahnschrift", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(race.rival.def.name, cx, cy - sz * 0.54);
      }
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('amber', cx - sz * 0.25, cy, sz * 0.9, 0.14 + depth * 0.15);
      drawGlow('amber', cx + sz * 0.25, cy, sz * 0.9, 0.14 + depth * 0.15);
      ctx.restore();
      ctx.fillStyle = 'rgba(8,12,17,0.92)';
      ctx.fillRect(cx - sz * 0.4, cy - sz * 0.2, sz * 0.8, sz * 0.3);
    }
  };

  // 后方车流
  for (const t of race.traffic) {
    const dist = p.s - t.s;
    if (dist > 4 && dist < 105) drawBehindLight(t.x, dist, false);
  }
  // 后方的对手
  if (rv.s < p.s - 3) drawBehindLight(rv.x, p.s - rv.s, true);

  // 玻璃反光 / 顶部渐隐
  const shine = ctx.createLinearGradient(left, top, left + mw, top + mh);
  shine.addColorStop(0, 'rgba(150,225,245,0.10)');
  shine.addColorStop(0.35, 'rgba(150,225,245,0)');
  shine.addColorStop(1, 'rgba(255,255,255,0.035)');
  ctx.fillStyle = shine;
  ctx.fillRect(left, top, mw, mh);
  const fade = ctx.createLinearGradient(0, top, 0, top + 16);
  fade.addColorStop(0, 'rgba(3,7,12,0.7)');
  fade.addColorStop(1, 'rgba(3,7,12,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(left, top, mw, 16);

  ctx.restore();

  // 镜框
  ctx.save();
  ctx.strokeStyle = 'rgba(141,211,235,0.32)';
  ctx.lineWidth = 1.2;
  roundRectPath(ctx, left, top, mw, mh, 8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(210,247,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left + 14, top + 1);
  ctx.lineTo(left + mw - 14, top + 1);
  ctx.stroke();
  ctx.restore();
}

/* ----------------------------- 车库预览 ----------------------------- */
function drawCarPreview() {
  const cv = UI.carPreview;
  if (!cv) return;
  const g = cv.getContext('2d');
  const GW = cv.width, GH = cv.height;
  g.clearRect(0, 0, GW, GH);

  const bg = g.createRadialGradient(GW * 0.50, GH * 0.52, 20, GW * 0.50, GH * 0.55, GW * 0.6);
  bg.addColorStop(0, 'rgba(22,82,101,0.18)');
  bg.addColorStop(0.55, 'rgba(7,18,28,0.08)');
  bg.addColorStop(1, 'rgba(2,5,9,0)');
  g.fillStyle = bg;
  g.fillRect(0, 0, GW, GH);

  // 背景光弧
  g.save();
  g.translate(GW * 0.5, GH * 0.54);
  g.globalAlpha = 0.28;
  g.strokeStyle = 'rgba(99,239,255,0.34)';
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.ellipse(0, GH * 0.09, GW * (0.22 + i * 0.055), GH * (0.05 + i * 0.018), 0, 0, TAU);
    g.stroke();
  }
  g.restore();

  // 地面网格
  g.save();
  g.strokeStyle = 'rgba(99,239,255,0.15)';
  g.lineWidth = 1;
  const floorY = GH * 0.78;
  for (let i = 0; i < 12; i++) {
    const y = floorY + Math.pow(i / 11, 1.5) * GH * 0.2;
    g.beginPath();
    g.moveTo(GW * 0.05, y);
    g.lineTo(GW * 0.95, y);
    g.stroke();
  }
  for (let i = -5; i <= 5; i++) {
    g.beginPath();
    g.moveTo(GW * 0.5 + i * GW * 0.04, floorY);
    g.lineTo(GW * 0.5 + i * GW * 0.16, GH);
    g.stroke();
  }
  g.restore();

  const def = CARS[selectedCar];
  const bob = Math.sin(visuals.time * 1.6) * 2.5;
  // 车底光圈
  g.save();
  g.globalCompositeOperation = 'lighter';
  const glow = g.createRadialGradient(GW * 0.5, floorY, 0, GW * 0.5, floorY, GW * 0.3);
  glow.addColorStop(0, 'rgba(46,196,222,0.20)');
  glow.addColorStop(1, 'rgba(46,196,222,0)');
  g.fillStyle = glow;
  g.fillRect(0, floorY - GH * 0.2, GW, GH * 0.5);
  g.restore();

  drawCarRear(g, GW * 0.5, floorY + bob, GW * 0.56, {
    def,
    speed: 0,
    time: visuals.time,
    tilt: Math.sin(visuals.time * 0.45) * 0.003,
    brake: false,
    nitro: false,
    bounce: 0
  });

  // 细碎反光
  g.save();
  g.globalAlpha = 0.22;
  g.fillStyle = '#9ff7ff';
  for (let i = 0; i < 6; i++) {
    const x = GW * (0.2 + ((i * 37) % 60) / 100);
    const y = floorY - 20 - (i * 27) % 130;
    g.fillRect(x, y, 1, 1);
  }
  g.restore();
}

/* ----------------------------- 主渲染 ----------------------------- */
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#03060b';
  ctx.fillRect(0, 0, W, H);

  const cam = world.cam;
  if (!cam) return;
  const shake = visuals.shake;
  const sx = shake ? (Math.random() - 0.5) * shake * 11 : 0;
  const sy = shake ? (Math.random() - 0.5) * shake * 8 : 0;

  ctx.save();
  ctx.translate(sx, sy);

  drawSky(cam);
  const refS = race ? race.player.s : attract ? attract.s : 0;
  const activeFinish = race ? race.finishS : FINISH_S;
  drawRoad(cam, refS);
  drawProps(cam, refS, activeFinish);
  drawVehicles(cam);
  if (mode !== 'garage') drawPlayerCar(cam);

  ctx.restore();

  drawScreenFx();
  drawRearviewMirror();

  if (mode === 'garage') drawCarPreview();
  if (mode === 'menu' && !UI.secretMenu.classList.contains('hidden')) drawSecretPreview();
}

/* ============================================================
   UI / 流程 / 输入 / 主循环
   ============================================================ */

function initNitroSegments() {
  UI.nitroSegments.innerHTML = '';
  for (let i = 0; i < 16; i++) UI.nitroSegments.appendChild(document.createElement('i'));
}

function buildGarageCards() {
  UI.carCards.innerHTML = '';
  CARS.forEach((car, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'car-card' + (i === selectedCar ? ' active' : '');
    b.style.setProperty('--swatch', car.accent);
    b.innerHTML = `<span class="cc-num">0${i + 1}</span>
      <span class="cc-info"><span class="cc-name">${car.name}</span><span class="cc-sub">${car.sub}</span></span>
      <span class="cc-key">SELECT</span>`;
    b.addEventListener('click', () => {
      if (selectedCar !== i) {
        selectedCar = i;
        audio.resume();
        audio.blip(620 + i * 70, 0.07, 'square', 0.05);
      }
      attachCarUI(i);
      drawCarPreview();
    });
    UI.carCards.appendChild(b);
  });
}

function attachCarUI(index = selectedCar) {
  selectedCar = clamp(index, 0, CARS.length - 1);
  const car = CARS[selectedCar];
  UI.menuCarName.textContent = car.name;
  UI.menuCarSub.textContent = car.sub;
  UI.menuCarClass.textContent = car.cls;
  UI.menuCarDots.innerHTML = CARS.map((_, i) => `<i class="${i === selectedCar ? 'on' : ''}"></i>`).join('');

  UI.carIndex.textContent = `0${selectedCar + 1} / 0${CARS.length}`;
  UI.carName.textContent = car.name;
  UI.carSub.textContent = car.sub;
  UI.carDesc.textContent = car.desc;
  UI.previewTag.textContent = car.sub.replace(' · ', ' / ');
  UI.statSpeed.style.width = car.bars.speed + '%';
  UI.statAccel.style.width = car.bars.accel + '%';
  UI.statGrip.style.width = car.bars.grip + '%';
  UI.statSpeedVal.textContent = car.labels.speed;
  UI.statAccelVal.textContent = car.labels.accel;
  UI.statGripVal.textContent = car.labels.grip;
  UI.carSpecial.innerHTML = `<span>SPECIAL</span><p>${car.special}</p>`;
  document.documentElement.style.setProperty('--current-car', car.accent);

  const cards = UI.carCards.querySelectorAll('.car-card');
  cards.forEach((c, i) => c.classList.toggle('active', i === selectedCar));
}

function changeCar(dir) {
  selectedCar = (selectedCar + dir + CARS.length) % CARS.length;
  attachCarUI(selectedCar);
  audio.resume();
  audio.blip(640 + selectedCar * 60, 0.06, 'square', 0.045);
  drawCarPreview();
}

function hideScreensForRace() {
  UI.menu.classList.add('hidden');
  UI.garage.classList.add('hidden');
  UI.pause.classList.add('hidden');
  UI.result.classList.add('hidden');
  UI.secretMenu.classList.add('hidden');
  hideStoryBox();
  UI.hud.classList.remove('hidden');
}

function showHudHUD() {
  UI.hud.classList.remove('hidden');
  UI.pause.classList.add('hidden');
  UI.result.classList.add('hidden');
  UI.secretMenu.classList.add('hidden');
}

/* ----------------------------- 秘密模式 ----------------------------- */
function resetSecretBuffer() {
  secretMode.buffer = '';
  if (secretMode.timer) {
    clearTimeout(secretMode.timer);
    secretMode.timer = 0;
  }
}

function armSecretBuffer() {
  if (secretMode.timer) clearTimeout(secretMode.timer);
  secretMode.timer = setTimeout(() => {
    secretMode.buffer = '';
    secretMode.timer = 0;
  }, 6000);
}

function clearSecretState() {
  secretMode.active = false;
  resetSecretBuffer();
  UI.secretMenu.classList.add('hidden');
  document.body.classList.remove('secret-on');
}

function drawSecretPreview() {
  const cv = UI.secretPreview;
  if (!cv) return;
  const g = cv.getContext('2d');
  const GW = cv.width, GH = cv.height;
  g.clearRect(0, 0, GW, GH);
  const car = SECRET_CARS[secretCarIndex];

  const bg = g.createRadialGradient(GW * 0.5, GH * 0.52, 12, GW * 0.5, GH * 0.55, GW * 0.58);
  bg.addColorStop(0, 'rgba(28, 103, 128, 0.19)');
  bg.addColorStop(0.6, 'rgba(6, 17, 27, 0.06)');
  bg.addColorStop(1, 'rgba(2, 5, 9, 0)');
  g.fillStyle = bg;
  g.fillRect(0, 0, GW, GH);

  g.save();
  g.translate(GW * 0.5, GH * 0.55);
  g.strokeStyle = 'rgba(99,239,255,0.2)';
  g.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(0, GH * 0.1, GW * (0.21 + i * 0.07), GH * (0.055 + i * 0.022), 0, 0, TAU);
    g.stroke();
  }
  g.restore();

  const floorY = GH * 0.79;
  g.save();
  g.strokeStyle = 'rgba(99,239,255,0.14)';
  g.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const y = floorY + Math.pow(i / 8, 1.5) * GH * 0.19;
    g.beginPath(); g.moveTo(GW * 0.04, y); g.lineTo(GW * 0.96, y); g.stroke();
  }
  for (let i = -5; i <= 5; i++) {
    g.beginPath();
    g.moveTo(GW * 0.5 + i * GW * 0.04, floorY);
    g.lineTo(GW * 0.5 + i * GW * 0.16, GH);
    g.stroke();
  }
  g.restore();

  g.save();
  g.globalCompositeOperation = 'lighter';
  const glow = g.createRadialGradient(GW * 0.5, floorY, 0, GW * 0.5, floorY, GW * 0.31);
  glow.addColorStop(0, car.id === 'devil-z' ? 'rgba(48, 197, 224, 0.22)' : 'rgba(255, 55, 88, 0.18)');
  glow.addColorStop(1, 'rgba(48, 197, 224, 0)');
  g.fillStyle = glow;
  g.fillRect(0, floorY - GH * 0.22, GW, GH * 0.45);
  g.restore();

  drawCarRear(g, GW * 0.5, floorY + Math.sin(visuals.time * 1.5) * 2, GW * 0.64, {
    def: car,
    speed: 0,
    time: visuals.time,
    tilt: Math.sin(visuals.time * 0.45) * 0.003,
    brake: false,
    nitro: false,
    bounce: 0
  });
}

function refreshSecretGarageUI() {
  const car = SECRET_CARS[secretCarIndex];
  const rival = SECRET_CARS[1 - secretCarIndex];
  const isDevil = car.id === 'devil-z';
  UI.secretTitle.innerHTML = isDevil ? 'DEVIL <span>Z</span>' : 'BLACK<span>WING</span>';
  UI.secretTitle.classList.toggle('long', !isDevil);
  UI.secretDesc.textContent = isDevil
    ? '被诅咒的蓝色 S30。三升直六双涡轮，湾岸夜战的起点。'
    : '冷静的黑色 911 Turbo。像一把贴着路面飞行的手术刀。';
  UI.secretRival.textContent = rival.name;
  UI.secretPreviewTag.textContent = `${car.sub} · ${car.name}`;
  UI.secretWatermark.textContent = isDevil ? 'Z' : 'B';
  const collisionsOn = secretMode.trafficCollision;
  UI.btnTrafficCollision.classList.toggle('on', collisionsOn);
  UI.btnTrafficCollision.setAttribute('aria-checked', String(collisionsOn));
  UI.secretCollisionState.textContent = collisionsOn ? '开启 / ON' : '关闭 / OFF';
  UI.secretCarOptions.querySelectorAll('[data-secret-car]').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.secretCar) === secretCarIndex);
  });
  const label = UI.btnSecretRace.querySelector('.btn-label');
  if (label) label.textContent = `驾驶 ${car.name} 追走`;

  UI.menuCarName.textContent = car.name;
  UI.menuCarSub.textContent = car.sub;
  UI.menuCarClass.textContent = isDevil ? 'CURSED / FR' : 'GHOST / FR';
  UI.menuCarDots.innerHTML = '<i class="on"></i><i class="on"></i><i class="on"></i>';
  drawSecretPreview();
}

function selectSecretCar(index) {
  secretCarIndex = clamp(index, 0, SECRET_CARS.length - 1);
  refreshSecretGarageUI();
  audio.resume();
  audio.blip(560 + secretCarIndex * 90, 0.06, 'square', 0.05);
}

function toggleTrafficCollision() {
  secretMode.trafficCollision = !secretMode.trafficCollision;
  refreshSecretGarageUI();
  audio.resume();
  audio.blip(secretMode.trafficCollision ? 640 : 360, 0.07, 'square', 0.06);
}

function unlockSecret() {
  if (mode !== 'menu') return;
  resetSecretBuffer();
  secretMode.active = true;
  secretMode.unlocked = true;
  UI.helpPanel.classList.remove('open');
  UI.secretMenu.classList.remove('hidden');
  document.body.classList.add('secret-on');
  refreshSecretGarageUI();
  visuals.flash = 0.42;
  visuals.flashColor = '255,120,75';
  visuals.shake = 0.45;
  audio.resume();
  audio.secretUnlock();
}

function closeSecretMenu() {
  clearSecretState();
  attachCarUI(selectedCar);
  toast('秘密模式已关闭');
}

function startSecretRace() {
  if (!secretMode.active) return;
  UI.secretMenu.classList.add('hidden');
  startRace(selectedCar);
}

function handleSecretTyping(e) {
  if (mode !== 'menu' || !UI.secretMenu.classList.contains('hidden')) return false;
  if (e.repeat) return secretMode.buffer.length > 0;
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (typeof e.key !== 'string' || e.key.length !== 1) return false;
  const ch = e.key.toLowerCase();
  if (!/[a-z ]/.test(ch)) return false;

  if (!secretMode.buffer) {
    if (ch !== SECRET_PHRASE[0]) return false;
    secretMode.buffer = ch;
    armSecretBuffer();
    return true;
  }

  if (ch !== SECRET_PHRASE[secretMode.buffer.length]) {
    resetSecretBuffer();
    return false;
  }

  secretMode.buffer += ch;
  if (secretMode.buffer === SECRET_PHRASE) {
    resetSecretBuffer();
    unlockSecret();
    return true;
  }
  armSecretBuffer();
  return true;
}

function showMainMenu() {
  mode = 'menu';
  race = null;
  debugAuto = false;
  clearSecretState();
  document.body.classList.remove('racing');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  UI.menu.classList.remove('hidden');
  UI.garage.classList.add('hidden');
  UI.pause.classList.add('hidden');
  UI.result.classList.add('hidden');
  UI.hud.classList.add('hidden');
  UI.secretMenu.classList.add('hidden');
  UI.helpPanel.classList.remove('open');
  UI.centerMessage.classList.remove('show');
  hideStoryBox();
  keys.up = keys.down = keys.left = keys.right = keys.nitro = false;
  updateMenuBest();
  attachCarUI(selectedCar);
  audio.updateEngine(0, 85, 0, false, false, false);
  updateCameraAttract(0.016);
}

function showGarage() {
  mode = 'garage';
  race = null;
  debugAuto = false;
  clearSecretState();
  document.body.classList.remove('racing');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  UI.menu.classList.add('hidden');
  UI.garage.classList.remove('hidden');
  UI.pause.classList.add('hidden');
  UI.result.classList.add('hidden');
  UI.hud.classList.add('hidden');
  UI.secretMenu.classList.add('hidden');
  UI.centerMessage.classList.remove('show');
  hideStoryBox();
  keys.up = keys.down = keys.left = keys.right = keys.nitro = false;
  attachCarUI(selectedCar);
  audio.updateEngine(0, 85, 0, false, false, false);
  requestAnimationFrame(drawCarPreview);
}

function togglePause() {
  if (mode === 'race' && race && !race.over) {
    mode = 'paused';
    document.body.classList.remove('racing');
    UI.pause.classList.remove('hidden');
    keys.up = keys.down = keys.left = keys.right = keys.nitro = false;
    audio.pause();
  } else if (mode === 'paused') {
    mode = 'race';
    document.body.classList.add('racing');
    UI.pause.classList.add('hidden');
    audio.resume();
  }
}

function resumeRace() {
  if (mode !== 'paused') return;
  mode = 'race';
  document.body.classList.add('racing');
  UI.pause.classList.add('hidden');
  audio.resume();
}

/* ----------------------------- HUD ----------------------------- */
function updateHud(dt) {
  if (!race) return;
  const p = race.player, rv = race.rival;
  const finishS = race.finishS || FINISH_S;
  const total = race.raceLen || RACE_LEN;
  const prog = clamp((p.s - START_S) / total, 0, 1) * 100;
  const rprog = clamp((rv.s - START_S) / total, 0, 1) * 100;

  UI.progressFill.style.width = prog.toFixed(2) + '%';
  UI.playerPin.style.left = prog.toFixed(2) + '%';
  UI.rivalPin.style.left = rprog.toFixed(2) + '%';
  UI.raceTimer.textContent = fmtTime(race.time);
  UI.remainDist.textContent = (clamp((finishS - p.s) / 1000, 0, total / 1000)).toFixed(2) + ' km';
  UI.topSpeedHud.textContent = kmh(p.topSpeed) + ' km/h';

  const gap = rv.s - p.s;
  if (Math.abs(gap) < 2.6) {
    UI.gapText.textContent = '并排 / SIDE BY SIDE';
  } else if (gap > 0) {
    UI.gapText.textContent = '落后 ' + fmtGap(gap);
  } else {
    UI.gapText.textContent = '领先 ' + fmtGap(gap);
  }
  UI.positionText.textContent = p.s >= rv.s ? 'P1 / 2' : 'P2 / 2';

  UI.speedVal.textContent = Math.round(p.speed * 3.6);
  UI.gearVal.textContent = p.gear;
  UI.rpmFill.style.width = (clamp((p.rpm - 1000) / 7900, 0, 1) * 100).toFixed(1) + '%';
  UI.shiftHint.textContent = p.nitroWas ? 'N₂O' : 'AUTO';

  UI.playerSpText.textContent = race.secret ? '∞' : Math.ceil(p.sp);
  UI.rivalSpText.textContent = Math.ceil(rv.sp);
  UI.playerSpBar.style.width = (race.secret ? 100 : p.sp / 10).toFixed(1) + '%';
  UI.rivalSpBar.style.width = (rv.sp / 10).toFixed(1) + '%';

  UI.nitroPct.textContent = Math.round(p.nitro) + '%';
  const lit = Math.round(p.nitro / 100 * 16);
  const segs = UI.nitroSegments.children;
  for (let i = 0; i < segs.length; i++) {
    segs[i].className = i < lit ? (p.nitroWas ? 'on boost' : 'on') : '';
  }

  const inBattle = race.battle > 0.025 && !race.over;
  UI.spBattleTag.classList.toggle('on', inBattle || race.secret);
  UI.battleGlow.classList.toggle('on', inBattle);
  UI.comboHud.classList.toggle('on', p.combo > 0);
  UI.comboVal.textContent = p.combo;

  const z = zoneAt(p.s);
  if (UI.zoneName.textContent !== z.name) {
    UI.zoneJp.textContent = z.jp;
    UI.zoneName.textContent = z.name;
    UI.zoneFlavor.textContent = z.flavor;
  }
}

function showResultScreen() {
  if (!race) return;
  mode = 'result';
  hideStoryBox();
  document.body.classList.remove('racing');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  UI.hud.classList.add('hidden');
  UI.result.classList.remove('hidden');
  const r = race;
  const p = r.player;
  const win = r.win;
  const time = r.time;
  const hitCount = p.hits;
  const near = p.nearMisses;
  const sp = Math.ceil(p.sp);
  const secret = !!r.secret;

  UI.resultKicker.textContent = secret ? `追走战 // ${r.player.def.name} vs ${r.rival.def.name}` : r.reason;
  UI.resultTitle.textContent = win ? 'WIN' : 'LOSE';
  UI.resultTitle.className = secret ? 'secret' : win ? 'win' : 'lose';
  UI.resultSub.textContent = secret
    ? (r.rivalFinished
      ? `${r.player.def.name} 追到了终点。${r.rival.def.name} 虽然先行冲线，但今夜没有人真正甩掉你。`
      : `${r.player.def.name} 追上了 ${r.rival.def.name}。今夜的湾岸没有败北，只有后视镜里越来越远的尾灯。`)
    : win
      ? (r.reason.includes('K.O.') ? '黑色幽灵停在湾岸，后视镜里终于安静了。' : '你率先穿过终点，湾岸记住了这道尾灯。')
      : (r.reason.includes('SP ZERO') ? '精神值归零。你还能听见引擎在耳边空转。' : '还差一点。下一个夜晚，把油门踩得更深。');

  UI.resTime.textContent = fmtTime(time);
  UI.resTopSpeed.textContent = kmh(p.topSpeed) + ' km/h';
  UI.resDistance.textContent = ((clamp(p.s, START_S, r.finishS || FINISH_S) - START_S) / 1000).toFixed(2) + ' KM';
  UI.resNearMiss.textContent = String(near);
  UI.resHits.textContent = String(hitCount);
  UI.resSp.textContent = secret ? '∞' : String(sp);

  let grade = '—';
  if (secret) {
    grade = 'EX';
  } else if (win) {
    let pts = 0;
    if (time < 105) pts += 3; else if (time < 118) pts += 2; else if (time < 134) pts += 1;
    if (hitCount === 0) pts += 2; else if (hitCount <= 2) pts += 1;
    if (near >= 8) pts += 1;
    if (sp > 620) pts += 1;
    grade = pts >= 6 ? 'S' : pts >= 4 ? 'A' : pts >= 2 ? 'B' : 'C';
  } else {
    const gap = Math.max(0, r.rival.s - r.player.s);
    grade = gap < 80 ? 'B' : gap < 240 ? 'C' : 'D';
  }
  UI.resGrade.textContent = grade;
  UI.resRecord.classList.toggle('on', !!r.newRecord && !secret);
  UI.resRecord.textContent = r.newRecord && !secret ? 'NEW RECORD' : '';
  audio.updateEngine(0, 85, 0, false, false, false);
}

/* ----------------------------- 输入 ----------------------------- */
function keyToAction(code) {
  if (code === 'KeyW' || code === 'ArrowUp') return 'up';
  if (code === 'KeyS' || code === 'ArrowDown') return 'down';
  if (code === 'KeyA' || code === 'ArrowLeft') return 'left';
  if (code === 'KeyD' || code === 'ArrowRight') return 'right';
  if (code === 'Space') return 'nitro';
  return null;
}

function bindEvents() {
  document.addEventListener('keydown', e => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(code)) e.preventDefault();
    audio.resume();

    // 秘密菜单打开时，只接受确认 / 关闭
    if (UI.secretMenu && !UI.secretMenu.classList.contains('hidden')) {
      if (code === 'Escape' || code === 'KeyP') { closeSecretMenu(); return; }
      if (code === 'Enter' || code === 'Space') { startSecretRace(); return; }
      return;
    }

    // 主菜单输入隐藏指令：WANGAN MIDNIGHT（不区分大小写）
    if (mode === 'menu' && handleSecretTyping(e)) return;

    if (code === 'KeyM' && !e.repeat) {
      audio.setMuted(!audio.muted);
      toast(audio.muted ? '已静音' : '声音开启');
      return;
    }

    if (code === 'Escape' || code === 'KeyP') {
      if (mode === 'menu') resetSecretBuffer();
      if (mode === 'race' && race && !race.over) { togglePause(); return; }
      if (mode === 'paused') { resumeRace(); return; }
      if (mode === 'garage') { showMainMenu(); return; }
      if (mode === 'result') { showGarage(); return; }
      return;
    }

    if (mode === 'menu' || mode === 'garage') {
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowUp' || code === 'KeyW') {
        if (!e.repeat) changeCar(-1);
        return;
      }
      if (code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowDown' || code === 'KeyS') {
        if (!e.repeat) changeCar(1);
        return;
      }
      if (code === 'Enter') {
        if (!e.repeat) {
          if (mode === 'menu') showGarage();
          else startRace();
        }
        return;
      }
      if (code === 'Space' && mode === 'garage' && !e.repeat) {
        startRace();
        return;
      }
    }

    if (mode === 'result') {
      if ((code === 'KeyR' || code === 'Enter') && !e.repeat) { startRace(); return; }
    }

    if (mode === 'paused') {
      if ((code === 'KeyR') && !e.repeat) { startRace(); return; }
      if (code === 'Enter') { resumeRace(); return; }
    }

    if (mode === 'race') {
      const action = keyToAction(code);
      if (action) keys[action] = true;
    }
  });

  document.addEventListener('keyup', e => {
    const action = keyToAction(e.code);
    if (action) keys[action] = false;
  });

  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.nitro = false;
    if (mode === 'race' && race && !race.over) togglePause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'race' && race && !race.over) togglePause();
  });

  // 触屏
  const map = { left: 'left', right: 'right', brake: 'down', throttle: 'up', nitro: 'nitro' };
  UI.touchControls.querySelectorAll('[data-touch]').forEach(btn => {
    const act = map[btn.dataset.touch];
    const set = v => {
      touchState[act] = v;
      btn.classList.toggle('active', v);
    };
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      audio.resume();
      set(true);
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    const off = e => { e.preventDefault(); set(false); };
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', e => { if (e.buttons === 0) set(false); });
  });

  // 按钮
  UI.btnStart.addEventListener('click', () => { audio.resume(); showGarage(); });
  UI.btnHelp.addEventListener('click', () => {
    audio.resume();
    UI.helpPanel.classList.toggle('open');
    audio.blip(500, 0.05, 'sine', 0.05);
  });
  UI.btnHelpClose.addEventListener('click', () => {
    UI.helpPanel.classList.remove('open');
    audio.blip(420, 0.05, 'sine', 0.05);
  });
  UI.btnBack.addEventListener('click', () => { audio.blip(420, 0.06, 'sine', 0.05); showMainMenu(); });
  UI.btnCarPrev.addEventListener('click', () => changeCar(-1));
  UI.btnCarNext.addEventListener('click', () => changeCar(1));
  UI.btnRace.addEventListener('click', () => startRace());
  UI.btnSecretRace.addEventListener('click', startSecretRace);
  UI.btnSecretClose.addEventListener('click', closeSecretMenu);
  UI.secretCarOptions.querySelectorAll('[data-secret-car]').forEach(btn => {
    btn.addEventListener('click', () => selectSecretCar(Number(btn.dataset.secretCar)));
  });
  UI.btnTrafficCollision.addEventListener('click', toggleTrafficCollision);
  UI.secretMenu.addEventListener('click', e => { if (e.target === UI.secretMenu) closeSecretMenu(); });
  UI.btnResume.addEventListener('click', resumeRace);
  UI.btnRestartPause.addEventListener('click', () => startRace());
  UI.btnQuitPause.addEventListener('click', () => { UI.pause.classList.add('hidden'); showGarage(); });
  UI.btnAgain.addEventListener('click', () => startRace());
  UI.btnGarage.addEventListener('click', () => showGarage());
  UI.btnMenu.addEventListener('click', () => showMainMenu());
  UI.btnMute.addEventListener('click', () => {
    audio.resume();
    audio.setMuted(!audio.muted);
    toast(audio.muted ? '已静音' : '声音开启');
  });

  // 任意首次点击初始化音频
  window.addEventListener('pointerdown', () => audio.resume(), { once: true });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      if (mode === 'garage') drawCarPreview();
    }, 80);
  });
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 220));
}

/* ----------------------------- 主循环 ----------------------------- */
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastFrame) lastFrame = ts;
  const raw = (ts - lastFrame) / 1000;
  lastFrame = ts;
  const dt = clamp(raw, 0, 0.05);
  if (dt <= 0) return;

  try {
    if (mode === 'menu' || mode === 'garage') {
      updateAttract(dt);
      drawRivalGhost(dt);
      updateEffects(dt);
    } else if (mode === 'race') {
      updateRace(dt);
    } else if (mode === 'result') {
      updateEffects(dt);
    }
    render();
  } catch (err) {
    showFatal(err);
  }
}

/* ----------------------------- 初始化 ----------------------------- */
function init() {
  cacheUI();
  resizeCanvas();
  initNitroSegments();
  initAttract();
  buildGarageCards();
  attachCarUI(selectedCar);
  updateMenuBest();
  bindEvents();
  showMainMenu();
  updateMenuBest();
  UI.btnMute.textContent = '♪';

  const params = new URLSearchParams(location.search);
  if (params.get('car')) selectedCar = clamp(Number(params.get('car')) || 0, 0, CARS.length - 1);
  debugAuto = params.get('auto') === '1';
  if (params.get('screen') === 'garage' || params.get('garage') === '1') {
    showGarage();
  } else if (params.get('race') === '1' || params.get('screen') === 'race') {
    startRace(selectedCar);
    race.debugAuto = debugAuto;
    if (params.get('skip') === '1') {
      race.started = true;
      race.countdown = 0;
      race.time = 0;
      UI.centerMessage.classList.remove('show');
    }
  }

  // 调试接口（自动化截图 / 试玩）
  window.__MS = {
    startRace: (car = selectedCar) => startRace(car),
    menu: showMainMenu,
    garage: showGarage,
    attachCarUI,
    getRace: () => race,
    getMode: () => mode,
    camera: () => world.cam,
    auto: (v = true) => { debugAuto = v; if (race) race.debugAuto = v; },
    skip: () => {
      if (!race) return;
      race.started = true;
      race.countdown = 0;
      race.time = 0;
      UI.centerMessage.classList.remove('show');
    },
    finish: (win = true) => {
      if (!race) return;
      completeRace(win, win ? 'DEBUG // WIN' : 'DEBUG // LOSE');
      race.resultTimer = 0;
    },
    simulate: (seconds = 100, step = 1 / 30) => {
      if (!race) return null;
      const prevReady = audio.ready;
      audio.ready = false;
      mode = 'paused';
      for (let t = 0; t < seconds; t += step) {
        updateRace(step);
        if (!race || mode === 'result') break;
      }
      audio.ready = prevReady;
      if (mode !== 'result' && race) mode = 'race';
      const r = race;
      return r ? {
        mode, win: r.win, over: r.over, reason: r.reason, time: r.time,
        playerS: r.player.s, rivalS: r.rival.s, gap: r.rival.s - r.player.s,
        playerSp: r.player.sp, rivalSp: r.rival.sp, hits: r.player.hits,
        near: r.player.nearMisses, top: kmh(r.player.topSpeed)
      } : null;
    },
    keys,
    touchState,
    CARS,
    secretOpen: unlockSecret,
    secretClose: closeSecretMenu,
    secretStart: startSecretRace,
    secretSelect: selectSecretCar,
    getSecret: () => ({ active: secretMode.active, unlocked: secretMode.unlocked, buffer: secretMode.buffer, car: SECRET_CARS[secretCarIndex].name }),
    getStory: () => race && race.story ? {
      active: race.storyActive,
      index: race.storyIndex,
      total: race.storyScript.length,
      speaker: UI.storySpeaker.textContent,
      text: UI.storyText.textContent,
      fullText: race.storyText,
      finishS: race.finishS
    } : null,
    get selectedCar() { return selectedCar; },
    setCar: i => { selectedCar = clamp(i, 0, CARS.length - 1); attachCarUI(selectedCar); }
  };

  requestAnimationFrame(frame);
}

init();


