'use strict';

/**
 * Blueprint Flooring Estimator (Rect / Circle / Triangle)
 */

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

let blueprintImg = null;
let selections = [];

let mode = (shapeModeEl?.value || 'rect'); // 'rect' | 'circle' | 'tri'
let isDragging = false;

let dragStart = null;
let dragEnd = null;

let circleCenter = null;
let circleEdge = null;

let triPoints = [];

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

/**
 * IMPORTANT:
 * Make the internal canvas buffer match the visible CSS size.
 * Using clientWidth/clientHeight is stable with padding + flex layouts.
 */
function fitCanvasToWrap() {
  const dpr = window.devicePixelRatio || 1;

  const w = Math.max(1, Math.floor(canvas.clientWidth));
  const h = Math.max(1, Math.floor(canvas.clientHeight));

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  // Draw in CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  render();
}

window.addEventListener('resize', fitCanvasToWrap);

function clearCanvas() {
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  ctx.clearRect(0, 0, w, h);
}

function drawBlueprint() {
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);

  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, w, h);

  if (!blueprintImg) {
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

  ctx.drawImage(blueprintImg, dx, dy, dw, dh);

  ctx.strokeStyle = '#ddd';
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function drawSelections() {
  const r = canvas.getBoundingClientRect();
  const w = r.width;
  const h = r.height;

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
  }

  // active preview
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
}

function render() {
  clearCanvas();
  drawBlueprint();
  drawSelections();
}

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

    listOut.appendChild(card);
  });
}

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

  setStatus(`Saved "${label}" (${fmt2(areaSqFt)} sq ft). Rectangle mode: drag to select.`);
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

  setStatus(`Saved "${label}" (${fmt2(areaSqFt)} sq ft). Circle mode: drag radius.`);
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

  setStatus(`Saved "${label}" (${fmt2(areaSqFt)} sq ft). Triangle mode: click 3 points.`);
  recomputeTotals();
  render();
}

if (shapeModeEl) {
  shapeModeEl.addEventListener('change', () => {
    mode = shapeModeEl.value;
    isDragging = false;
    dragStart = dragEnd = null;
    circleCenter = circleEdge = null;
    triPoints = [];
    setStatus(
      mode === 'rect'
        ? 'Rectangle mode: drag to select.'
        : mode === 'circle'
          ? 'Circle mode: click+drag to set radius.'
          : 'Triangle mode: click 3 corners.'
    );
    render();
  });
}

undoBtn?.addEventListener('click', () => {
  if (!selections.length) return;
  selections.pop();
  recomputeTotals();
  render();
  setStatus('Undid last selection.');
});

clearBtn?.addEventListener('click', () => {
  selections = [];
  recomputeTotals();
  render();
  setStatus('Cleared all selections.');
});

blueprintInput?.addEventListener('change', () => {
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

    URL.revokeObjectURL(url);
  };

  img.onerror = () => {
    alert('Could not load that image.');
    URL.revokeObjectURL(url);
  };

  img.src = url;
});

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
  if (!isDragging) return;
  const p = getCanvasCssPointFromEvent(e);

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

canvas.addEventListener('click', (e) => {
  if (mode !== 'tri') return;
  const p = getCanvasCssPointFromEvent(e);

  triPoints.push(p);
  if (triPoints.length < 3) {
    setStatus(`Triangle: click ${3 - triPoints.length} more point(s).`);
    render();
    return;
  }

  const [a, b, c] = triPoints;
  triPoints = [];
  saveTriangle(a, b, c);
});

setStatus('Upload an image to begin.');
recomputeTotals();

requestAnimationFrame(() => {
  fitCanvasToWrap();
  render();
});
