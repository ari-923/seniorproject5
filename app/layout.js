import "./globals.css";
import { chapters, lessons } from "@/content";
import { ProgressProvider } from "@/components/ProgressProvider";
import SiteShell from "@/components/SiteShell";

export const metadata = {
  title: "Security+ SY0-701 Study Guide",
  description: "An interactive Security+ learning course with lessons, flashcards, quizzes, progress tracking, and an AI study coach.",
};

export default function RootLayout({ children }) {
  const navigation = chapters.map((chapter) => ({
    ...chapter,
    lessons: lessons
      .filter((lesson) => lesson.chapter === chapter.chapter)
      .map((lesson) => ({ id: lesson.id, title: lesson.title })),
  }));

  const searchIndex = lessons.flatMap((lesson) => [
    { kind: "lesson", lessonId: lesson.id, sectionNumber: null, title: `${lesson.id} ${lesson.title}`, subtitle: lesson.chapter_name },
    ...lesson.slides.map((section) => ({
      kind: "section",
      lessonId: lesson.id,
      sectionNumber: section.n,
      title: section.title,
      subtitle: `${lesson.id} · ${lesson.title}`,
    })),
  ]);

  return (
    <html lang="en">
      <body>
        <ProgressProvider>
          <SiteShell navigation={navigation} searchIndex={searchIndex}>{children}</SiteShell>
        </ProgressProvider>
      </body>
    </html>
  );
}
