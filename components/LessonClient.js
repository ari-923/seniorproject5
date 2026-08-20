"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useProgress } from "./ProgressProvider";
import AITutor from "./AITutor";

function keyFor(lessonId, n) { return `${lessonId}-${n}`; }

export default function LessonClient({ lesson, previous, next, nextPreview }) {
  const { mastered, setMastered } = useProgress();
  const learning = lesson.slides.filter((s) => s.instructional);
  const done = learning.filter((s) => mastered.has(keyFor(lesson.id, s.n))).length;
  const [tutorSection, setTutorSection] = useState(null);
  const [tutorOpen, setTutorOpen] = useState(false);

  useEffect(() => {
    if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, []);

  const objectives = useMemo(() => learning.map((s) => s.title).filter((v, i, a) => a.indexOf(v) === i).slice(0, 7), [lesson.id]);

  function askTutor(section) { setTutorSection(section); setTutorOpen(true); }

  return <div className="lesson-page">
    <div className="crumb"><Link className="btn" href="/course">← Full Course</Link> &nbsp; Chapter {lesson.chapter}: {lesson.chapter_name}</div>
    <h2 className="lesson-title">{lesson.id} {lesson.title}</h2>
    <div className="lesson-meta"><span className="pill">{learning.length} learning sections</span><span className="pill">{done}/{learning.length} mastered</span><button className="btn ai-inline" onClick={() => { setTutorSection(null); setTutorOpen(true); }}>✦ Ask AI about this lesson</button></div>
    <div className="lesson-intro"><h3>Lesson goals</h3><p>This lesson is self-contained. Read each section, work through examples, use the exam focus to understand how CompTIA may frame the concept, and answer the knowledge check before marking the section mastered.</p>{objectives.length > 0 && <ul className="lesson-objectives">{objectives.map((x) => <li key={x}>Explain or recognize <strong>{x}</strong> in a Security+ scenario.</li>)}</ul>}<p className="course-note">Original deck wording is available only under <strong>Source reference</strong>. You do not need the ZIP files to learn this lesson.</p></div>

    {lesson.slides.map((section) => section.instructional
      ? <LearningSection key={section.n} lesson={lesson} section={section} done={mastered.has(keyFor(lesson.id, section.n))} onDone={(v) => setMastered(keyFor(lesson.id, section.n), v)} onTutor={() => askTutor(section)} />
      : <TransitionSection key={section.n} lesson={lesson} section={section} nextPreview={nextPreview} />
    )}

    <div className="lesson-nav">{previous ? <Link className="btn" href={`/course/${previous.id}`}>← {previous.id} {previous.title}</Link> : <span />}{next ? <Link className="btn primary" href={`/course/${next.id}`}>{next.id} {next.title} →</Link> : <Link className="btn primary" href="/quiz">Take a scenario quiz →</Link>}</div>
    <AITutor open={tutorOpen} onClose={() => setTutorOpen(false)} lesson={lesson} section={tutorSection} />
  </div>;
}

function LearningSection({ lesson, section, done, onDone, onTutor }) {
  const c = section.course || {};
  return <article className={`slide-card ${done ? "done" : ""}`} id={`section-${lesson.id}-${section.n}`}>
    <div className="slide-head"><div className="slide-num">{section.n}</div><div><h4>{section.title}</h4><small>Learning section</small></div><div className="slide-actions"><button className="understand ai-section" onClick={onTutor}>✦ Ask AI Tutor</button><button className="understand" onClick={() => onDone(!done)}>{done ? "✓ Mastered" : "Mark mastered"}</button></div></div>
    <div className="slide-body">
      <h5>Learn this</h5><p className="course-lead">{c.learn || section.teach}</p>
      {!!c.breakdown?.length && <div className="course-block"><h5>Break it down</h5><div className="breakdown-list">{c.breakdown.map((item, i) => <div className="breakdown-item" key={`${item.term}-${i}`}><strong>{item.term}</strong><p>{item.explanation}</p></div>)}</div></div>}
      {!!(c.defs?.length || section.defs?.length) && <div className="course-block"><h5>Key terms</h5><div className="defs">{(c.defs?.length ? c.defs : section.defs).map((d, i) => { const term = Array.isArray(d) ? d[0] : d.term; const definition = Array.isArray(d) ? d[1] : d.definition; return <div className="def" key={`${term}-${i}`}><strong>{term}</strong> — {definition}</div>; })}</div></div>}
      {c.why && <div className="course-block why"><h5>Why it matters</h5><p>{c.why}</p></div>}
      {c.example && <div className="course-block example"><h5>Example</h5><p>{c.example}</p></div>}
      {c.exam && <div className="course-block exam"><h5>Security+ exam focus</h5><p>{c.exam}</p></div>}
      {c.check_q && <details className="recall"><summary>Check your understanding</summary><p><strong>Question:</strong> {c.check_q}</p><div className="answer"><strong>Answer:</strong> {c.check_a}</div></details>}
      <details className="raw"><summary>Source reference — optional</summary><pre>{section.raw}</pre></details>
    </div>
  </article>;
}

function TransitionSection({ lesson, section, nextPreview }) {
  const index = lesson.slides.findIndex((s) => s.n === section.n);
  const nearby = [];
  for (let i = index + 1; i < lesson.slides.length && nearby.length < 4; i++) {
    const next = lesson.slides[i];
    if (!next.instructional && nearby.length) break;
    if (next.instructional) nearby.push(next);
  }
  const preview = nearby.length ? nearby.map((s) => ({ title: s.title, points: s.points })) : (nextPreview?.sections || []);
  return <article className="slide-card transition-card" id={`section-${lesson.id}-${section.n}`}>
    <div className="slide-head"><div className="slide-num">{section.n}</div><div><h4>{section.title}</h4><small>What You’ll Learn</small></div></div>
    <div className="slide-body"><h5>What You’ll Learn</h5><p className="preview-intro">This section introduces <strong>{section.title}</strong>. Use the preview below to know what to focus on next.</p>{preview.length > 0 && <><h5>You’ll learn these concepts</h5><ul className="preview-focus">{preview.map((item, i) => <li key={`${item.title}-${i}`}><strong>{item.title}</strong>{item.points?.length ? ` — ${item.points.slice(0, 3).join(", ")}` : ""}</li>)}</ul></>}<div className="preview-goal"><strong>By the end:</strong> You should be able to explain <em>{section.title}</em> in your own words and connect it to the concepts that follow.</div>{section.defs?.length > 0 && <div className="defs">{section.defs.map((d, i) => <div className="def" key={i}><strong>{d[0]}</strong> — {d[1]}</div>)}</div>}<details className="raw"><summary>Source reference — optional</summary><pre>{section.raw}</pre></details></div>
  </article>;
}
