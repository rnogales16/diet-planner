# Diet Planner

A small web app I built to plan my meals for the week. You can add dishes
manually or let an LLM generate a full 7-day plan for you based on your
preferences, what you have in the fridge, allergies, calorie targets, etc.

Built with Vue 3, Vite, Pinia and Tailwind. The whole thing is deployed on
Cloudflare Pages: static frontend + a Pages Function that proxies the LLM
calls so the API key never reaches the browser. Auth is handled by Cloudflare
Access, so only people I invite can use it.

## Features

- Weekly calendar with breakfast, snacks, lunch and dinner
- Manual dish editor (ingredients, steps, prep/cook times, macros)
- AI-generated 7-day plans (Groq, Llama 3.x)
- Daily and weekly nutrition summary
- Light/dark theme
- Local-first storage with JSON export/import as backup

## Stack

- **Frontend:** Vue 3 + Vite, Pinia (with `pinia-plugin-persistedstate`), Tailwind CSS
- **Backend:** Cloudflare Pages Functions
- **LLM:** Groq API (free tier, very fast)
- **Auth:** Cloudflare Access (zero-config, free up to 50 users)
- **Hosting:** Cloudflare Pages

## Running locally

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`. Note that `/api/generate-meal-plan`
only works once deployed to Cloudflare Pages, since it relies on the
`GROQ_API_KEY` environment variable. To test the function locally you can use
[Wrangler](https://developers.cloudflare.com/workers/wrangler/):

```bash
npx wrangler pages dev -- npm run dev
```

…and put your key in a `.dev.vars` file:

```
GROQ_API_KEY=gsk_xxx
```

`.dev.vars` is gitignored.

## Deploying to Cloudflare Pages

1. Push the repo to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages →
   Connect to Git** and pick the repo.
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. After the first build, go to **Settings → Environment variables** and add
   `GROQ_API_KEY` (production + preview) as a **secret**. Get the key from
   [console.groq.com](https://console.groq.com/keys).
5. Redeploy so the new env var is picked up.

That's it. The site will be live at `https://<project>.pages.dev`.

## Locking the site behind a login (Cloudflare Access)

Out of the box the site is public. To restrict access:

1. In the Cloudflare dashboard, go to **Zero Trust → Access → Applications →
   Add an application → Self-hosted**.
2. Application domain: your `*.pages.dev` URL (or your custom domain).
3. Add an Access policy:
   - **Action:** Allow
   - **Include:** Emails → list the addresses you want to give access to
4. Pick a login method. The simplest is **One-time PIN**, which emails a code
   each time. Google and GitHub also work without any extra setup.

Now the whole site (including `/api/generate-meal-plan`) is protected: anyone
hitting it gets bounced to the Access login screen first.

The free Zero Trust plan gives you up to 50 users.

## Project layout

```
functions/
  api/
    generate-meal-plan.js   # Pages Function: proxy to Groq
src/
  components/               # Vue components grouped by feature
  composables/              # Reusable hooks (theme, week navigation)
  services/openai.js        # Client side wrapper for the proxy
  stores/dietStore.js       # Pinia store, persisted to localStorage
  utils/                    # Date / nutrition / defaults helpers
  views/                    # Routed pages
```

## Roadmap / ideas

- Multi-device sync (would mean moving off localStorage to D1)
- Shopping list generation from a week's plan
- Recipe search / favourites library
- Undo/redo
- Tests (Playwright is already a dev dep)
