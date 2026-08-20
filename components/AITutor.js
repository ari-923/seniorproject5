"use client";

import { useMemo, useState } from "react";

const QUICK = [
  ["Explain simpler", "Explain this concept in simpler beginner-friendly language."],
  ["Give an analogy", "Give me a memorable analogy for this concept, then connect the analogy back to the technical meaning."],
  ["Give an example", "Give me a realistic cybersecurity example of this concept."],
  ["Security+ exam", "How might Security+ test this concept in a scenario? Give me the clue words and common traps."],
  ["Quiz me", "Quiz me on this concept. Ask one multiple-choice scenario question and do not reveal the answer until I respond."],
  ["Compare concepts", "What concept is most commonly confused with this one? Compare them clearly."],
];

export default function AITutor({ open, onClose, lesson, section }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const context = useMemo(() => ({
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    chapterName: lesson.chapter_name,
    sectionNumber: section?.n || null,
    sectionTitle: section?.title || "Lesson overview",
    learn: section?.course?.learn || "",
    breakdown: section?.course?.breakdown || [],
    why: section?.course?.why || "",
    example: section?.course?.example || "",
    exam: section?.course?.exam || "",
    definitions: section?.course?.defs || section?.defs || [],
  }), [lesson, section]);

  if (!open) return null;

  async function send(text) {
    const message = String(text || input).trim();
    if (!message || loading) return;
    const prior = messages;
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput(""); setLoading(true);
    try {
      const response = await fetch("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history: prior, context }) });
      const data = await response.json();
      setMessages((m) => [...m, { role: "assistant", content: data.answer || data.error || "The tutor could not respond." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "The tutor could not connect. Check your deployment and API environment variables." }]);
    } finally { setLoading(false); }
  }

  return <div className="ai-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="ai-panel">
      <div className="ai-head"><div><div className="eyebrow">S+ // AI STUDY COACH</div><strong>{lesson.id} · {section?.title || lesson.title}</strong></div><button className="icon" onClick={onClose}>×</button></div>
      <div className="ai-context">I’m tutoring you on <strong>{section?.title || lesson.title}</strong>. Ask anything about this lesson; you do not need the original files.</div>
      <div className="ai-quick">{QUICK.map(([label, prompt]) => <button key={label} onClick={() => send(prompt)} disabled={loading}>{label}</button>)}</div>
      <div className="ai-chat">{messages.length === 0 && <div className="ai-empty">Try “Explain simpler,” ask what a term means, or ask me to quiz you.</div>}{messages.map((m, i) => <div className={`ai-msg ${m.role}`} key={i}><span>{m.role === "user" ? "You" : "S+ Coach"}</span><p>{m.content}</p></div>)}{loading && <div className="ai-msg assistant"><span>S+ Coach</span><p>Thinking…</p></div>}</div>
      <form className="ai-form" onSubmit={(e) => { e.preventDefault(); send(); }}><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this lesson…" rows={3} /><button className="btn primary" disabled={loading || !input.trim()}>Send</button></form>
      <small className="ai-disclaimer">AI can make mistakes. Use it to understand and practice the course concepts, not as a source of real exam questions.</small>
    </aside>
  </div>;
}
