// Generic per-subject fixed-window rate limit, backed by the existing
// rate_limits table (atomic INSERT ... ON CONFLICT ... RETURNING). Fails open:
// a D1 hiccup never blocks a legitimate request.
//
// NOTE: rate_limits' PK column is named `email` but is used here as a generic
// "subject" (e.g. 'ip:1.2.3.4' or 'email:a@b.com'). Bucket prefixes ('login',
// 'register') keep these rows disjoint from the generation limiter ('h','d').
// See TODO: generalize the column to `subject`.
export async function rateLimit(env, subject, prefix, { max, windowMs }) {
  try {
    const now = Date.now()
    const windowStart = Math.floor(now / windowMs) * windowMs
    const bucket = `${prefix}:${windowStart}`
    const row = await env.DB
      .prepare(`
        INSERT INTO rate_limits (email, bucket, count, window_start)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(email, bucket) DO UPDATE SET count = count + 1
        RETURNING count
      `)
      .bind(subject, bucket, windowStart)
      .first()
    const count = row?.count ?? 0
    if (count > max) {
      return { ok: false, retryAfter: Math.ceil((windowStart + windowMs - now) / 1000) }
    }
    return { ok: true }
  } catch {
    return { ok: true } // fail-open
  }
}
