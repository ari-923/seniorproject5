import { chapters, lessons, learningSections, sectionKey } from "@/content";
import CourseOverview from "@/components/CourseOverview";

export const metadata = { title: "Full Course | Security+ Study Guide" };

export default function CoursePage() {
  const chapterData = chapters.map((chapter) => ({
    ...chapter,
    lessons: lessons.filter((lesson) => lesson.chapter === chapter.chapter).map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      learningCount: learningSections(lesson).length,
      keys: learningSections(lesson).map((section) => sectionKey(lesson.id, section.n)),
    })),
  }));
  return <CourseOverview chapters={chapterData} />;
}
