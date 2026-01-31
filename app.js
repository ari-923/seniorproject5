'use strict';

/**
 * Blueprint Flooring Estimator (Rect / Circle / Triangle / Polygon)
 *
 * LENGTH INPUT:
 * - Uses a modal with Feet + Inches (inches default to 0)
 * - Internally converts to decimal feet: feet + inches/12
 *
 * Custom Shape (pins) behavior:
 * - Click to add pins (visual only)
 * - After EACH new pin (starting at pin #2), user enters the side length via modal
 * - Finish polygon:
 *    - Click FIRST pin again -> enter closing side length -> saves
 *    - Press ENTER -> enter closing side length -> saves
 * - ESC cancels polygon draft
 *
 * POLY AREA RULES:
 * - 3 sides: triangle area from 3 sides (Heron's formula)
 * - 4 sides: user chooses (single letter) R / T / I
 * - 5+ sides: manual area (sq ft)
 */

// ----- Grab DOM -----
const blueprintInput = document.getElementById('blueprintInput');
const shapeModeEl = document.getElementById('shapeMode');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');

const statusOut = document.getElementById('statusOut');
const canvas = document.getElementById('canvas');
const totalOut = document.getElementById('totalOut');
const countOut = document.getElementById('countOut');
const listOut = document.getElementById('listOut');

if (!canvas) throw new Error('Missing #canvas in HTML.');
const ctx = canvas.getContext('2d');

// Modal DOM
const lengthModal = document.getElementById('lengthModal');
const lengthModalTitle = document.getElementById('lengthModalTitle');
const lengthModalHint = document.getElementById('lengthModalHint');
const lengthModalError = document.getElementById('lengthModalError');
const feetInput = document.getElementById('feetInput');
const inchInput = document.getElementById('inchInput');
const lengthOk = document.getElementById('lengthOk');
const lengthCancel = document.getElementById('lengthCancel');

// ----- State -----
let blueprintImg = null;
let selections = [];

let mode = (shapeModeEl?.value || 'rect'); // 'rect' | 'circle' | 'tri' | 'poly'
let isDragging = false;

// rect
let dragStart = null;
let dragEnd = null;

// circle
let circleCenter = null;
let circleEdge = null;

// tri
let triPoints = [];

// poly draft (visual points only)
let polyPoints = [];     // [{x,y}, ...] CSS px
let polySideFeet = [];   // feet for each side between consecutive points (closing added at finish)
let polyHover = null;

let modalBusy = false;   // prevents double-open

// ----- Helpers -----
function setStatus(msg) {
  if (statusOut) statusOut.textContent = msg;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function fmt2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0.00';
  return x.toFixed(2);
}

function getCanvasCssPointFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function cssToNorm(pt) {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);
  return { x: clamp01(pt.x / w), y: clamp01(pt.y / h) };
}

function normToCss(ptN) {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);
  return { x: ptN.x * w, y: ptN.y * h };
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isNearFirstPoint(p, first, tolerance = 10) {
  return dist(p, first) <= tolerance;
}

function promptLabel(defaultLabel) {
  const label = (window.prompt('Label this area (ex: Kitchen):', defaultLabel || '') || '').trim();
  return label || defaultLabel || 'Area';
}

