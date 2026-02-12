
'use strict';

/**
 * Blueprint Flooring Estimator (Rect / Circle / Triangle)
 * - Upload PNG/JPG blueprint
 * - Draw shapes on canvas
 * - Enter REAL dimensions in feet + label
 * - Saves selections and totals
 *
 * Required HTML element IDs:
 *  blueprintInput, shapeMode, undoBtn, clearBtn,
 *  statusOut, canvas, totalOut, countOut, listOut
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
const projectNameInput = document.getElementById('projectNameInput');
const btnSaveProject = document.getElementById('btnSaveProject');
const projectsList = document.getElementById('projectsList');
const authEmailInput = document.getElementById('authEmailInput');
const authPasswordInput = document.getElementById('authPasswordInput');
const btnSignUp = document.getElementById('btnSignUp');
const btnSignIn = document.getElementById('btnSignIn');
const btnSignOut = document.getElementById('btnSignOut');
const authStateOut = document.getElementById('authStateOut');

if (!canvas) throw new Error('Missing #canvas in HTML.');
const ctx = canvas.getContext('2d');

// ----- State -----
let blueprintImg = null;
let blueprintDataUrl = null;
const MAX_BLUEPRINT_BYTES = 2 * 1024 * 1024;
const LS_PROJECTS = 'bfe_projects_v1';
const LS_PROJECTS_BY_USER = 'bfe_projects_by_user_v1';
const LS_USERS = 'bfe_users_v1';
const LS_SESSION = 'bfe_session_v1';

// saved selections (normalized geometry + real measurements + computed area)
let selections = [];
let currentUser = null;

// drawing interaction state
let mode = (shapeModeEl?.value || 'rect'); // 'rect' | 'circle' | 'tri'
let isDragging = false;

// for rect
let dragStart = null; // {x, y} in CSS px
let dragEnd = null;

// for circle
let circleCenter = null; // {x,y}
let circleEdge = null;   // {x,y}

// for triangle
let triPoints = []; // [{x,y},{x,y},{x,y}] in CSS px

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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function loadUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

function loadProjectsStore() {
  try {
    const store = JSON.parse(localStorage.getItem(LS_PROJECTS_BY_USER) || '{}');
    if (store && typeof store === 'object' && !Array.isArray(store)) return store;
    return {};
  } catch {
    return {};
  }
}

function saveProjectsStore(store) {
  localStorage.setItem(LS_PROJECTS_BY_USER, JSON.stringify(store));
}

function setCurrentUser(user) {
  currentUser = user || null;
  try {
    if (currentUser?.id) {
      localStorage.setItem(LS_SESSION, currentUser.id);
    } else {
      localStorage.removeItem(LS_SESSION);
    }
  } catch {
    // Ignore storage failures so the estimator still works.
  }
}

function restoreSessionUser() {
  let sessionUserId = null;
  try {
    sessionUserId = localStorage.getItem(LS_SESSION);
  } catch {
    setCurrentUser(null);
    return;
  }
  if (!sessionUserId) {
    setCurrentUser(null);
    return;
  }

  const user = loadUsers().find((u) => u.id === sessionUserId) || null;
  setCurrentUser(user);
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  if (!crypto?.subtle) {
    return btoa(unescape(encodeURIComponent(`${salt}:${password}`)));
  }

  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
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

// --- Canvas resize helper ---
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
    // empty background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    return;
  }

  // Fit image into canvas while preserving aspect ratio
  const iw = blueprintImg.naturalWidth || blueprintImg.width;
  const ih = blueprintImg.naturalHeight || blueprintImg.height;

  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;

  // background
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, w, h);

  ctx.drawImage(blueprintImg, dx, dy, dw, dh);

  // thin border
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
    ctx.strokeStyle = '#16a34a'; // green-ish
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

      // label
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

  // active preview shape while drawing
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2563eb'; // blue-ish
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
    // draw points
    ctx.fillStyle = '#2563eb';
    for (const p of triPoints) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // draw lines if 2+ points
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
    }

    card.appendChild(title);
    card.appendChild(meta);

    // delete button
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

    // light styling without relying on extra CSS
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

// Full export/import for saving projects
window.exportFullEstimatorState = function exportFullEstimatorState() {
  return {
    version: 1,
    mode,
    selections: JSON.parse(JSON.stringify(selections)),
    blueprint: blueprintDataUrl ? { dataUrl: blueprintDataUrl } : null,
    snapshot: window.getEstimatorSnapshot()
  };
};

window.importFullEstimatorState = function importFullEstimatorState(state) {
  if (!state || !Array.isArray(state.selections)) {
    throw new Error('Invalid project data.');
  }

  selections = state.selections.map((s) => ({
    type: s.type,
    label: s.label || '',
    geo: s.geo,
    real: s.real,
    areaSqFt: Number(s.areaSqFt) || 0
  }));

  if (state.mode === 'rect' || state.mode === 'circle' || state.mode === 'tri') {
    mode = state.mode;
    if (shapeModeEl) shapeModeEl.value = mode;
  }

  isDragging = false;
  dragStart = dragEnd = null;
  circleCenter = circleEdge = null;
  triPoints = [];

  blueprintDataUrl = state.blueprint?.dataUrl || null;
  if (blueprintDataUrl) {
    const img = new Image();
    img.onload = () => {
      blueprintImg = img;
      fitCanvasToWrap();
      render();
    };
    img.onerror = () => {
      blueprintImg = null;
      fitCanvasToWrap();
      render();
    };
    img.src = blueprintDataUrl;
  } else {
    blueprintImg = null;
    fitCanvasToWrap();
    render();
  }

  recomputeTotals();
  render();
};

function loadProjects() {
  if (!currentUser) {
    try {
      return JSON.parse(localStorage.getItem(LS_PROJECTS) || '[]');
    } catch {
      return [];
    }
  }

  const store = loadProjectsStore();
  const userProjects = store[currentUser.id];
  return Array.isArray(userProjects) ? userProjects : [];
}

function saveProjects(projects) {
  if (!currentUser) {
    localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
    return;
  }

  const store = loadProjectsStore();
  store[currentUser.id] = projects;
  saveProjectsStore(store);
}

function updateAuthUI() {
  const signedIn = Boolean(currentUser);

  if (authStateOut) {
    authStateOut.textContent = signedIn
      ? `Signed in as ${currentUser.email}`
      : 'Not signed in. Guest saves stay on this device only.';
  }

  if (btnSignOut) btnSignOut.disabled = !signedIn;
  if (btnSignIn) btnSignIn.disabled = signedIn;
  if (btnSignUp) btnSignUp.disabled = signedIn;
}

function renderProjects() {
  if (!projectsList) return;

  const projects = loadProjects()
    .slice()
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

  projectsList.innerHTML = '';

  if (!projects.length) {
    const empty = document.createElement('div');
    empty.className = 'muted small';
    empty.textContent = 'No saved projects yet.';
    projectsList.appendChild(empty);
    return;
  }

  projects.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'projectCard';

    const title = document.createElement('div');
    title.className = 'projectTitle';
    title.textContent = p.name || 'Untitled';

    const meta = document.createElement('div');
    meta.className = 'muted small';
    const date = p.savedAt ? new Date(p.savedAt) : null;
    meta.textContent =
      `${p.totalSqFt ?? 0} sq ft • ${p.count ?? 0} areas` +
      (date ? ` • ${date.toLocaleString()}` : '');

    const row = document.createElement('div');
    row.className = 'row';

    const btnLoad = document.createElement('button');
    btnLoad.textContent = 'Load';
    btnLoad.addEventListener('click', () => {
      try {
        window.importFullEstimatorState(p.state);
        setStatus(`Loaded project "${p.name}".`);
      } catch (e) {
        alert(String(e));
      }
    });

    const btnDelete = document.createElement('button');
    btnDelete.textContent = 'Delete';
    btnDelete.className = 'dangerBtn';
    btnDelete.addEventListener('click', () => {
      const ok = confirm(`Delete "${p.name}"? This can't be undone.`);
      if (!ok) return;
      const next = loadProjects().filter(x => x.id !== p.id);
      saveProjects(next);
      renderProjects();
      setStatus(`Deleted project "${p.name}".`);
    });

    row.appendChild(btnLoad);
    row.appendChild(btnDelete);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(row);

    projectsList.appendChild(card);
  });
}

function clearAuthInputs() {
  if (authPasswordInput) authPasswordInput.value = '';
}

async function signUpAccount() {
  const email = normalizeEmail(authEmailInput?.value || '');
  const password = String(authPasswordInput?.value || '');

  if (!isValidEmail(email)) {
    alert('Please enter a valid email address.');
    authEmailInput?.focus();
    return;
  }

  if (password.length < 6) {
    alert('Password must be at least 6 characters.');
    authPasswordInput?.focus();
    return;
  }

  const users = loadUsers();
  const exists = users.some((u) => normalizeEmail(u.email) === email);
  if (exists) {
    alert('An account with that email already exists.');
    return;
  }

  const salt = crypto.randomUUID();
  const passwordHash = await hashPassword(password, salt);

  const user = {
    id: crypto.randomUUID(),
    email,
    salt,
    passwordHash,
    createdAt: Date.now()
  };

  users.push(user);
  saveUsers(users);
  setCurrentUser(user);
  clearAuthInputs();
  updateAuthUI();
  renderProjects();
  setStatus(`Account created. Signed in as ${email}.`);
}

async function signInAccount() {
  const email = normalizeEmail(authEmailInput?.value || '');
  const password = String(authPasswordInput?.value || '');

  if (!isValidEmail(email)) {
    alert('Please enter a valid email address.');
    authEmailInput?.focus();
    return;
  }

  if (!password) {
    alert('Please enter your password.');
    authPasswordInput?.focus();
    return;
  }

  const users = loadUsers();
  const user = users.find((u) => normalizeEmail(u.email) === email);
  if (!user) {
    alert('No account found for that email.');
    return;
  }

  const passwordHash = await hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) {
    alert('Incorrect password.');
    return;
  }

  setCurrentUser(user);
  clearAuthInputs();
  updateAuthUI();
  renderProjects();
  setStatus(`Signed in as ${email}.`);
}

function signOutAccount() {
  if (!currentUser) return;
  const email = currentUser.email;
  setCurrentUser(null);
  clearAuthInputs();
  updateAuthUI();
  renderProjects();
  setStatus(`Signed out of ${email}.`);
}

function saveCurrentProject() {
  const name = (projectNameInput?.value || '').trim();
  if (!name) {
    alert('Please enter a project name.');
    projectNameInput?.focus();
    return;
  }

  const state = window.exportFullEstimatorState();
  const totalSqFt = state?.snapshot?.totalSqFt ?? 0;
  const count = state?.snapshot?.selectionsCount ?? 0;

  const projects = loadProjects();
  projects.push({
    id: crypto.randomUUID(),
    name,
    savedAt: Date.now(),
    totalSqFt,
    count,
    state
  });

  try {
    saveProjects(projects);
  } catch {
    alert('Save failed. Storage is full.');
    return;
  }

  if (projectNameInput) projectNameInput.value = '';
  renderProjects();
  setStatus(`Saved project "${name}".`);
}

// ----- Save selection after user inputs real dimensions -----
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

// ----- Events -----
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

if (btnSignUp) {
  btnSignUp.addEventListener('click', () => {
    void signUpAccount();
  });
}

if (btnSignIn) {
  btnSignIn.addEventListener('click', () => {
    void signInAccount();
  });
}

if (btnSignOut) {
  btnSignOut.addEventListener('click', () => {
    signOutAccount();
  });
}

if (authPasswordInput) {
  authPasswordInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (currentUser) return;
    void signInAccount();
  });
}

if (btnSaveProject) {
  btnSaveProject.addEventListener('click', () => saveCurrentProject());
}

if (projectNameInput) {
  projectNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveCurrentProject();
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

    const canPersist = file.size <= MAX_BLUEPRINT_BYTES;
    blueprintDataUrl = null;
    if (canPersist) {
      const reader = new FileReader();
      reader.onload = () => {
        blueprintDataUrl = typeof reader.result === 'string' ? reader.result : null;
      };
      reader.readAsDataURL(file);
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      blueprintImg = img;
      setStatus(
        canPersist
          ? 'Image loaded. Start selecting an area.'
          : 'Image loaded. Note: image too large to save with projects.'
      );

      // Wait one frame so CSS layout is final before measuring canvas size
      requestAnimationFrame(() => {
        fitCanvasToWrap();
        render();
      });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      alert('Could not load that image.');
    };
    img.src = url;
  });
}

// Canvas pointer events
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
    if (dist(dragStart, dragEnd) < 6) {
      setStatus('Drag a bigger rectangle.');
    } else {
      saveRect(dragStart, dragEnd);
    }
  }

  if (mode === 'circle' && circleCenter && circleEdge) {
    if (dist(circleCenter, circleEdge) < 6) {
      setStatus('Drag a bigger circle radius.');
    } else {
      saveCircle(circleCenter, circleEdge);
    }
  }

  dragStart = dragEnd = null;
  circleCenter = circleEdge = null;
  render();
});

// Triangle: click 3 points (no dragging)
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

// Initial UI
restoreSessionUser();
updateAuthUI();
setStatus('Upload an image to begin.');
recomputeTotals();
renderProjects();

// Wait a frame so the canvas has real CSS size before we set internal buffer size
requestAnimationFrame(() => {
  fitCanvasToWrap();
  render();
});
