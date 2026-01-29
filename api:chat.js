export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const { message, context } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const system = `
You are an assistant for a "Blueprint Flooring Estimator" web app.
You ONLY help with:
- explaining totals and saved selections
- adding waste percentage
- estimating flooring cost if user gives price per sq ft
- simple, clear math

If the question is unrelated, politely redirect to blueprint/flooring topics.
Keep answers short and practical.
`.trim();

    const user = `
User question: ${message}

App context:
- Total sq ft: ${context?.totalSqFt ?? 'unknown'}
- Selections count: ${context?.selectionsCount ?? 'unknown'}
- Selections summary: ${context?.selectionsSummary ?? 'none'}
`.trim();

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
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

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: 'OpenAI request failed', details: t });
    }

    const data = await r.json();
    const reply = data.output_text || 'No output_text returned.';
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e) });
  }
}
