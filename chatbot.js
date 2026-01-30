const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

function addBubble(role, text) {
  const row = document.createElement('div');
  row.className = `chat-row ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;

  row.appendChild(bubble);
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Initial assistant message
addBubble(
  'assistant',
  'Hi! Ask me about totals, waste %, or flooring cost estimates.'
);

chatSend.onclick = async () => {
  const msg = chatInput.value.trim();
  if (!msg) return;

  chatInput.value = '';
  addBubble('user', msg);

  try {
    const snapshot = window.getEstimatorSnapshot?.() || {};

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, snapshot })
    });

    const data = await res.json();
    addBubble('assistant', data.reply || 'No response.');
  } catch {
    addBubble(
      'assistant',
      'Sorry — I couldn’t reach the AI. Make sure you are on the Vercel site.'
    );
  }
};
