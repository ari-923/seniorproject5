# Vercel AI Tutor Setup

## Required secret

Add `OPENAI_API_KEY` in Vercel → Project → Settings → Environment Variables.

Do **not** put the API key in a file that is committed to GitHub and do not prefix it with `NEXT_PUBLIC_`.

## Optional variables

- `OPENAI_MODEL=gpt-5.6`
- `TUTOR_DAILY_LIMIT=25`

After changing environment variables, redeploy so the new deployment receives them.

## Tutor endpoint

The browser calls:

```text
POST /api/tutor
```

The Next.js Route Handler in `app/api/tutor/route.js` runs server-side on Vercel and calls the OpenAI Responses API.
