export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const { message, snapshot } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY environment variable' });
    }

    const system = `
You are an assistant for a "Blueprint Flooring Estimator" web app.
Only help with:
- understanding totals and selections
- adding waste percentage (e.g., +10%)
- estimating cost if user provides price per sq ft
- explaining simple flooring math clearly

If unrelated, politely redirect to blueprint/flooring topics.
Keep answers short and practical.
`.trim();

    const user = `
User question: ${message}

Estimator snapshot (read-only):
${JSON.stringify(snapshot || {}, null, 2)}
`.trim();

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    const raw = await r.text();

    if (!r.ok) {
      return res.status(500).json({ error: 'OpenAI request failed', details: raw });
    }

    let data = {};
    try { data = JSON.parse(raw); } catch {}
    const reply = data.output_text || 'No output_text returned.';
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e) });
  }
}
