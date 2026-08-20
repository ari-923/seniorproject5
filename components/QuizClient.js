"use client";

import { useState } from "react";
import { useProgress } from "./ProgressProvider";

function shuffle(list) { return [...list].sort(() => Math.random() - .5); }

export default function QuizClient({ questionBank }) {
  const { setBestScore } = useProgress();
  const [run, setRun] = useState(() => ({ questions: shuffle(questionBank).slice(0, 20), index: 0, score: 0, answered: null }));
  const q = run.questions[run.index];
  const restart = () => setRun({ questions: shuffle(questionBank).slice(0, 20), index: 0, score: 0, answered: null });

  if (run.index >= run.questions.length) {
    const pct = Math.round(run.score / run.questions.length * 100);
    setTimeout(() => setBestScore(pct), 0);
    return <section><div className="view-head"><div><h2>Scenario Quiz</h2><p>20 randomized Security+ style questions per attempt.</p></div><button className="btn" onClick={restart}>New quiz</button></div><div className="quiz-shell"><div className="result"><div className="eyebrow">Quiz complete</div><div className="score">{pct}%</div><p>{run.score} of {run.questions.length} correct.</p><button className="btn primary" onClick={restart}>Take another quiz</button></div></div></section>;
  }

  function answer(choice) {
    if (run.answered != null) return;
    setRun((r) => ({ ...r, answered: choice, score: r.score + (choice === q.answer ? 1 : 0) }));
  }

  return <section><div className="view-head"><div><h2>Scenario Quiz</h2><p>20 randomized Security+ style questions per attempt.</p></div><button className="btn" onClick={restart}>New quiz</button></div><div className="quiz-shell"><div className="quiz-top"><span>Question {run.index + 1} of {run.questions.length}</span><span>Score: {run.score}</span></div><div className="progress"><span style={{ width: `${run.index / run.questions.length * 100}%` }} /></div><div className="quiz-q">{q.q}</div><div className="choices">{q.choices.map((choice, i) => <button className={`choice ${run.answered != null && i === q.answer ? "correct" : ""} ${run.answered === i && i !== q.answer ? "wrong" : ""}`} disabled={run.answered != null} onClick={() => answer(i)} key={choice}>{String.fromCharCode(65 + i)}. {choice}</button>)}</div>{run.answered != null && <div className="explain show"><strong>{run.answered === q.answer ? "Correct." : "Not quite."}</strong> {q.why}</div>}{run.answered != null && <div className="quiz-next"><button className="btn primary" onClick={() => setRun((r) => ({ ...r, index: r.index + 1, answered: null }))}>Next question →</button></div>}</div></section>;
}
