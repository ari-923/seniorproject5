export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const { message, snapshot } = req.body;

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: 'You help explain flooring totals, waste %, and cost.' },
          { role: 'user', content: message + '\n\nData:\n' + JSON.stringify(snapshot) }
        ]
      })
    });

    const data = await r.json();
    res.json({ reply: data.output_text || 'No reply.' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
