'use strict';

/**
 * Simple localStorage auth + per-user saved projects.
 * - Register/Login with username+password
 * - Passwords are hashed with PBKDF2 (Web Crypto)
 * - Save/Load/Delete measurement projects per user
 *
 * NOTE: This is "client-side accounts" (same browser/device).
 * For real accounts across devices, use a backend + database.
 */

const LS_USERS = 'bfe_users_v1';
const LS_SESSION = 'bfe_session_v1';

function $(id) { return document.getElementById(id); }

const authLoggedOut = $('authLoggedOut');
const authLoggedIn = $('authLoggedIn');
const authUsername = $('authUsername');
const authPassword = $('authPassword');
const btnRegister = $('btnRegister');
const btnLogin = $('btnLogin');
const btnLogout = $('btnLogout');
const authUserLabel = $('authUserLabel');
const projectNameInput = $('projectNameInput');

const btnSaveProject = $('btnSaveProject');
const savedProjectsList = $('savedProjectsList');

function setStatus(msg) {
  const out = document.getElementById('statusOut');
  if (out) out.textContent = msg;
}

function normalizeUsername(u) {
  return (u || '').trim().toLowerCase();
}

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS) || '{}');
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

function setSession(username) {
  localStorage.setItem(LS_SESSION, JSON.stringify({ username, at: Date.now() }));
}

function clearSession() {
  localStorage.removeItem(LS_SESSION);
}

function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
    return s && s.username ? s : null;
  } catch {
    return null;
  }
}

function userProjectsKey(username) {
  return `bfe_projects_v1__${username}`;
}

function loadProjects(username) {
  try {
    return JSON.parse(localStorage.getItem(userProjectsKey(username)) || '[]');
  } catch {
    return [];
  }
}

function saveProjects(username, projects) {
  localStorage.setItem(userProjectsKey(username), JSON.stringify(projects));
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function pbkdf2Hash(password, saltB64) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 120000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return arrayBufferToBase64(bits);
}

function randomSaltB64() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(salt.buffer);
}

function requireEstimatorExports() {
  if (typeof window.exportFullEstimatorState !== 'function' ||
      typeof window.importFullEstimatorState !== 'function') {
    throw new Error('Missing estimator export/import helpers. Update app.js.');
  }
}

function renderAuthUI(usernameOrNull) {
  if (!authLoggedOut || !authLoggedIn) return;

  if (!usernameOrNull) {
    authLoggedOut.style.display = '';
    authLoggedIn.style.display = 'none';
    if (authUserLabel) authUserLabel.textContent = '';
    if (savedProjectsList) savedProjectsList.innerHTML = '';
    return;
  }

  authLoggedOut.style.display = 'none';
  authLoggedIn.style.display = '';
  if (authUserLabel) authUserLabel.textContent = usernameOrNull;

  renderProjects(usernameOrNull);
}

function renderProjects(username) {
  if (!savedProjectsList) return;

  const projects = loadProjects(username);
  savedProjectsList.innerHTML = '';

  if (!projects.length) {
    const empty = document.createElement('div');
    empty.className = 'muted small';
    empty.textContent = 'No saved projects yet. Save one!';
    savedProjectsList.appendChild(empty);
    return;
  }

  projects
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .forEach((p) => {
      const card = document.createElement('div');
      card.className = 'projectCard';

      const title = document.createElement('div');
      title.className = 'projectTitle';
      title.textContent = p.name || 'Untitled';

      const meta = document.createElement('div');
      meta.className = 'muted small';
      const date = p.updatedAt ? new Date(p.updatedAt) : null;
      meta.textContent =
        `${p.totalSqFt ?? 0} sq ft • ${p.count ?? 0} areas` +
        (date ? ` • ${date.toLocaleString()}` : '');

      const row = document.createElement('div');
      row.className = 'row';

      const btnLoad = document.createElement('button');
      btnLoad.textContent = 'Load';
      btnLoad.onclick = () => {
        try {
          requireEstimatorExports();
          window.importFullEstimatorState(p.state);
          setStatus(`Loaded project "${p.name}".`);
        } catch (e) {
          alert(String(e));
        }
      };

      const btnDelete = document.createElement('button');
      btnDelete.textContent = 'Delete';
      btnDelete.className = 'dangerBtn';
      btnDelete.onclick = () => {
        const ok = confirm(`Delete "${p.name}"? This can't be undone.`);
        if (!ok) return;
        const next = loadProjects(username).filter(x => x.id !== p.id);
        saveProjects(username, next);
        renderProjects(username);
        setStatus(`Deleted project "${p.name}".`);
      };

      row.appendChild(btnLoad);
      row.appendChild(btnDelete);

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(row);

      savedProjectsList.appendChild(card);
    });
}

async function register(username, password) {
  const users = loadUsers();
  if (users[username]) throw new Error('That username already exists on this device.');

  const salt = randomSaltB64();
  const hash = await pbkdf2Hash(password, salt);

  users[username] = { salt, hash, createdAt: Date.now() };
  saveUsers(users);

  setSession(username);
  renderAuthUI(username);
  setStatus('Account created and signed in.');
}

async function login(username, password) {
  const users = loadUsers();
  const rec = users[username];
  if (!rec) throw new Error('No account found for that username on this device.');

  const hash = await pbkdf2Hash(password, rec.salt);
  if (hash !== rec.hash) throw new Error('Incorrect password.');

  setSession(username);
  renderAuthUI(username);
  setStatus('Logged in.');
}

function logout() {
  clearSession();
  renderAuthUI(null);
  setStatus('Logged out.');
}

function saveCurrentProject(username) {
  requireEstimatorExports();

  const name = (projectNameInput?.value || '').trim();
  if (!name) {
    alert('Please enter a project name.');
    projectNameInput?.focus();
    return;
  }

  const state = window.exportFullEstimatorState();
  const totalSqFt = state?.snapshot?.totalSqFt ?? 0;
  const count = state?.snapshot?.selectionsCount ?? 0;

  const projects = loadProjects(username);
  const now = Date.now();

  projects.push({
    id: crypto.randomUUID(),
    name,
    updatedAt: now,
    totalSqFt,
    count,
    state
  });

  saveProjects(username, projects);
  renderProjects(username);
  setStatus(`Saved project "${name}".`);
  if (projectNameInput) projectNameInput.value = '';
}

/* ---------- Wire up events ---------- */

btnRegister?.addEventListener('click', async () => {
  try {
    const u = normalizeUsername(authUsername?.value);
    const p = (authPassword?.value || '').trim();
    if (!u || !p) return alert('Enter a username and password.');
    await register(u, p);
  } catch (e) {
    alert(String(e));
  }
});

btnLogin?.addEventListener('click', async () => {
  try {
    const u = normalizeUsername(authUsername?.value);
    const p = (authPassword?.value || '').trim();
    if (!u || !p) return alert('Enter a username and password.');
    await login(u, p);
  } catch (e) {
    alert(String(e));
  }
});

btnLogout?.addEventListener('click', () => logout());

btnSaveProject?.addEventListener('click', () => {
  const s = getSession();
  if (!s?.username) return alert('Please log in first.');
  saveCurrentProject(s.username);
});

// Auto-load session on refresh
const session = getSession();
renderAuthUI(session?.username || null);
