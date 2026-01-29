/* app.js - Plain JavaScript (with JSDoc + labels) */

/**
 * @typedef {{x:number, y:number}} Point
 * @typedef {{x:number, y:number, w:number, h:number}} Rect
 * @typedef {'rect'|'circle'|'tri'} ShapeType
 *
 * @typedef {{
 *   type: ShapeType,
 *   label: string,
 *   areaFt2: number,
 *   details: string,
 *   draw: any
 * }} SavedItem
 */

'use strict';

const fileInput = /** @type {HTMLInputElement|null} */ (document.getElementById("fileInput"));
const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById("canvas"));
const statusEl = /** @type {HTMLElement|null} */ (document.getElementById("status"));
const btnUndo = /** @type {HTMLButtonElement|null} */ (document.getElementById("btnUndo"));
const btnClear = /** @type {HTMLButtonElement|null} */ (document.getElementById("btnClear"));
const shapeModeEl = /** @type {HTMLSelectElement|null} */ (document.getElementById("shapeMode"));
const totalOut = /** @type {HTMLElement|null} */ (document.getElementById("totalOut"));
const countOut = /** @type {HTMLElement|null} */ (document.getElementById("countOut"));
const listEl = /** @type {HTMLElement|null} */ (document.getElementById("list"));

if (!fileInput || !canvas || !statusEl || !btnUndo || !btnClear || !shapeModeEl || !totalOut || !countOut || !listEl) {
  throw new Error("Missing required DOM elements. Check your index.html ids.");
}

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D context not available.");

let img = new Image();
let imgLoaded = false;

let mode = "rect";

// Drag state for rect & circle
let isDragging = false;
let dragStart = null;
let dragEnd = null;

// Triangle state (3 clicks)
let triPoints = [];

// Saved measurements
let saved = [];

/**
 * Expose a SAFE snapshot for the chatbot/AI (read-only copy).
 * This helps the AI answer accurately about labels + areas.
 */
window.getEstimatorSnapshot = function () {
  const total = saved.reduce((sum, item) => sum + item.areaFt2, 0);
  return {
    totalSqFt: Number(total.toFixed(2)),
    selectionsCount: saved.length,
    selections: saved.map(s => ({
      type: s.type,
      label: s.label,
      areaFt2: Number(s.areaFt2.toFixed(2)),
      details: s.details
    }))
  };
};

