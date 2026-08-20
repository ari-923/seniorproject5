"use client";

import Link from "next/link";
import { useProgress } from "./ProgressProvider";

export default function HomeDashboard({ chapters, progressShape, lessonCount, learningCount, quizCount }) {
  const { mastered, bestScore } = useProgress();
  const completedLessons = progressShape.filter((lesson) => lesson.keys.length && lesson.keys.every((key) => mastered.has(key))).length;
  const completedChapters = chapters.filter((chapter) => {
    const chapterLessons = progressShape.filter((lesson) => lesson.chapter === chapter.chapter);
    return chapterLessons.length && chapterLessons.every((lesson) => lesson.keys.length && lesson.keys.every((key) => mastered.has(key)));
  }).length;

  const firstOpen = progressShape.find((lesson) => lesson.keys.some((key) => !mastered.has(key))) || progressShape[0];

  return <section>
    <div className="hero">
      <div className="eyebrow">My LinkedIn: www.linkedin.com/in/arianaherrerauw</div>
      <h1>Learn the course, not just the topic names.</h1>
      <p>I have studied, watched videos, read articles, taken notes, and reviewed everything prior to posting everything here on this website I have created. I hope this helps you as much as it has helped me.</p>
      <div className="pills"><span className="pill">{lessonCount} lesson decks</span><span className="pill">{learningCount} learning sections</span><span className="pill">{quizCount} scenario questions</span><span className="pill">{chapters.length} uploaded chapters</span></div>
    </div>
    <div className="notice"><strong>Course:</strong> The website teaches the material directly. Original slide wording is only an optional reference inside lessons.</div>
    <div className="stats">
      <Stat value={`${completedLessons}/${lessonCount}`} label="Lessons completed" pct={completedLessons / lessonCount * 100} />
      <Stat value={`${mastered.size}/${learningCount}`} label="Learning sections mastered" pct={mastered.size / learningCount * 100} />
      <Stat value={bestScore == null ? "—" : `${bestScore}%`} label="Best scenario quiz" pct={bestScore || 0} />
      <Stat value={`${completedChapters}/${chapters.length}`} label="Chapters completed" pct={completedChapters / chapters.length * 100} />
    </div>
    <div className="action-grid">
      <Link className="action" href="/course"><strong>Start the Full Course</strong><span>Study the lessons in order and learn each concept directly on the website.</span></Link>
      <Link className="action" href={`/course/${firstOpen?.id || "01.02"}`}><strong>Resume Learning</strong><span>Jump to the first lesson that still has an unmastered learning section.</span></Link>
      <Link className="action" href="/flashcards"><strong>Active-Recall Flashcards</strong><span>Review every learning section after you study it.</span></Link>
      <Link className="action" href="/quiz"><strong>Scenario Practice</strong><span>Practice Security+ style questions with explanations.</span></Link>
    </div>
  </section>;
}

function Stat({ value, label, pct }) {
  return <div className="stat"><div className="big">{value}</div><div className="label">{label}</div><div className="progress"><span style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%` }} /></div></div>;
}
