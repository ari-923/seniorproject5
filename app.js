'use strict';

/**
 * Blueprint Flooring Estimator (Rect / Circle / Triangle / Polygon)
 * - Upload PNG/JPG blueprint
 * - Draw shapes on canvas
 * - Enter REAL dimensions in feet + label
 * - Saves selections and totals
 *
 * Polygon (pins) mode:
 * - Click to add points
 * - Double-click to finish
 * - Prompts for real feet for each side
 * - Estimates ft-per-pixel from side lengths
 * - Computes polygon area via shoelace formula
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

// poly
let polyPoints = []; // [{x,y},...]
let polyHover = null;

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

function polygonAreaPx(points) {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

function promptLabel(defaultLabel) {
  const label = (window.prompt('Label this area (ex: Kitchen):', defaultLabel || '') || '').trim();
  return label || defaultLabel || 'Area';
}

function promptNumber(msg, defaultVal) {
  const raw = (window.prompt(msg, String(defaultVal ?? '')) || '').trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
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
  const r = canvas.getBoundingClientRect();
  const w = r.width;
  const h = r.height;

  // saved shapes
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

  // polygon preview
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

    if (s.type === 'rect') {
      meta.textContent = `Width: ${fmt2(s.real.widthFt)} ft • Height: ${fmt2(s.real.heightFt)} ft`;
    } else if (s.type === 'circle') {
      meta.textContent = `Radius: ${fmt2(s.real.radiusFt)} ft`;
    } else if (s.type === 'tri') {
      meta.textContent = `Base: ${fmt2(s.real.baseFt)} ft • Height: ${fmt2(s.real.heightFt)} ft`;
    } else if (s.type === 'poly') {
      meta.textContent = `Sides: ${s.real.sideFeet.length} • Scale: ${fmt2(s.real.ftPerPx)} ft/px (estimated)`;
    }

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

// ----- Save selection functions -----
function saveRect(p1, p2) {
  const label = promptLabel(`Area ${selections.length + 1}`);

  const widthFt = promptNumber('Rectangle REAL width (ft):', 10);
  if (widthFt == null) return;

  const heightFt = promptNumber('Rectangle REAL height (ft):', 12);
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

function saveCircle(center, edge) {
  const label = promptLabel(`Area ${selections.length + 1}`);

  const radiusFt = promptNumber('Circle REAL radius (ft):', 6);
  if (radiusFt == null) return;

  const areaSqFt = Math.PI * radiusFt * radiusFt;

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

function saveTriangle(a, b, c) {
  const label = promptLabel(`Area ${selections.length + 1}`);

  const baseFt = promptNumber('Triangle REAL base (ft):', 10);
  if (baseFt == null) return;

  const heightFt = promptNumber('Triangle REAL height (ft):', 8);
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

function savePolygon(pointsCss) {
  if (pointsCss.length < 3) {
    setStatus('Custom shape needs at least 3 points.');
    return;
  }

  const label = promptLabel(`Area ${selections.length + 1}`);

  const sideFeet = [];
  const sidePx = [];

  for (let i = 0; i < pointsCss.length; i++) {
    const j = (i + 1) % pointsCss.length;
    const pxLen = dist(pointsCss[i], pointsCss[j]);
    sidePx.push(pxLen);

    const ft = promptNumber(`Side ${i + 1} REAL length (ft):`, 10);
    if (ft == null) {
      setStatus('Cancelled polygon save.');
      return;
    }
    sideFeet.push(ft);
  }

  const totalFt = sideFeet.reduce((a, b) => a + b, 0);
  const totalPx = sidePx.reduce((a, b) => a + b, 0);
  const ftPerPx = totalPx > 0 ? (totalFt / totalPx) : 0;

  const areaPx2 = polygonAreaPx(pointsCss);
  const areaSqFt = areaPx2 * (ftPerPx * ftPerPx);

  selections.push({
    type: 'poly',
    label,
    geo: { points: pointsCss.map(cssToNorm) },
    real: { sideFeet, ftPerPx },
    areaSqFt
  });

  setStatus(`Saved "${label}" (${fmt2(areaSqFt)} sq ft).`);
  recomputeTotals();
  render();
}

// ----- Events -----
if (shapeModeEl) {
  shapeModeEl.addEventListener('change', () => {
    mode = shapeModeEl.value;

    isDragging = false;
    dragStart = dragEnd = null;
    circleCenter = circleEdge = null;
    triPoints = [];
    polyPoints = [];
    polyHover = null;

    setStatus(
      mode === 'rect'
        ? 'Rectangle mode: drag to select.'
        : mode === 'circle'
          ? 'Circle mode: click+drag to set radius.'
          : mode === 'tri'
            ? 'Triangle mode: click 3 corners.'
            : 'Custom shape: click to add pins. Double-click to finish.'
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

canvas.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;

  if (mode === 'rect' && dragStart && dragEnd) {
    if (dist(dragStart, dragEnd) < 6) setStatus('Drag a bigger rectangle.');
    else saveRect(dragStart, dragEnd);
  }

  if (mode === 'circle' && circleCenter && circleEdge) {
    if (dist(circleCenter, circleEdge) < 6) setStatus('Drag a bigger circle radius.');
    else saveCircle(circleCenter, circleEdge);
  }

  dragStart = dragEnd = null;
  circleCenter = circleEdge = null;
  render();
});

// tri + poly clicks
canvas.addEventListener('click', (e) => {
  const p = getCanvasCssPointFromEvent(e);

  if (mode === 'tri') {
    triPoints.push(p);
    if (triPoints.length < 3) {
      setStatus(`Triangle: click ${3 - triPoints.length} more point(s).`);
      render();
      return;
    }
    const [a, b, c] = triPoints;
    triPoints = [];
    saveTriangle(a, b, c);
    return;
  }

  if (mode === 'poly') {
    polyPoints.push(p);
    setStatus('Custom shape: click to add pins. Double-click to finish.');
    render();
  }
});

// double click to finish polygon
canvas.addEventListener('dblclick', (e) => {
  if (mode !== 'poly') return;
  e.preventDefault();

  if (polyPoints.length < 3) {
    setStatus('Need at least 3 points to finish a custom shape.');
    return;
  }

  const pts = polyPoints.slice();
  polyPoints = [];
  polyHover = null;

  savePolygon(pts);
});

// Initial UI
setStatus('Upload an image to begin.');
recomputeTotals();
requestAnimationFrame(() => {
  fitCanvasToWrap();
  render();
});
