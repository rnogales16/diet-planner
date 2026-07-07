// Nutrition consultant chat. Helps the user determine their ideal caloric
// intake and macro split based on their vitals, goals and lifestyle.
// Can return a structured macros suggestion that the client can apply
// directly to the user's profile.

import { callGeminiWithFallback } from './_gemini.js'
import { resolveUser } from './_user.js'

const MODEL_CASCADE = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']

const LANGUAGE_NAMES = { en: 'English', es: 'Spanish (español)' }
const SUPPORTED_LANGS = new Set(['en', 'es'])
const MAX_HISTORY = 20

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildSystemPrompt(language) {
  const langName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en
  return `You are a professional sports nutritionist and dietitian. The user wants to determine their ideal daily calorie intake and macronutrient split. Your job is to guide them through a friendly, conversational assessment.

LANGUAGE: Always reply in ${langName}.

## How the conversation should flow

1. **Gather information** — Ask about: sex, age, weight (kg), height (cm), activity level (sedentary / light / moderate / active / very active), primary goal (lose fat, gain muscle, maintain, general health), any relevant medical conditions, and training routine if applicable. You can ask several things at once to avoid too many back-and-forth turns, but keep it natural.
2. **Calculate** — Use the Mifflin-St Jeor equation for BMR, then apply the appropriate activity multiplier for TDEE. Adjust for the user's goal:
   - Fat loss: −15% to −25% deficit depending on urgency and body composition.
   - Muscle gain: +10% to +20% surplus.
   - Maintain: TDEE as-is.
3. **Propose macros** — Suggest a daily target for calories, protein (g), carbs (g), fat (g), and vegetables (g). Explain your reasoning briefly. Protein should typically be 1.6–2.2 g/kg for active people, 1.2–1.6 g/kg for sedentary. Vegetables around 400–600g/day.
4. **Refine** — If the user disagrees or wants adjustments, iterate. When both sides are happy, output the final macros.

## Output format

Your output is ALWAYS a single JSON object:
{
  "reply": "string — your message to the user",
  "suggestedMacros": null OR {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "vegetables": number
  }
}

Rules:
- Set "suggestedMacros" to null while you're still gathering info or the user hasn't confirmed.
- Set "suggestedMacros" to the final values ONLY when you've calculated them and presented them to the user. Include them every time you show a recommendation, so the user can apply them.
- Keep "reply" conversational, warm, and concise. Use short paragraphs. You can use **bold** for key numbers.
- When presenting macros, always show: calories, protein, carbs, fat, and vegetables in grams.
- Verify that protein×4 + carbs×4 + fat×9 ≈ calories (within 5%). If not, adjust.
- Output ONLY the JSON object. No markdown fences, no commentary outside.
- If the user asks something outside nutrition scope, answer briefly if you can, but steer back.
- Do NOT invent information about the user. Only use what they tell you.`
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string')
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 4000) }] }))
}

function extractJson(text) {
  try { return JSON.parse(text) } catch { /* */ }
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (m) {
    try { return JSON.parse(m[1].trim()) } catch { /* */ }
  }
  const a = text.indexOf('{')
  const b = text.lastIndexOf('}')
  if (a !== -1 && b > a) {
    try { return JSON.parse(text.slice(a, b + 1)) } catch { /* */ }
  }
  return null
}

export async function onRequestPost({ request, env }) {
  const auth = await resolveUser(request, env)
  if (!auth) return json({ success: false, error: 'Not authenticated.' }, 401)

  let body
  try { body = await request.json() } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  const message = (body.message || '').trim().slice(0, 2000)
  if (!message) return json({ success: false, error: 'Missing message.' }, 400)

  const language = SUPPORTED_LANGS.has(body.language) ? body.language : 'en'
  const systemPrompt = buildSystemPrompt(language)
  const history = sanitizeHistory(body.history)

  // Build profile context so the AI knows existing settings
  const profile = body.profile || {}
  const profileLines = []
  if (profile.calorieTarget) profileLines.push(`Current calorie target: ${profile.calorieTarget}`)
  if (profile.proteinTarget) profileLines.push(`Current protein target: ${profile.proteinTarget}g`)
  if (profile.carbsTarget) profileLines.push(`Current carbs target: ${profile.carbsTarget}g`)
  if (profile.fatTarget) profileLines.push(`Current fat target: ${profile.fatTarget}g`)
  if (profile.vegetableTarget) profileLines.push(`Current vegetable target: ${profile.vegetableTarget}g`)
  if (profile.goals?.length) profileLines.push(`Goals: ${profile.goals.join(', ')}`)
  if (profile.dietaryStyle) profileLines.push(`Dietary style: ${profile.dietaryStyle}`)

  const contextMsg = profileLines.length
    ? `The user's current profile settings:\n${profileLines.join('\n')}\n\nThis is just context — the user may want to change these.`
    : 'The user has no profile configured yet.'

  const contents = [
    { role: 'user', parts: [{ text: contextMsg }] },
    { role: 'model', parts: [{ text: '{"reply":"Ready to help.","suggestedMacros":null}' }] },
    ...history,
    { role: 'user', parts: [{ text: message }] },
  ]

  const result = await callGeminiWithFallback({
    env,
    models: MODEL_CASCADE,
    payload: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.6,
        topP: 0.9,
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
      },
    },
  })

  if (!result.ok) {
    if (result.status === 429) return json({ success: false, error: 'AI quota exhausted. Try again in a minute.' }, 429)
    return json({ success: false, error: `AI error: ${result.error}` }, 502)
  }

  const parsed = extractJson(result.content)
  if (!parsed || typeof parsed.reply !== 'string') {
    return json({ success: false, error: 'Failed to parse AI response.' }, 502)
  }

  // Sanitize suggested macros
  let suggestedMacros = null
  if (parsed.suggestedMacros && typeof parsed.suggestedMacros === 'object') {
    const m = parsed.suggestedMacros
    suggestedMacros = {
      calories: Math.max(0, Math.round(Number(m.calories) || 0)),
      protein: Math.max(0, Math.round(Number(m.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(m.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(m.fat) || 0)),
      vegetables: Math.max(0, Math.round(Number(m.vegetables) || 0)),
    }
  }

  return json({ success: true, reply: parsed.reply, suggestedMacros, model: result.model })
}

export function onRequest({ request }) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405)
  return json({ success: false, error: 'Unhandled.' }, 500)
}
