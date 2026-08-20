import { chapters, lessons, learningSections, scenarioQuestions, sectionKey } from "@/content";
import HomeDashboard from "@/components/HomeDashboard";

export default function HomePage() {
  const progressShape = lessons.map((lesson) => ({
    id: lesson.id,
    chapter: lesson.chapter,
    keys: learningSections(lesson).map((section) => sectionKey(lesson.id, section.n)),
  }));

  return (
    <HomeDashboard
      chapters={chapters}
      progressShape={progressShape}
      lessonCount={lessons.length}
      learningCount={progressShape.reduce((sum, lesson) => sum + lesson.keys.length, 0)}
      quizCount={scenarioQuestions.length}
    />
  );
}
