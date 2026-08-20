"use client";

import Link from "next/link";
import { useProgress } from "./ProgressProvider";

export default function CourseOverview({ chapters }) {
  const { mastered } = useProgress();
  return <section>
    <div className="view-head"><div><h2>Full Uploaded Course</h2><p>Work through the lessons in order, or jump directly to a topic you want to review.</p></div></div>
    {chapters.map((chapter) => {
      const complete = chapter.lessons.filter((lesson) => lesson.keys.length && lesson.keys.every((key) => mastered.has(key))).length;
      return <section className="chapter-card" key={chapter.chapter}>
        <div className="chapter-head"><div><div className="eyebrow">Chapter {chapter.chapter}</div><h3>{chapter.name}</h3><small>{chapter.lessons.length} lessons • {chapter.instructional_count} learning sections</small></div><div>{complete}/{chapter.lessons.length} complete</div></div>
        <div className="chapter-lessons">{chapter.lessons.map((lesson) => {
          const done = lesson.keys.length && lesson.keys.every((key) => mastered.has(key));
          return <Link className="lesson-card" href={`/course/${lesson.id}`} key={lesson.id}><span className="id">{lesson.id}</span><strong>{lesson.title}</strong><small>{lesson.learningCount} learning sections • {done ? "✓ complete" : "start lesson"}</small></Link>;
        })}</div>
      </section>;
    })}
  </section>;
}
