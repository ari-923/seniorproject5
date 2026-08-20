# Security+ SY0-701 Course — Next.js + Vercel

This repository is the organized, multi-file version of the Security+ study website. The uploaded numbering is preserved: Chapters 1–13 and 15–17 are present; Chapter 14 was not included in the uploaded set. It keeps the teal/HUD design, 73 lessons, learning sections, flashcards, scenario quizzes, browser-saved progress, and adds a secure Vercel server route for the **S+ AI Study Coach**.

## Project structure

```text
app/
  api/tutor/route.js       Secure AI Tutor endpoint
  course/[lessonId]/       Individual lesson route
  flashcards/              Flashcard study mode
  quiz/                    Scenario quiz mode
components/                Reusable UI + progress + AI Tutor
content/
  lessons/                 73 separate lesson JSON files
  chapters.json
  scenario-questions.json
lib/                       Rate-limit helper
.env.example               Environment variable template
```

## Upload to GitHub

1. Create a new GitHub repository.
2. Upload **the contents of this folder** to the repository root (not the outer ZIP folder).
3. Commit the files.

## Deploy with Vercel

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Vercel should automatically recognize it as a Next.js project.
3. In **Project Settings → Environment Variables**, add:

```text
OPENAI_API_KEY=your real OpenAI API key
OPENAI_MODEL=gpt-5.6
TUTOR_DAILY_LIMIT=25
```

4. Redeploy after adding/changing environment variables.

The API key is read only by `app/api/tutor/route.js`; it is never placed in browser JavaScript.

## Run locally

Requires a supported Node.js version (this project declares Node 22+).

```bash
npm install
cp .env.example .env.local
# edit .env.local and add your OpenAI API key
npm run dev
```

Then open `http://localhost:3000`.

## AI Tutor behavior

Each learning section has an **Ask AI Tutor** button. The browser sends the tutor:

- current chapter and lesson
- current learning-section title
- the course explanation
- breakdown / definitions
- example
- Security+ exam focus
- the student's question and recent chat history

The server route uses the OpenAI **Responses API**. The tutor is instructed to teach from the course context first and to label outside information as additional Security+ context.

### Cost / abuse note

The included daily limiter is intentionally simple and stored in the running server instance. It helps with accidental overuse but is **not durable global rate limiting** across every Vercel instance. Before promoting a high-traffic public site, add a durable rate-limit service or Vercel-level protection and set a budget/usage limit for your AI provider.

## Editing course content

Every lesson is its own JSON file under `content/lessons/`. A learning section's teaching content is stored under its `course` property, including:

```json
{
  "learn": "...",
  "breakdown": [{ "term": "...", "explanation": "..." }],
  "why": "...",
  "example": "...",
  "exam": "...",
  "check_q": "...",
  "check_a": "..."
}
```

That makes it possible to improve one lesson without editing a giant HTML document.

## Publication note

This course was built from uploaded study materials and expanded teaching notes. Before making the repository/public site widely public, confirm that you have permission to republish any source-derived wording that remains under **Source reference — optional**.
