import { scenarioQuestions } from "@/content";
import QuizClient from "@/components/QuizClient";

export const metadata = { title: "Scenario Quiz | Security+ Study Guide" };

export default function QuizPage() {
  return <QuizClient questionBank={scenarioQuestions} />;
}