function promptAreaSqFt(msg, defaultVal) {
  const raw = (window.prompt(msg, String(defaultVal ?? '')) || '').trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function resetPolygonDraft(msg) {
  polyPoints = [];
  polySideFeet = [];
  polyHover = null;
  setStatus(msg || 'Polygon cancelled.');
  render();
}

/**
 * Open the Feet/Inches modal and return decimal FEET.
 * Inches default to 0.
 * Returns: number (decimal feet) or null if cancelled.
 */
function askLengthFeetInches({ title, hint, defaultFeet = 0, defaultInches = 0, allowZero = false }) {
  return new Promise((resolve) => {
    if (modalBusy) return resolve(null);
    modalBusy = true;

    if (!lengthModal || !feetInput || !inchInput || !lengthOk || !lengthCancel) {
      modalBusy = false;
      alert('Length modal is missing in index.html.');
      return resolve(null);
    }

    lengthModalTitle.textContent = title || 'Enter Length';
    lengthModalHint.textContent = hint || 'Inches default to 0. Press Enter to OK.';
    lengthModalError.textContent = '';

    // Set defaults
    feetInput.value = String(Math.max(0, Math.floor(defaultFeet || 0)));
    inchInput.value = String(Math.max(0, Math.floor(defaultInches || 0)));

    // Show
    lengthModal.style.display = 'grid';

    // Focus
    setTimeout(() => feetInput.focus(), 0);

    const close = (val) => {
      lengthModal.style.display = 'none';
      lengthModalError.textContent = '';
      cleanupListeners();
      modalBusy = false;
      resolve(val);
    };

    const onOk = () => {
      const feet = Number(feetInput.value);
      const inches = Number(inchInput.value);

      if (!Number.isFinite(feet) || feet < 0) {
        lengthModalError.textContent = 'Feet must be 0 or more.';
        return;
      }
      if (!Number.isFinite(inches) || inches < 0 || inches > 11) {
        lengthModalError.textContent = 'Inches must be between 0 and 11.';
        return;
      }

      const totalFeet = feet + (inches / 12);

      if (!allowZero && totalFeet <= 0) {
        lengthModalError.textContent = 'Length must be greater than 0.';
        return;
      }

      close(totalFeet);
    };

    const onCancel = () => close(null);

    const onKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onOk();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    function cleanupListeners() {
      lengthOk.removeEventListener('click', onOk);
      lengthCancel.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey);
    }

    lengthOk.addEventListener('click', onOk);
    lengthCancel.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey);
  });
}

// ---- Math helpers ----
function heronArea(a, b, c) {
  const s = (a + b + c) / 2;
  const inside = s * (s - a) * (s - b) * (s - c);
  if (inside <= 0) return null;
  return Math.sqrt(inside);
}

function trapezoidArea(b1, b2, h) {
  return ((b1 + b2) / 2) * h;
}

/**
 * Decide polygon area based on user-provided info.
 * Returns: { areaSqFt, method, details } or null if cancelled/invalid.
 */
async function computePolyAreaFromUser(sideFeet) {
  const nSides = sideFeet.length;

  // ---- TRIANGLE: 3 sides ----
  if (nSides === 3) {
    const area = heronArea(sideFeet[0], sideFeet[1], sideFeet[2]);
    if (area == null) return null;
    return {
      areaSqFt: area,
      method: 'triangle (3 sides)',
      details: { sides: sideFeet.slice() }
    };
  }

  // ---- QUAD: 4 sides ----
  if (nSides === 4) {
    const choiceRaw = (window.prompt(
      'This shape has 4 sides.\nChoose one:\n\nR = rectangle/square (area = length × width)\nT = trapezoid (asks top base, bottom base, height)\nI = irregular (enter total area)\n\nType: R, T, or I',
      'R'
    ) || '').trim().toLowerCase();

    const choice =
      choiceRaw.startsWith('r') ? 'rectangle' :
      choiceRaw.startsWith('t') ? 'trapezoid' :
      choiceRaw.startsWith('i') ? 'irregular' :
      null;

    if (!choice) return null;

    if (choice === 'rectangle') {
      const length = sideFeet[0];
      const width = sideFeet[1];
      return {
        areaSqFt: length * width,
        method: 'rectangle/square (adjacent sides)',
        details: { length, width, sides: sideFeet.slice() }
      };
    }

    if (choice === 'trapezoid') {
      // Smart defaults from the 4 sides
      const sorted = sideFeet.slice().sort((a, b) => a - b);
      const defTop = sorted[0];
      const defBottom = sorted[3];
      const defHeight = sorted[1];

      const topBase = await askLengthFeetInches({
        title: 'Trapezoid: TOP base',
        hint: 'Enter top base length.',
        defaultFeet: defTop
      });
      if (topBase == null) return null;

      const bottomBase = await askLengthFeetInches({
        title: 'Trapezoid: BOTTOM base',
        hint: 'Enter bottom base length.',
        defaultFeet: defBottom
      });
      if (bottomBase == null) return null;

      const height = await askLengthFeetInches({
        title: 'Trapezoid: HEIGHT',
        hint: 'Enter perpendicular height (distance between bases).',
        defaultFeet: defHeight
      });
      if (height == null) return null;

      return {
        areaSqFt: trapezoidArea(topBase, bottomBase, height),
        method: 'trapezoid (bases + height)',
        details: { topBase, bottomBase, height, sides: sideFeet.slice() }
      };
    }

    // irregular (manual area)
    const manualArea = promptAreaSqFt('Irregular 4-sided shape: enter TOTAL area (sq ft):', 100);
    if (manualArea == null) return null;

    return {
      areaSqFt: manualArea,
      method: 'manual area (irregular quad)',
      details: { areaSqFt: manualArea, sides: sideFeet.slice() }
    };
  }

  // ---- 5+ sides: manual area ----
  const manualArea = promptAreaSqFt(
    `This shape has ${nSides} sides.\nArea can’t be uniquely computed from side lengths alone.\n\nEnter TOTAL area (sq ft):`,
    100
  );
  if (manualArea == null) return null;

  return {
    areaSqFt: manualArea,
    method: 'manual area (5+ sides)',
    details: { areaSqFt: manualArea, sides: sideFeet.slice() }
  };
}

