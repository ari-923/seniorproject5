'use strict';

// === Elements ===
const chatFab = document.getElementById('chatFab');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

// === Helpers ===
function addMsg(role, text) {
  const row = document.createElement('div');
  row.className = `msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function openChat(open) {
  chatPanel.classList.toggle('open', open);
  chatPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) chatInput.focus();
}

// === UI Events ===
chatFab.addEventListener('click', () => openChat(true));
chatClose.addEventListener('click', () => openChat(false));

// Detect GitHub Pages
const isGitHubPages = location.hostname.endsWith('github.io');

// Initial message
addMsg(
  'assistant',
  isGitHubPages
    ? "Hi! The chat UI works here, but AI replies require a server.\n\nDeploy this site on Vercel to enable AI."
    : "Hi! Ask me about totals, adding waste %, or cost estimates."
);

// === Estimator Snapshot ===
function getEstimatorSnapshot() {
  if (typeof window.getEstimatorSnapshot === 'function') {
    return window.getEstimatorSnapshot();
  }

  const total = (document.getElementById('totalOut')?.textContent || '0').trim();
  const count = (document.getElementById('countOut')?.textContent || '0').trim();

  return {
    totalSqFt: Number(total),
    selectionsCount: Number(count),
    selections: []
  };
}

// ✅ MUST BE ROOT PATH
const API_URL = '/api/chat';

// === API Call ===
async function sendToAI(userText) {
  const snapshot = getEstimatorSnapshot();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userText, snapshot })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.reply || 'No reply returned.';
}

// === Form Submit ===
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  addMsg('user', text);

  if (isGitHubPages) {
    addMsg(
      'assistant',
      "AI is disabled on GitHub Pages.\n\nUse your Vercel deployment to enable it."
    );
    return;
  }

  chatSend.disabled = true;
  chatInput.disabled = true;

  try {
    const reply = await sendToAI(text);
    addMsg('assistant', reply);
  } catch (err) {
    addMsg('assistant', `❌ ${err.message}`);
  } finally {
    chatSend.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
});