function setStatus(msg) {
  statusEl.textContent = "Status: " + msg;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function rectFromPoints(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(a.x - b.x);
  const h = Math.abs(a.y - b.y);
  return { x, y, w, h };
}

function canvasPointFromMouse(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

function getFitRect(imgW, imgH, boxW, boxH) {
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;
  let w, h;
  if (imgRatio > boxRatio) {
    w = boxW;
    h = w / imgRatio;
  } else {
    h = boxH;
    w = h * imgRatio;
  }
  const x = (boxW - w) / 2;
  const y = (boxH - h) / 2;
  return { x, y, w, h };
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function drawPoint(p, radius) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function promptNumber(message, defaultVal) {
  const raw = prompt(message, defaultVal);
  if (raw === null) return null;
  const num = Number(String(raw).trim());
  if (!Number.isFinite(num) || num <= 0) return NaN;
  return num;
}

function promptLabel(defaultLabel) {
  const raw = prompt("Enter area label (e.g., Kitchen, Living Room):", defaultLabel);
  if (!raw || !raw.trim()) return defaultLabel;
  return raw.trim();
}

function resetInProgressSelection() {
  isDragging = false;
  dragStart = null;
  dragEnd = null;
  triPoints = [];
}

function modeHelpText() {
  if (mode === "rect") return "Rectangle mode: drag to select.";
  if (mode === "circle") return "Circle mode: drag from center to radius.";
  return "Triangle mode: click 3 corners.";
}

function updateUI() {
  const total = saved.reduce((sum, item) => sum + item.areaFt2, 0);
  totalOut.textContent = total.toFixed(2);
  countOut.textContent = String(saved.length);

  btnUndo.disabled = saved.length === 0;
  btnClear.disabled = saved.length === 0;

  if (saved.length === 0) {
    listEl.innerHTML = `<div class="list-item small">No saved selections yet.</div>`;
    return;
  }

  const typeLabel = (t) => (t === "rect" ? "Rectangle" : t === "circle" ? "Circle" : "Triangle");

  listEl.innerHTML = saved
    .map((item) => {
      return `
        <div class="list-item">
          <b>${item.label} (${typeLabel(item.type)}): ${item.areaFt2.toFixed(2)} sq ft</b>
          <div class="small">${item.details}</div>
        </div>
      `;
    })
    .join("");
}

function drawLabelText(text, x, y) {
  ctx.save();
  ctx.font = "14px Arial";
  ctx.fillStyle = "green";
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function draw() {
  clearCanvas();

  if (imgLoaded) {
    const fit = getFitRect(img.width, img.height, canvas.width, canvas.height);
    ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
  }

  // Saved shapes
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "green";
  ctx.fillStyle = "green";

  for (const item of saved) {
    if (item.type === "rect") {
      const r = item.draw.rect;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      drawLabelText(item.label, r.x + 6, r.y + 16);
    } else if (item.type === "circle") {
      const c = item.draw;
      ctx.beginPath();
      ctx.arc(c.center.x, c.center.y, c.radiusPx, 0, Math.PI * 2);
      ctx.stroke();
      drawLabelText(item.label, c.center.x + 6, c.center.y + 16);
    } else if (item.type === "tri") {
      const t = item.draw;
      const p = t.points;
      if (p.length === 3) {
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.lineTo(p[2].x, p[2].y);
        ctx.closePath();
        ctx.stroke();
        drawLabelText(item.label, p[0].x + 6, p[0].y + 16);
      }
    }
  }
  ctx.restore();

  // Current selection (blue dashed)
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "blue";
  ctx.fillStyle = "blue";
  ctx.setLineDash([6, 4]);

  if (mode === "rect" && dragStart && dragEnd) {
    const r = rectFromPoints(dragStart, dragEnd);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }

  if (mode === "circle" && dragStart && dragEnd) {
    const radiusPx = dist(dragStart, dragEnd);
    ctx.beginPath();
    ctx.arc(dragStart.x, dragStart.y, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    drawPoint(dragStart, 3);
  }

  if (mode === "tri") {
    ctx.setLineDash([]);
    if (triPoints.length > 0) {
      for (const p of triPoints) drawPoint(p, 4);
      if (triPoints.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(triPoints[0].x, triPoints[0].y);
        ctx.lineTo(triPoints[1].x, triPoints[1].y);
        ctx.stroke();
      }
      if (triPoints.length === 3) {
        ctx.beginPath();
        ctx.moveTo(triPoints[0].x, triPoints[0].y);
        ctx.lineTo(triPoints[1].x, triPoints[1].y);
        ctx.lineTo(triPoints[2].x, triPoints[2].y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// Load image
fileInput.addEventListener("change", () => {
  const files = fileInput.files;
  const file = files && files[0] ? files[0] : null;
  if (!file) return;

  const url = URL.createObjectURL(file);
  img = new Image();
  img.onload = () => {
    imgLoaded = true;
    saved = [];
    resetInProgressSelection();
    setStatus("Image loaded. " + modeHelpText());
    updateUI();
    draw();
  };
  img.src = url;
});

// Mode switch
shapeModeEl.addEventListener("change", () => {
  mode = shapeModeEl.value;
  resetInProgressSelection();
  if (imgLoaded) setStatus(modeHelpText());
  draw();
});

// Mouse drag for rect/circle
canvas.addEventListener("mousedown", (e) => {
  if (!imgLoaded) return;
  if (mode === "tri") return;

  isDragging = true;
  dragStart = canvasPointFromMouse(e);
  dragEnd = dragStart;
  setStatus("Dragging... release to finish selection.");
  draw();
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  dragEnd = canvasPointFromMouse(e);
  draw();
});

canvas.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;

  if (!dragStart || !dragEnd) return;

  // Rectangle
  if (mode === "rect") {
    const r = rectFromPoints(dragStart, dragEnd);
    if (r.w < 12 || r.h < 12) {
      setStatus("Selection too small. Drag a bigger rectangle.");
      resetInProgressSelection();
      draw();
      return;
    }

    const widthFt = promptNumber("Enter REAL width (feet):", "10");
    if (widthFt === null) { setStatus("Cancelled. Not saved."); resetInProgressSelection(); draw(); return; }
    if (Number.isNaN(widthFt)) { setStatus("Invalid width. Not saved."); resetInProgressSelection(); draw(); return; }

    const heightFt = promptNumber("Enter REAL height (feet):", "12");
    if (heightFt === null) { setStatus("Cancelled. Not saved."); resetInProgressSelection(); draw(); return; }
    if (Number.isNaN(heightFt)) { setStatus("Invalid height. Not saved."); resetInProgressSelection(); draw(); return; }

    const areaFt2 = widthFt * heightFt;
    const label = promptLabel(`Area ${saved.length + 1}`);

    saved.push({
      type: "rect",
      label,
      areaFt2,
      details: `Width: ${widthFt} ft · Height: ${heightFt} ft`,
      draw: { rect: r }
    });

    setStatus(`Saved "${label}" (${areaFt2.toFixed(2)} sq ft). ${modeHelpText()}`);
    resetInProgressSelection();
    updateUI();
    draw();
    return;
  }

  // Circle
  if (mode === "circle") {
    const radiusPx = dist(dragStart, dragEnd);
    if (radiusPx < 10) {
      setStatus("Circle too small. Drag a bigger radius.");
      resetInProgressSelection();
      draw();
      return;
    }

    const radiusFt = promptNumber("Enter REAL radius (feet):", "6");
    if (radiusFt === null) { setStatus("Cancelled. Not saved."); resetInProgressSelection(); draw(); return; }
    if (Number.isNaN(radiusFt)) { setStatus("Invalid radius. Not saved."); resetInProgressSelection(); draw(); return; }

    const areaFt2 = Math.PI * radiusFt * radiusFt;
    const label = promptLabel(`Area ${saved.length + 1}`);

    saved.push({
      type: "circle",
      label,
      areaFt2,
      details: `Radius: ${radiusFt} ft · Area = πr²`,
      draw: { center: { x: dragStart.x, y: dragStart.y }, radiusPx }
    });

    setStatus(`Saved "${label}" (${areaFt2.toFixed(2)} sq ft). ${modeHelpText()}`);
    resetInProgressSelection();
    updateUI();
    draw();
  }
});

// Triangle click logic
canvas.addEventListener("click", (e) => {
  if (!imgLoaded) return;
  if (mode !== "tri") return;

  const p = canvasPointFromMouse(e);
  triPoints.push(p);

  if (triPoints.length < 3) {
    setStatus(`Triangle mode: ${triPoints.length}/3 points set. Click next corner.`);
    draw();
    return;
  }

  draw();

  const baseFt = promptNumber("Enter REAL base (feet):", "10");
  if (baseFt === null) { setStatus("Cancelled. Triangle not saved."); triPoints = []; draw(); return; }
  if (Number.isNaN(baseFt)) { setStatus("Invalid base. Triangle not saved."); triPoints = []; draw(); return; }

  const heightFt = promptNumber("Enter REAL height (feet):", "8");
  if (heightFt === null) { setStatus("Cancelled. Triangle not saved."); triPoints = []; draw(); return; }
  if (Number.isNaN(heightFt)) { setStatus("Invalid height. Triangle not saved."); triPoints = []; draw(); return; }

  const areaFt2 = 0.5 * baseFt * heightFt;
  const label = promptLabel(`Area ${saved.length + 1}`);

  saved.push({
    type: "tri",
    label,
    areaFt2,
    details: `Base: ${baseFt} ft · Height: ${heightFt} ft · Area = ½bh`,
    draw: { points: [triPoints[0], triPoints[1], triPoints[2]] }
  });

  setStatus(`Saved "${label}" (${areaFt2.toFixed(2)} sq ft). ${modeHelpText()}`);
  triPoints = [];
  updateUI();
  draw();
});

// Undo / Clear
btnUndo.addEventListener("click", () => {
  if (saved.length === 0) return;
  const removed = saved.pop();
  setStatus(`Undid "${removed ? removed.label : "Area"}". ${modeHelpText()}`);
  updateUI();
  draw();
});

btnClear.addEventListener("click", () => {
  if (saved.length === 0) return;
  saved = [];
  setStatus(`Cleared all saved selections. ${modeHelpText()}`);
  updateUI();
  draw();
});

// Initial UI
updateUI();
draw();
