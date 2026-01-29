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

addMsg('assistant', 'Hi! I can help explain your saved selections, total sq ft, and simple flooring estimates.');

function getBlueprintContext() {
  const total = (document.getElementById('totalOut')?.textContent || '0.00').trim();
  const count = (document.getElementById('countOut')?.textContent || '0').trim();
  const listText = (document.getElementById('list')?.innerText || '').trim();

  return {
    totalSqFt: total,
    selectionsCount: count,
    selectionsSummary: listText.slice(0, 1400)
  };
}

async function sendToAI(userText) {
  const ctx = getBlueprintContext();

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userText, context: ctx })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Server error ${res.status}. ${errText}`);
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