// --- Canvas resize helper (pointer-aligned) ---
function fitCanvasToWrap() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

window.addEventListener('resize', fitCanvasToWrap);

// ----- Rendering -----
function clearCanvas() {
  const r = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, r.width, r.height);
}

function drawBlueprint() {
  const r = canvas.getBoundingClientRect();
  const w = r.width;
  const h = r.height;

  if (!blueprintImg) {
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    return;
  }

  const iw = blueprintImg.naturalWidth || blueprintImg.width;
  const ih = blueprintImg.naturalHeight || blueprintImg.height;

  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;

  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(blueprintImg, dx, dy, dw, dh);

  ctx.strokeStyle = '#ddd';
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function drawSelections() {
  for (const s of selections) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#16a34a';
    ctx.fillStyle = 'rgba(22,163,74,0.10)';

    if (s.type === 'rect') {
      const p1 = normToCss(s.geo.p1);
      const p2 = normToCss(s.geo.p2);

      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const rw = Math.abs(p2.x - p1.x);
      const rh = Math.abs(p2.y - p1.y);

      ctx.fillRect(x, y, rw, rh);
      ctx.strokeRect(x, y, rw, rh);

      ctx.fillStyle = '#0f172a';
      ctx.font = '12px system-ui';
      ctx.fillText(s.label || '', x + 6, y + 14);
    }

    if (s.type === 'circle') {
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      const h = r.height;

      const c = normToCss(s.geo.c);
      const rr = s.geo.r * Math.min(w, h);

      ctx.beginPath();
      ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '12px system-ui';
      ctx.fillText(s.label || '', c.x + 6, c.y - 6);
    }

    if (s.type === 'tri') {
      const a = normToCss(s.geo.a);
      const b = normToCss(s.geo.b);
      const c = normToCss(s.geo.c);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '12px system-ui';
      ctx.fillText(s.label || '', a.x + 6, a.y + 14);
    }

    if (s.type === 'poly') {
      const pts = s.geo.points.map(normToCss);

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '12px system-ui';
      ctx.fillText(s.label || '', pts[0].x + 6, pts[0].y + 14);
    }
  }

  // preview drawing
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2563eb';
  ctx.fillStyle = 'rgba(37,99,235,0.08)';

  if (mode === 'rect' && isDragging && dragStart && dragEnd) {
    const x = Math.min(dragStart.x, dragEnd.x);
    const y = Math.min(dragStart.y, dragEnd.y);
    const rw = Math.abs(dragEnd.x - dragStart.x);
    const rh = Math.abs(dragEnd.y - dragStart.y);
    ctx.fillRect(x, y, rw, rh);
    ctx.strokeRect(x, y, rw, rh);
  }

  if (mode === 'circle' && isDragging && circleCenter && circleEdge) {
    const rr = dist(circleCenter, circleEdge);
    ctx.beginPath();
    ctx.arc(circleCenter.x, circleCenter.y, rr, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (mode === 'tri' && triPoints.length) {
    ctx.fillStyle = '#2563eb';
    for (const p of triPoints) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (triPoints.length >= 2) {
      ctx.strokeStyle = '#2563eb';
      ctx.beginPath();
      ctx.moveTo(triPoints[0].x, triPoints[0].y);
      ctx.lineTo(triPoints[1].x, triPoints[1].y);
      if (triPoints.length === 3) {
        ctx.lineTo(triPoints[2].x, triPoints[2].y);
        ctx.closePath();
      }
      ctx.stroke();
    }
  }

  if (mode === 'poly' && polyPoints.length) {
    ctx.fillStyle = '#2563eb';
    for (const p of polyPoints) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(polyPoints[0].x, polyPoints[0].y);
    for (let i = 1; i < polyPoints.length; i++) ctx.lineTo(polyPoints[i].x, polyPoints[i].y);
    if (polyHover) ctx.lineTo(polyHover.x, polyHover.y);
    ctx.stroke();
  }
}

function render() {
  clearCanvas();
  drawBlueprint();
  drawSelections();
}

// ----- Totals UI -----
function recomputeTotals() {
  const total = selections.reduce((sum, s) => sum + (Number(s.areaSqFt) || 0), 0);
  if (totalOut) totalOut.textContent = fmt2(total);
  if (countOut) countOut.textContent = String(selections.length);

  if (!listOut) return;
  listOut.innerHTML = '';

  selections.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'selCard';

    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.textContent = `${s.label || `Area ${i + 1}`} (${s.type}) — ${fmt2(s.areaSqFt)} sq ft`;

    const meta = document.createElement('div');
    meta.style.opacity = '0.8';
    meta.style.fontSize = '13px';

    if (s.type === 'rect') meta.textContent = `Width: ${fmt2(s.real.widthFt)} ft • Height: ${fmt2(s.real.heightFt)} ft`;
    if (s.type === 'circle') meta.textContent = `Radius: ${fmt2(s.real.radiusFt)} ft`;
    if (s.type === 'tri') meta.textContent = `Base: ${fmt2(s.real.baseFt)} ft • Height: ${fmt2(s.real.heightFt)} ft`;
    if (s.type === 'poly') meta.textContent = `Method: ${s.real.method} • Sides: ${s.real.sideFeet.length}`;

    card.appendChild(title);
    card.appendChild(meta);

    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.style.marginTop = '8px';
    del.addEventListener('click', () => {
      selections.splice(i, 1);
      recomputeTotals();
      render();
      setStatus('Removed selection.');
    });
    card.appendChild(del);

    card.style.border = '1px solid #e5e5e5';
    card.style.borderRadius = '10px';
    card.style.padding = '10px';

    listOut.appendChild(card);
  });
}

