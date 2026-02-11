'use strict';

const LS_USERS = 'bfe_users_v1';
const LS_SESSION = 'bfe_session_v1';
function $(id) { return document.getElementById(id); }

// Widget UI
const acctBtn = $('acctBtn');
const acctPanel = $('acctPanel');
const acctBackdrop = $('acctBackdrop');
const acctClose = $('acctClose');

// Auth UI
const authLoggedOut = $('authLoggedOut');
const authLoggedIn = $('authLoggedIn');
const authUsername = $('authUsername');
const authPassword = $('authPassword');
const btnRegister = $('btnRegister');
const btnLogin = $('btnLogin');
const btnLogout = $('btnLogout');
const authUserLabel = $('authUserLabel');

const btnSaveProject = $('btnSaveProject');
const savedProjectsList = $('savedProjectsList');
const projectSearch = $('projectSearch');

// Save modal
const saveModal = $('saveModal');
const saveNameInput = $('saveNameInput');
const saveConfirm = $('saveConfirm');
const saveCancel = $('saveCancel');

let pendingSaveUsername = null;

function setStatus(msg) {
  const out = document.getElementById('statusOut');
  if (out) out.textContent = msg;
}

function normalizeUsername(u) { return (u || '').trim().toLowerCase(); }

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(LS_USERS) || '{}'); }
  catch { return {}; }
}
function saveUsers(users) { localStorage.setItem(LS_USERS, JSON.stringify(users)); }

function setSession(username) { localStorage.setItem(LS_SESSION, JSON.stringify({ username, at: Date.now() })); }
function clearSession() { localStorage.removeItem(LS_SESSION); }
function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
    return s && s.username ? s : null;
  } catch { return null; }
}

function userProjectsKey(username) { return `bfe_projects_v1__${username}`; }
function loadProjects(username) {
  try { return JSON.parse(localStorage.getItem(userProjectsKey(username)) || '[]'); }
  catch { return []; }
}
function saveProjects(username, projects) { localStorage.setItem(userProjectsKey(username), JSON.stringify(projects)); }

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function randomSaltB64() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(salt.buffer);
}
async function pbkdf2Hash(password, saltB64) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, keyMaterial, 256);
  return arrayBufferToBase64(bits);
}

function requireEstimatorExports() {
  if (typeof window.exportFullEstimatorState !== 'function' ||
      typeof window.importFullEstimatorState !== 'function') {
    throw new Error('Missing save/load helpers in app.js (exportFullEstimatorState/importFullEstimatorState).');
  }
}

// --- Panel open/close ---
function openPanel() {
  acctPanel?.classList.add('open');
  acctBackdrop?.classList.add('open');
}
function closePanel() {
  acctPanel?.classList.remove('open');
  acctBackdrop?.classList.remove('open');
}
acctBtn?.addEventListener('click', () => acctPanel?.classList.contains('open') ? closePanel() : openPanel());
acctBackdrop?.addEventListener('click', closePanel);
acctClose?.addEventListener('click', closePanel);

// --- Save modal open/close ---
function openSaveModal(username) {
  pendingSaveUsername = username;
  saveNameInput.value = '';
  saveModal.classList.add('open');
  setTimeout(() => saveNameInput.focus(), 0);
}
function closeSaveModal() {
  saveModal.classList.remove('open');
  pendingSaveUsername = null;
}

saveCancel?.addEventListener('click', closeSaveModal);

function doSaveWithName(name) {
  const username = pendingSaveUsername;
  if (!username) return;

  const trimmed = (name || '').trim();
  if (!trimmed) return alert('Please enter a project name.');

  requireEstimatorExports();
  const state = window.exportFullEstimatorState();

  const totalSqFt = state?.snapshot?.totalSqFt ?? 0;
  const count = state?.snapshot?.selectionsCount ?? 0;

  const projects = loadProjects(username);
  projects.push({
    id: crypto.randomUUID(),
    name: trimmed,
    updatedAt: Date.now(),
    totalSqFt,
    count,
    state
  });

  saveProjects(username, projects);
  renderProjects(username);
  closeSaveModal();
  setStatus(`Saved project "${trimmed}".`);
}

saveConfirm?.addEventListener('click', () => doSaveWithName(saveNameInput.value));
saveNameInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSaveWithName(saveNameInput.value);
});

// --- Render ---
function renderAuthUI(usernameOrNull) {
  if (!usernameOrNull) {
    authLoggedOut.style.display = '';
    authLoggedIn.style.display = 'none';
    savedProjectsList.innerHTML = '';
    return;
  }
  authLoggedOut.style.display = 'none';
  authLoggedIn.style.display = '';
  authUserLabel.textContent = usernameOrNull;
  renderProjects(usernameOrNull);
}

function renderProjects(username) {
  const q = (projectSearch?.value || '').trim().toLowerCase();
  const projects = loadProjects(username)
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .filter(p => !q || (p.name || '').toLowerCase().includes(q));

  savedProjectsList.innerHTML = '';

  if (!projects.length) {
    const empty = document.createElement('div');
    empty.className = 'muted small';
    empty.textContent = q ? 'No matches.' : 'No saved projects yet. Save one!';
    savedProjectsList.appendChild(empty);
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
    meta.textContent = `${p.totalSqFt ?? 0} sq ft • ${p.count ?? 0} areas`;

    const row = document.createElement('div');
    row.className = 'row';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => {
      requireEstimatorExports();
      window.importFullEstimatorState(p.state);
      setStatus(`Loaded "${p.name}".`);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'dangerBtn';
    delBtn.addEventListener('click', () => {
      if (!confirm(`Delete "${p.name}"?`)) return;
      saveProjects(username, loadProjects(username).filter(x => x.id !== p.id));
      renderProjects(username);
      setStatus(`Deleted "${p.name}".`);
    });

    row.appendChild(loadBtn);
    row.appendChild(delBtn);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(row);

    savedProjectsList.appendChild(card);
  });
}

projectSearch?.addEventListener('input', () => {
  const s = getSession();
  if (s?.username) renderProjects(s.username);
});

// --- Auth actions ---
btnRegister?.addEventListener('click', async () => {
  const u = normalizeUsername(authUsername.value);
  const p = (authPassword.value || '').trim();
  if (!u || !p) return alert('Enter username + password.');

  const users = loadUsers();
  if (users[u]) return alert('That username already exists on this device.');

  const salt = randomSaltB64();
  const hash = await pbkdf2Hash(p, salt);

  users[u] = { salt, hash, createdAt: Date.now() };
  saveUsers(users);

  setSession(u);
  renderAuthUI(u);
  setStatus('Account created and signed in.');
});

btnLogin?.addEventListener('click', async () => {
  const u = normalizeUsername(authUsername.value);
  const p = (authPassword.value || '').trim();
  if (!u || !p) return alert('Enter username + password.');

  const users = loadUsers();
  const rec = users[u];
  if (!rec) return alert('No account found for that username on this device.');

  const hash = await pbkdf2Hash(p, rec.salt);
  if (hash !== rec.hash) return alert('Incorrect password.');

  setSession(u);
  renderAuthUI(u);
  setStatus('Logged in.');
});

btnLogout?.addEventListener('click', () => {
  clearSession();
  renderAuthUI(null);
  setStatus('Logged out.');
});

btnSaveProject?.addEventListener('click', () => {
  const s = getSession();
  if (!s?.username) return alert('Please log in first.');
  openSaveModal(s.username);
});

// Auto-session
const session = getSession();
renderAuthUI(session?.username || null);
