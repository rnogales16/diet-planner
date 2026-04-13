// Public endpoint — serves a shared plan by id WITHOUT requiring Access auth.
// This path needs to be excluded from the Cloudflare Access policy.

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function onRequestGet({ params, env }) {
  const id = params.id
  if (!id || id.length > 20) return json({ success: false, error: 'Invalid id.' }, 400)

  let row
  try {
    row = await env.DB.prepare('SELECT data FROM shared_plans WHERE id = ?').bind(id).first()
  } catch {
    return json({ success: false, error: 'Not found.' }, 404)
  }

  if (!row) return json({ success: false, error: 'Not found.' }, 404)

  let parsed
  try { parsed = JSON.parse(row.data) } catch {
    return json({ success: false, error: 'Corrupted data.' }, 500)
  }

  return json({ success: true, ...parsed })
}
