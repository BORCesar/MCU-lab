// ---------------------------
// Script del Simulador MCU
// ---------------------------

// Utilidades matemáticas
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Elementos de entrada
const rInp = document.getElementById("r");
const TInp = document.getElementById("T");
const fInp = document.getElementById("f");
const wInp = document.getElementById("w");
const btnCalc = document.getElementById("calc");
const btnClear = document.getElementById("clear");
const btnPlay = document.getElementById("play");
const btnReset = document.getElementById("reset");

const kpiT = document.getElementById("kpiT");
const kpiF = document.getElementById("kpiF");
const kpiW = document.getElementById("kpiW");
const kpiAc = document.getElementById("kpiAc");

const cnv = document.getElementById("cnv");
const ctx = cnv.getContext("2d");
const speedMul = document.getElementById("speedMul");
const trailCheck = document.getElementById("trailCheck");
const accCheck = document.getElementById("accCheck");

// Estado
let playing = false;
let phi = 0; // fase angular
let lastTime = performance.now();

// Redimensiona el canvas para alta resolución
function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = cnv.getBoundingClientRect();
  cnv.width = Math.floor(rect.width * dpr);
  cnv.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

// Lógica de cálculo
let lastEdited = null; // 'T' | 'f' | 'w'
TInp.addEventListener("input", () => (lastEdited = "T"));
fInp.addEventListener("input", () => (lastEdited = "f"));
wInp.addEventListener("input", () => (lastEdited = "w"));

function parseVal(el) {
  const v = parseFloat(el.value);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function format(v, unit) {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 3 : abs >= 1 ? 4 : 5;
  const str = v.toPrecision(digits);
  return unit ? `${str} ${unit}` : str;
}

function compute() {
  const r = parseVal(rInp) ?? 1;
  let T = parseVal(TInp);
  let f = parseVal(fInp);
  let w = parseVal(wInp);

  if (lastEdited === "T" && T) {
    f = 1 / T;
    w = TAU / T;
  } else if (lastEdited === "f" && f) {
    T = 1 / f;
    w = TAU * f;
  } else if (lastEdited === "w" && w) {
    f = w / TAU;
    T = 1 / f;
  } else {
    if (T) {
      f = 1 / T;
      w = TAU / T;
    } else if (f) {
      T = 1 / f;
      w = TAU * f;
    } else if (w) {
      f = w / TAU;
      T = 1 / f;
    } else {
      f = 0.5;
      T = 1 / f;
      w = TAU * f;
    }
  }

  const ac = w * w * r;

  // Mostrar resultados
  kpiT.textContent = format(T, "s");
  kpiF.textContent = format(f, "Hz");
  kpiW.textContent = format(w, "rad/s");
  kpiAc.textContent = format(ac, "m/s²");

  return { r, T, f, w, ac };
}

function calcAndMaybeFill() {
  const { T, f, w } = compute();
  if (lastEdited !== "T") TInp.value = T.toFixed(4);
  if (lastEdited !== "f") fInp.value = f.toFixed(4);
  if (lastEdited !== "w") wInp.value = w.toFixed(4);
  drawNow();
}

// Eventos botones
btnCalc.addEventListener("click", calcAndMaybeFill);
btnClear.addEventListener("click", () => {
  TInp.value = "";
  fInp.value = "";
  wInp.value = "";
  lastEdited = null;
  compute();
  drawNow();
});
btnPlay.addEventListener("click", () => {
  playing = !playing;
  btnPlay.textContent = playing ? "⏸️ Pausar" : "▶️ Reproducir";
});
btnReset.addEventListener("click", () => {
  phi = 0;
  drawNow();
});

[rInp, TInp, fInp, wInp, speedMul, trailCheck, accCheck].forEach((el) => {
  el.addEventListener("input", () => {
    compute();
    drawNow();
  });
});

// Dibujo
function drawScene(state) {
  const { r, w, ac } = state;
  const W = cnv.clientWidth,
    H = cnv.clientHeight;
  const cx = W / 2,
    cy = H / 2;

  const maxPix = Math.min(W, H) * 0.42;
  const scale = maxPix / r;

  if (!trailCheck.checked) {
    ctx.clearRect(0, 0, W, H);
  } else {
    ctx.fillStyle = "rgba(15,18,35,0.12)";
    ctx.fillRect(0, 0, W, H);
  }

  // ejes
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(W, cy);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, H);
  ctx.stroke();
  ctx.restore();

  // circunferencia
  ctx.save();
  ctx.strokeStyle = "rgba(94,234,212,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * scale, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // punto móvil
  const x = cx + Math.cos(phi) * r * scale;
  const y = cy + Math.sin(phi) * r * scale;

  // radio
  ctx.save();
  ctx.strokeStyle = "rgba(167,139,250,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();

  // flecha aceleración centrípeta
  if (accCheck.checked) {
    const ax = cx - x;
    const ay = cy - y;
    const len = Math.hypot(ax, ay) || 1;
    const ux = ax / len,
      uy = ay / len;
    const L = clamp(10 + Math.log10(1 + ac) * 30, 20, Math.min(W, H) * 0.25);
    const tipX = x + ux * L,
      tipY = y + uy * L;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - ux * 10 - uy * 5, tipY - uy * 10 + ux * 5);
    ctx.lineTo(tipX - ux * 10 + uy * 5, tipY - uy * 10 - ux * 5);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.restore();
  }

  // partícula
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawNow() {
  const state = compute();
  drawScene(state);
}

function animate() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  const state = compute();
  if (playing) {
    phi += state.w * dt * parseFloat(speedMul.value || 1);
  }

  drawScene(state);
  requestAnimationFrame(animate);
}

compute();
drawNow();
animate();