// expose snapshot for chatbot.js
window.getEstimatorSnapshot = function getEstimatorSnapshot() {
  const total = selections.reduce((sum, s) => sum + (Number(s.areaSqFt) || 0), 0);
  return {
    totalSqFt: Number(fmt2(total)),
    selectionsCount: selections.length,
    selections: selections.map((s) => ({
      label: s.label,
      type: s.type,
      areaSqFt: Number(fmt2(s.areaSqFt)),
      real: s.real
    }))
  };
};

// ----- Save functions (rect/circle/tri) -----
async function saveRect(p1, p2) {
  const label = promptLabel(`Area ${selections.length + 1}`);

  const widthFt = await askLengthFeetInches({
    title: 'Rectangle: WIDTH',
    hint: 'Enter real width.',
    defaultFeet: 10
  });
  if (widthFt == null) return;

  const heightFt = await askLengthFeetInches({
    title: 'Rectangle: HEIGHT',
    hint: 'Enter real height.',
    defaultFeet: 12
  });
  if (heightFt == null) return;

  const areaSqFt = widthFt * heightFt;

  selections.push({
    type: 'rect',
    label,
    geo: { p1: cssToNorm(p1), p2: cssToNorm(p2) },
    real: { widthFt, heightFt },
    areaSqFt
  });

  setStatus(`Saved "${label}" (${fmt2(areaSqFt)} sq ft).`);
  recomputeTotals();
  render();
}

