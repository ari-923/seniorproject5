import OpenAI from "openai";
import { checkBasicDailyLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "AI Tutor is not configured yet. Add OPENAI_API_KEY in Vercel Environment Variables." }, { status: 503 });
    }

    const dailyLimit = Number(process.env.TUTOR_DAILY_LIMIT || 25);
    const limit = checkBasicDailyLimit(clientIp(request), Number.isFinite(dailyLimit) ? dailyLimit : 25);
    if (!limit.allowed) {
      return Response.json({ error: "Daily AI Tutor limit reached for this deployment instance. Try again later." }, { status: 429 });
    }

    const body = await request.json();
    const message = String(body.message || "").trim().slice(0, 4000);
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const context = body.context || {};
    if (!message) return Response.json({ error: "Please enter a question." }, { status: 400 });

    const courseContext = JSON.stringify({
      lessonId: context.lessonId,
      lessonTitle: context.lessonTitle,
      chapterName: context.chapterName,
      sectionNumber: context.sectionNumber,
      sectionTitle: context.sectionTitle,
      learn: context.learn,
      breakdown: context.breakdown,
      why: context.why,
      example: context.example,
      exam: context.exam,
      definitions: context.definitions,
    }, null, 2).slice(0, 14000);

    const instructions = `You are S+ AI Study Coach, a patient CompTIA Security+ tutor embedded inside a self-contained course.

PRIMARY RULE: Teach from the COURSE CONTEXT first. The student should never need to find the original ZIP, PDF, or PowerPoint. Explain the concept directly.

Teaching behavior:
- Answer the student's actual question first.
- Use clear beginner-friendly language, then add technical precision when useful.
- When appropriate, use a short example or analogy.
- For exam preparation, explain clue words and why similar answer choices differ.
- If the student asks to be quizzed, ask one question at a time and wait for their answer before revealing it.
- If the student asks about something not supported by the course context, you may add generally known Security+ context, but label it "Additional Security+ context".
- Never claim you know the student's real CompTIA exam questions or provide exam dumps.
- Do not tell the student to consult the source files.
- Keep answers focused and normally under 500 words unless the student requests more detail.

COURSE CONTEXT:
${courseContext}`;

    const input = [
      ...history.filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
      { role: "user", content: message },
    ];

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      instructions,
      input,
      max_output_tokens: 900,
    });

    return Response.json({ answer: response.output_text || "I couldn't generate an answer for that question.", remaining: limit.remaining });
  } catch (error) {
    console.error("AI Tutor error", error);
    return Response.json({ error: "The AI Tutor could not answer right now. Check the Vercel function logs and your API configuration." }, { status: 500 });
  }
}
