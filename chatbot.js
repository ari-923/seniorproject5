const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

function addMsg(text, from = 'bot') {
  const div = document.createElement('div');
  div.textContent = (from === 'user' ? 'You: ' : 'AI: ') + text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

chatSend.onclick = async () => {
  const msg = chatInput.value.trim();
  if (!msg) return;

  chatInput.value = '';
  addMsg(msg, 'user');

  try {
    const snapshot = window.getEstimatorSnapshot?.() || {};

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, snapshot })
    });

    const data = await res.json();
    addMsg(data.reply || 'No response.');
  } catch {
    addMsg('AI unavailable. Are you on Vercel?');
  }
};