async function saveCircle(center, edge) {
  const label = promptLabel(`Area ${selections.length + 1}`);

  const radiusFt = await askLengthFeetInches({
    title: 'Circle: RADIUS',
    hint: 'Enter real radius.',
    defaultFeet: 6
  });
  if (radiusFt == null) return;

  const areaSqFt = Math.PI * radiusFt * radiusFt;

  // keep circle geometry normalized for redraw only
  const rCss = dist(center, edge);
  const rNorm = (() => {
    const rect = canvas.getBoundingClientRect();
    const minDim = Math.max(1, Math.min(rect.width, rect.height));
    return rCss / minDim;
  })();

  selections.push({
    type: 'circle',
    label,
    geo: { c: cssToNorm(center), r: rNorm },
    real: { radiusFt },
    areaSqFt
  });

  setStatus(`Saved "${label}" (${fmt2(areaSqFt)} sq ft).`);
  recomputeTotals();
  render();
}

async function saveTriangle(a, b, c) {
  const label = promptLabel(`Area ${selections.length + 1}`);

  const baseFt = await askLengthFeetInches({
    title: 'Triangle: BASE',
    hint: 'Enter real base length.',
    defaultFeet: 10
  });
  if (baseFt == null) return;

  const heightFt = await askLengthFeetInches({
    title: 'Triangle: HEIGHT',
    hint: 'Enter real height.',
    defaultFeet: 8
  });
  if (heightFt == null) return;

  const areaSqFt = 0.5 * baseFt * heightFt;

  selections.push({
    type: 'tri',
    label,
    geo: { a: cssToNorm(a), b: cssToNorm(b), c: cssToNorm(c) },
    real: { baseFt, heightFt },
    areaSqFt
  });

  setStatus(`Saved "${label}" (${fmt2(areaSqFt)} sq ft).`);
  recomputeTotals();
  render();
}

// ----- Polygon: save using user-entered info + correct trapezoid handling -----
async function finishPolygonAndSave(pointsCss, sideFeet) {
  if (pointsCss.length < 3) {
    setStatus('Custom shape needs at least 3 points.');
    return;
  }
  if (sideFeet.length !== pointsCss.length) {
    setStatus('Polygon sides missing — could not save.');
    return;
  }

  const computed = await computePolyAreaFromUser(sideFeet);
  if (!computed) {
    setStatus('Cancelled (or invalid triangle). Shape not saved.');
    return;
  }

  const label = promptLabel(`Area ${selections.length + 1}`);

  selections.push({
    type: 'poly',
    label,
    geo: { points: pointsCss.map(cssToNorm) }, // visual only
    real: {
      sideFeet: sideFeet.slice(),
      method: computed.method,
      details: computed.details
    },
    areaSqFt: computed.areaSqFt
  });

  setStatus(`Saved "${label}" (${fmt2(computed.areaSqFt)} sq ft).`);
  recomputeTotals();
  render();
}

async function finishPolygonAskClosingAndSave() {
  if (mode !== 'poly') return;

  if (polyPoints.length < 3) {
    setStatus('Need at least 3 points to finish a custom shape.');
    return;
  }

  const closingIndex = polyPoints.length;
  const closingFt = await askLengthFeetInches({
    title: `Side ${closingIndex}: Closing side`,
    hint: 'Enter the length of the closing line back to the first point.',
    defaultFeet: 10
  });
  if (closingFt == null) {
    setStatus('Finish cancelled.');
    return;
  }

  const pts = polyPoints.slice();
  const sideFeet = polySideFeet.slice();
  sideFeet.push(closingFt);

  polyPoints = [];
  polySideFeet = [];
  polyHover = null;

  await finishPolygonAndSave(pts, sideFeet);
}

// Keyboard shortcuts for polygon
window.addEventListener('keydown', async (e) => {
  if (mode !== 'poly') return;

  const active = document.activeElement;
  const typingInInput =
    active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  if (typingInInput) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    await finishPolygonAskClosingAndSave();
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    if (polyPoints.length) resetPolygonDraft('Polygon cancelled (draft cleared).');
  }
});

// ----- Mode + UI events -----
if (shapeModeEl) {
  shapeModeEl.addEventListener('change', () => {
    mode = shapeModeEl.value;

    isDragging = false;
    dragStart = dragEnd = null;
    circleCenter = circleEdge = null;
    triPoints = [];

    polyPoints = [];
    polySideFeet = [];
    polyHover = null;

    setStatus(
      mode === 'rect'
        ? 'Rectangle mode: drag to select.'
        : mode === 'circle'
          ? 'Circle mode: click+drag to set radius.'
          : mode === 'tri'
            ? 'Triangle mode: click 3 corners.'
            : 'Custom shape: click pins. After each line, enter Feet/Inches. Click FIRST pin (or press Enter) to close. ESC cancels.'
    );

    render();
  });
}

