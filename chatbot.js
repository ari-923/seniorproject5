'use strict';

/* ===============================
   DOM ELEMENTS
================================ */
const chatFab = document.getElementById('chatFab');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

/* ===============================
   UI HELPERS
================================ */
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

chatFab.addEventListener('click', () => openChat(true));
chatClose.addEventListener('click', () => openChat(false));

/* ===============================
   INITIAL MESSAGE
================================ */
addMsg(
  'assistant',
  'Hi! Ask me about your total sq ft, adding waste %, or cost estimates.'
);

/* ===============================
   ESTIMATOR SNAPSHOT
================================ */
function getEstimatorSnapshot() {
  // Preferred: safe snapshot exposed by app.js
  if (typeof window.getEstimatorSnapshot === 'function') {
    return window.getEstimatorSnapshot();
  }

  // Fallback (never crashes)
  const total = (document.getElementById('totalOut')?.textContent || '0').trim();
  const count = (document.getElementById('countOut')?.textContent || '0').trim();

  return {
    totalSqFt: Number(total),
    selectionsCount: Number(count),
    selections: []
  };
}

/* ===============================
   API CONFIG
================================ */
// Leading slash ensures correct routing on Vercel
const API_URL = '/api/chat';

/* ===============================
   SEND MESSAGE TO AI
================================ */
async function sendToAI(userText) {
  const snapshot = getEstimatorSnapshot();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userText,
      snapshot
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.reply || 'No reply returned.';
}

/* ===============================
   FORM SUBMIT HANDLER
================================ */
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = (chatInput.value || '').trim();
  if (!text) return;

  chatInput.value = '';
  addMsg('user', text);

  chatSend.disabled = true;
  chatInput.disabled = true;

  try {
    const reply = await sendToAI(text);
    addMsg('assistant', reply);
  } catch (err) {
    addMsg(
      'assistant',
      `Sorry — I couldn't reach the AI.\n${String(err.message || err)}`
    );
  } finally {
    chatSend.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
});
