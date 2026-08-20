import { lessons } from "@/content";
import FlashcardsClient from "@/components/FlashcardsClient";

export const metadata = { title: "Flashcards | Security+ Study Guide" };

export default function FlashcardsPage() {
  const cards = lessons.flatMap((lesson) =>
    lesson.slides.filter((section) => section.instructional).map((section) => ({
      key: `${lesson.id}-${section.n}`,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      sectionNumber: section.n,
      title: section.title,
      answer: section.course?.learn || section.teach || section.points.join(" · "),
      exam: section.course?.exam || "Explain the concept and recognize it in a Security+ scenario.",
    }))
  );
  return <FlashcardsClient cards={cards} />;
}
