import { notFound } from "next/navigation";
import { getLesson, getLessonNeighbors, lessons } from "@/content";
import LessonClient from "@/components/LessonClient";

export function generateStaticParams() {
  return lessons.map((lesson) => ({ lessonId: lesson.id }));
}

export async function generateMetadata({ params }) {
  const { lessonId } = await params;
  const lesson = getLesson(decodeURIComponent(lessonId));
  return lesson ? { title: `${lesson.id} ${lesson.title} | Security+ Study Guide` } : {};
}

export default async function LessonRoute({ params }) {
  const { lessonId } = await params;
  const decodedId = decodeURIComponent(lessonId);
  const lesson = getLesson(decodedId);
  if (!lesson) notFound();

  const { previous, next } = getLessonNeighbors(decodedId);
  const nextPreview = next
    ? { id: next.id, title: next.title, sections: next.slides.filter((s) => s.instructional).slice(0, 4).map((s) => ({ title: s.title, points: s.points })) }
    : null;

  return (
    <LessonClient
      lesson={lesson}
      previous={previous ? { id: previous.id, title: previous.title } : null}
      next={next ? { id: next.id, title: next.title } : null}
      nextPreview={nextPreview}
    />
  );
}