if (undoBtn) {
  undoBtn.addEventListener('click', () => {
    if (!selections.length) return;
    selections.pop();
    recomputeTotals();
    render();
    setStatus('Undid last selection.');
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    selections = [];
    recomputeTotals();
    render();
    setStatus('Cleared all selections.');
  });
}

if (blueprintInput) {
  blueprintInput.addEventListener('change', () => {
    const file = blueprintInput.files && blueprintInput.files[0];
    if (!file) return;

    if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
      alert('Please upload a PNG or JPG image.');
      blueprintInput.value = '';
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      blueprintImg = img;
      setStatus('Image loaded. Start selecting an area.');
      requestAnimationFrame(() => {
        fitCanvasToWrap();
        render();
      });
    };
    img.onerror = () => alert('Could not load that image.');
    img.src = url;
  });
}

// rect/circle dragging
canvas.addEventListener('mousedown', (e) => {
  const p = getCanvasCssPointFromEvent(e);

  if (mode === 'rect') {
    isDragging = true;
    dragStart = p;
    dragEnd = p;
    render();
  }

  if (mode === 'circle') {
    isDragging = true;
    circleCenter = p;
    circleEdge = p;
    render();
  }
});

canvas.addEventListener('mousemove', (e) => {
  const p = getCanvasCssPointFromEvent(e);

  if (mode === 'poly') {
    polyHover = p;
    render();
    return;
  }

  if (!isDragging) return;

  if (mode === 'rect' && dragStart) {
    dragEnd = p;
    render();
  }

  if (mode === 'circle' && circleCenter) {
    circleEdge = p;
    render();
  }
});

canvas.addEventListener('mouseup', async () => {
  if (!isDragging) return;
  isDragging = false;

  if (mode === 'rect' && dragStart && dragEnd) {
    if (dist(dragStart, dragEnd) < 6) setStatus('Drag a bigger rectangle.');
    else await saveRect(dragStart, dragEnd);
  }

  if (mode === 'circle' && circleCenter && circleEdge) {
    if (dist(circleCenter, circleEdge) < 6) setStatus('Drag a bigger circle radius.');
    else await saveCircle(circleCenter, circleEdge);
  }

  dragStart = dragEnd = null;
  circleCenter = circleEdge = null;
  render();
});

// tri + poly clicks
canvas.addEventListener('click', async (e) => {
  const p = getCanvasCssPointFromEvent(e);

  // TRIANGLE
  if (mode === 'tri') {
    triPoints.push(p);
    if (triPoints.length < 3) {
      setStatus(`Triangle: click ${3 - triPoints.length} more point(s).`);
      render();
      return;
    }
    const [a, b, c] = triPoints;
    triPoints = [];
    await saveTriangle(a, b, c);
    return;
  }

  // POLYGON
  if (mode === 'poly') {
    // close if click near first point
    if (polyPoints.length >= 3 && isNearFirstPoint(p, polyPoints[0])) {
      await finishPolygonAskClosingAndSave();
      return;
    }

    // add new point
    polyPoints.push(p);

    // ask length after each new line (starting at second point)
    if (polyPoints.length >= 2) {
      const sideIndex = polyPoints.length - 1;

      const ft = await askLengthFeetInches({
        title: `Side ${sideIndex}: Length`,
        hint: 'Enter the length of the line you just drew.',
        defaultFeet: 10
      });

      if (ft == null) {
        polyPoints.pop();
        setStatus('Cancelled that side. Point not added.');
        render();
        return;
      }

      polySideFeet.push(ft);
      setStatus('Keep clicking pins. Click FIRST pin (or press Enter) to close. ESC cancels.');
    } else {
      setStatus('Click next point to create your first line.');
    }

    render();
  }
});

// double click also finishes
canvas.addEventListener('dblclick', async (e) => {
  if (mode !== 'poly') return;
  e.preventDefault();
  await finishPolygonAskClosingAndSave();
});

// Initial UI
setStatus('Upload an image to begin.');
recomputeTotals();
requestAnimationFrame(() => {
  fitCanvasToWrap();
  render();
});
