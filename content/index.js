import chapters from "./chapters.json";
import scenarioQuestions from "./scenario-questions.json";
import lesson_01_02 from "./lessons/01-02.json";
import lesson_02_01 from "./lessons/02-01.json";
import lesson_02_02 from "./lessons/02-02.json";
import lesson_02_03 from "./lessons/02-03.json";
import lesson_02_04 from "./lessons/02-04.json";
import lesson_02_05 from "./lessons/02-05.json";
import lesson_02_06 from "./lessons/02-06.json";
import lesson_02_07 from "./lessons/02-07.json";
import lesson_03_01 from "./lessons/03-01.json";
import lesson_03_02 from "./lessons/03-02.json";
import lesson_03_03 from "./lessons/03-03.json";
import lesson_04_01 from "./lessons/04-01.json";
import lesson_04_02 from "./lessons/04-02.json";
import lesson_04_03 from "./lessons/04-03.json";
import lesson_04_04 from "./lessons/04-04.json";
import lesson_04_05 from "./lessons/04-05.json";
import lesson_04_06 from "./lessons/04-06.json";
import lesson_04_07 from "./lessons/04-07.json";
import lesson_04_08 from "./lessons/04-08.json";
import lesson_04_09 from "./lessons/04-09.json";
import lesson_04_10 from "./lessons/04-10.json";
import lesson_05_01 from "./lessons/05-01.json";
import lesson_05_02 from "./lessons/05-02.json";
import lesson_05_03 from "./lessons/05-03.json";
import lesson_06_01 from "./lessons/06-01.json";
import lesson_07_01 from "./lessons/07-01.json";
import lesson_08_01 from "./lessons/08-01.json";
import lesson_08_02 from "./lessons/08-02.json";
import lesson_08_03 from "./lessons/08-03.json";
import lesson_08_04 from "./lessons/08-04.json";
import lesson_08_05 from "./lessons/08-05.json";
import lesson_08_06 from "./lessons/08-06.json";
import lesson_08_07 from "./lessons/08-07.json";
import lesson_09_01 from "./lessons/09-01.json";
import lesson_09_02 from "./lessons/09-02.json";
import lesson_09_03 from "./lessons/09-03.json";
import lesson_09_04 from "./lessons/09-04.json";
import lesson_10_01 from "./lessons/10-01.json";
import lesson_10_02 from "./lessons/10-02.json";
import lesson_10_03 from "./lessons/10-03.json";
import lesson_10_04 from "./lessons/10-04.json";
import lesson_10_05 from "./lessons/10-05.json";
import lesson_10_06 from "./lessons/10-06.json";
import lesson_10_07 from "./lessons/10-07.json";
import lesson_10_08 from "./lessons/10-08.json";
import lesson_10_09 from "./lessons/10-09.json";
import lesson_10_10 from "./lessons/10-10.json";
import lesson_10_11 from "./lessons/10-11.json";
import lesson_10_12 from "./lessons/10-12.json";
import lesson_10_13 from "./lessons/10-13.json";
import lesson_10_14 from "./lessons/10-14.json";
import lesson_11_01 from "./lessons/11-01.json";
import lesson_11_02 from "./lessons/11-02.json";
import lesson_12_01 from "./lessons/12-01.json";
import lesson_12_02 from "./lessons/12-02.json";
import lesson_12_03 from "./lessons/12-03.json";
import lesson_12_04 from "./lessons/12-04.json";
import lesson_13_01 from "./lessons/13-01.json";
import lesson_13_02 from "./lessons/13-02.json";
import lesson_13_03 from "./lessons/13-03.json";
import lesson_13_04 from "./lessons/13-04.json";
import lesson_13_05 from "./lessons/13-05.json";
import lesson_13_06 from "./lessons/13-06.json";
import lesson_13_07 from "./lessons/13-07.json";
import lesson_15_01 from "./lessons/15-01.json";
import lesson_16_01 from "./lessons/16-01.json";
import lesson_16_02 from "./lessons/16-02.json";
import lesson_16_03 from "./lessons/16-03.json";
import lesson_16_04 from "./lessons/16-04.json";
import lesson_16_05 from "./lessons/16-05.json";
import lesson_17_01 from "./lessons/17-01.json";
import lesson_17_02 from "./lessons/17-02.json";
import lesson_17_03 from "./lessons/17-03.json";

export const lessons = [lesson_01_02, lesson_02_01, lesson_02_02, lesson_02_03, lesson_02_04, lesson_02_05, lesson_02_06, lesson_02_07, lesson_03_01, lesson_03_02, lesson_03_03, lesson_04_01, lesson_04_02, lesson_04_03, lesson_04_04, lesson_04_05, lesson_04_06, lesson_04_07, lesson_04_08, lesson_04_09, lesson_04_10, lesson_05_01, lesson_05_02, lesson_05_03, lesson_06_01, lesson_07_01, lesson_08_01, lesson_08_02, lesson_08_03, lesson_08_04, lesson_08_05, lesson_08_06, lesson_08_07, lesson_09_01, lesson_09_02, lesson_09_03, lesson_09_04, lesson_10_01, lesson_10_02, lesson_10_03, lesson_10_04, lesson_10_05, lesson_10_06, lesson_10_07, lesson_10_08, lesson_10_09, lesson_10_10, lesson_10_11, lesson_10_12, lesson_10_13, lesson_10_14, lesson_11_01, lesson_11_02, lesson_12_01, lesson_12_02, lesson_12_03, lesson_12_04, lesson_13_01, lesson_13_02, lesson_13_03, lesson_13_04, lesson_13_05, lesson_13_06, lesson_13_07, lesson_15_01, lesson_16_01, lesson_16_02, lesson_16_03, lesson_16_04, lesson_16_05, lesson_17_01, lesson_17_02, lesson_17_03];
export { chapters, scenarioQuestions };

export function getLesson(id) {
  return lessons.find((lesson) => lesson.id === id) || null;
}

export function getLessonNeighbors(id) {
  const index = lessons.findIndex((lesson) => lesson.id === id);
  return {
    previous: index > 0 ? lessons[index - 1] : null,
    next: index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null,
  };
}

export function learningSections(lesson) {
  return lesson.slides.filter((section) => section.instructional);
}

export function sectionKey(lessonId, sectionNumber) {
  return `${lessonId}-${sectionNumber}`;
}
