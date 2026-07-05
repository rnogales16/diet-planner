# LLM benchmark (internal tool)

Compares meal-plan generation across several LLMs on the **same prompt and input**,
recording per (profile × model): the full generated plan, real input/output tokens,
computed cost, and generation latency.

It is a **local tool for evaluating models** — not a feature of the app. It does not
touch production, `/api`, Cloudflare Access or D1. It calls the LLM providers directly
with your keys and **incurs real API cost**.

## What it reuses

The production prompt builder, JSON extractor, profile sanitizer and the deterministic
macro recalculator (from `functions/api/`) — so the models get exactly the input the
real app sends, and each plan is validated the same way. The token `usage` now returned
by the Anthropic and Gemini callers is what feeds the cost figures.

## Keys required

Put these in `.dev.vars` (gitignored) at the repo root, or export them in your shell.
Only the keys for the providers you actually benchmark are needed:

```
ANTHROPIC_API_KEY=...     # Claude models
GEMINI_API_KEY=...        # Gemini models
DEEPSEEK_API_KEY=...      # DeepSeek
```

## Prices — YOU must fill them in

`models.config.js` ships with **placeholder prices (all zero)**. Computed costs are
**invalid** until you edit `pricing.inputPerM` / `pricing.outputPerM` for each model with
the real per-million-token prices from each provider's pricing page. The report shows a
red banner while prices are placeholders.

## Run

```bash
npm run bench                      # all non-skipped profiles × all models
npm run bench -- --profile=weight-loss-deficit   # a single profile
npm run bench -- --repeats=3       # average latency/cost over N runs per cell
```

Output goes to `benchmark/out/report-<timestamp>.html` (open in a browser) and a matching
`.json` with the raw numbers. The HTML has a summary table (cost/plan per model, the
headline figure) and, per profile, the models side by side with the rendered plan.

## Adding a model

Add one entry to `MODELS` in `models.config.js`:

```js
{ id:'gemini-3.5-flash', label:'Gemini 3.5 Flash', provider:'gemini',
  model:'gemini-3.5-flash', pricing:{ inputPerM:0, outputPerM:0 } }  // EDIT prices
```

- `provider: 'anthropic' | 'gemini' | 'deepseek'` selects an existing caller — config-only.
- A brand-new provider also needs a small caller module under `benchmark/providers/`
  returning `{ ok, content, usage: { input, output } }` (see `providers/deepseek.js`).

## Profiles

`profiles.js` has 4 representative profiles plus a 5th template, **`my-real-family`**,
marked `skip: true` — fill in your real profile and set `skip: false` to include it.
