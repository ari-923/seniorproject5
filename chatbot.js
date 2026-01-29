'use strict';

const chatFab = document.getElementById('chatFab');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

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

const isGitHubPages = location.hostname.endsWith('github.io');

addMsg('assistant',
  isGitHubPages
    ? "Hi! The chat UI works on GitHub Pages, but AI replies require a server (Vercel/Netlify) to run /api/chat.\n\nDeploy this repo on Vercel to enable AI."
    : "Hi! Ask me about your total sq ft, adding waste %, or cost estimates."
);

function getEstimatorSnapshot() {
  // Uses the safe snapshot you now expose from app.js
  if (typeof window.getEstimatorSnapshot === 'function') {
    return window.getEstimatorSnapshot();
  }

  // fallback
  const total = (document.getElementById('totalOut')?.textContent || '0.00').trim();
  const count = (document.getElementById('countOut')?.textContent || '0').trim();
  return {
    totalSqFt: Number(total),
    selectionsCount: Number(count),
    selections: []
  };
}

// IMPORTANT:
// Use RELATIVE path so it works under subpaths too (GitHub/Vercel).
// On Vercel it resolves to https://yourapp.vercel.app/api/chat
// On GitHub Pages it resolves to https://user.github.io/repo/api/chat (but GH Pages won’t execute it)
const API_URL = 'api/chat';

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
    throw new Error(`API error ${res.status}. ${errText}`);
  }

  const data = await res.json();
  return data.reply || 'No reply returned.';
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = (chatInput.value || '').trim();
  if (!text) return;

  chatInput.value = '';
  addMsg('user', text);

  // If on GitHub Pages, don’t even try to call the API
  if (isGitHubPages) {
    addMsg(
      'assistant',
      "AI replies are disabled on GitHub Pages.\n\nTo enable AI:\n1) Deploy this repo on Vercel\n2) Add OPENAI_API_KEY in Vercel Environment Variables\n3) Use your Vercel link"
    );
    return;
  }

  chatSend.disabled = true;
  chatInput.disabled = true;

  try {
    const reply = await sendToAI(text);
    addMsg('assistant', reply);
  } catch (err) {
    addMsg('assistant', `Sorry — I couldn't reach the AI.\n${String(err.message || err)}`);
  } finally {
    chatSend.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
});
