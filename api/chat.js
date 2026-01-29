export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { message, snapshot } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "Missing OPENAI_API_KEY environment variable" });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const systemText = `
You are an assistant for a "Blueprint Flooring Estimator" web app.

Only help with:
- understanding totals and selections
- adding waste percentage (e.g., +10%)
- estimating cost if user provides price per sq ft
- explaining simple flooring math clearly

If unrelated, politely redirect to blueprint/flooring topics.
Keep answers short and practical.
`.trim();

    const userText = `
User question: ${message}

Estimator snapshot (read-only):
${JSON.stringify(snapshot || {}, null, 2)}
`.trim();

    // ✅ Correct Responses API payload format
    const payload = {
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemText }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userText }],
        },
      ],
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!r.ok) {
      // Surface the actual OpenAI error message in Vercel logs + response
      return res.status(500).json({
        error: "OpenAI request failed",
        status: r.status,
        details: data,
      });
    }

    // ✅ Reliable extraction of text from Responses API
    const reply =
      data.output_text ||
      (Array.isArray(data.output)
        ? data.output
            .flatMap((o) => o.content || [])
            .filter((c) => c.type === "output_text" && typeof c.text === "string")
            .map((c) => c.text)
            .join("\n")
        : "") ||
      "No text returned.";

    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
