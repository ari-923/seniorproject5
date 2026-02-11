export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const { message, snapshot } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'Missing OPENAI_API_KEY environment variable'
      });
    }

    const systemPrompt = `
You are an assistant for a Blueprint Flooring Estimator web app.

You ONLY help with:
- total square footage
- adding waste percentage (e.g. +10%)
- estimating cost if price per sq ft is provided
- explaining flooring math clearly

Be concise, professional, and practical.
If the question is unrelated, politely redirect to flooring topics.
`.trim();

    const userPrompt = `
User question:
${message}

Estimator snapshot (read-only):
${JSON.stringify(snapshot || {}, null, 2)}
`.trim();

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return res.status(500).json({
        error: 'OpenAI request failed',
        details: errText
      });
    }

    const data = await openaiRes.json();

    // SAFELY extract assistant text from Responses API
    let reply = 'No reply generated.';

    if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.content) {
          for (const c of item.content) {
            if (c.type === 'output_text' && c.text) {
              reply = c.text;
              break;
            }
          }
        }
      }
    }

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({
      error: 'Server error',
      details: String(err)
    });
  }
}
