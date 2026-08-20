"use client";

import { useState } from "react";
import { useProgress } from "./ProgressProvider";

export default function FlashcardsClient({ cards }) {
  const { isMastered, setMastered } = useProgress();
  const [deck, setDeck] = useState(cards);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = deck[pos];
  const move = (d) => { setPos((p) => (p + d + deck.length) % deck.length); setRevealed(false); };
  return <section>
    <div className="view-head"><div><h2>Course Flashcards</h2><p>Try to explain the concept before revealing the answer and exam focus.</p></div><div className="toolbar"><button className="btn" onClick={() => { setDeck([...deck].sort(() => Math.random() - .5)); setPos(0); setRevealed(false); }}>Shuffle</button></div></div>
    <div className="flash-shell"><div className="flash-meta"><span>Card {pos + 1} of {deck.length}</span><span>{card.lessonId} · {isMastered(card.key) ? "✓ mastered" : "not yet mastered"}</span></div><div className={`flash ${revealed ? "revealed" : ""}`} onClick={() => setRevealed((v) => !v)}><div className="front">{card.title}</div><div className="back"><strong>{card.answer}</strong><br/><br/>Exam focus: {card.exam}</div></div><div className="controls"><button className="btn" onClick={() => move(-1)}>← Previous</button><button className="btn" onClick={() => setRevealed((v) => !v)}>Reveal</button><button className="btn primary" onClick={() => { setMastered(card.key, true); move(1); }}>Mark mastered</button><button className="btn" onClick={() => move(1)}>Next →</button></div></div>
  </section>;
}
