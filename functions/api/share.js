// Creates a temporary public share of a week plan by storing it in D1
// with a random key. The shared link bypasses Access because it hits
// a separate path (/api/shared/:id) that returns the plan as JSON.

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function randomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

export async function onRequestPost({ request, env }) {
  let body
  try { body = await request.json() } catch {
    return json({ success: false, error: 'Invalid JSON.' }, 400)
  }

  if (!body.week || !body.weekRange) {
    return json({ success: false, error: 'Missing week data.' }, 400)
  }

  const id = randomId()
  const payload = JSON.stringify({
    weekRange: body.weekRange,
    week: body.week,
    sharedAt: Date.now(),
  })

  try {
    await env.DB.prepare(
      'INSERT INTO shared_plans (id, data, created_at) VALUES (?, ?, ?)',
    ).bind(id, payload, Date.now()).run()
  } catch (err) {
    // Table might not exist yet — create it
    try {
      await env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS shared_plans (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL)',
      ).run()
      await env.DB.prepare(
        'INSERT INTO shared_plans (id, data, created_at) VALUES (?, ?, ?)',
      ).bind(id, payload, Date.now()).run()
    } catch (e) {
      return json({ success: false, error: `DB error: ${e.message}` }, 500)
    }
  }

  return json({ success: true, id })
}
