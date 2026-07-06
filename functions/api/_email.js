// Transactional email via Resend. In dev (no RESEND_API_KEY) the message is
// logged to the console instead of sent, so flows are testable with curl without
// spending real emails.

export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    console.log(`\n[email:dev] to=${to} · subject="${subject}"\n${text || html}\n`)
    return { ok: true, dev: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'Nutriplania <noreply@nutriplania.com>',
        to,
        subject,
        html,
        text,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: `Email send failed: ${err.message}` }
  }
}

export function verificationEmail(link) {
  return {
    subject: 'Verifica tu email · Nutriplania',
    text: `Confirma tu email para empezar a generar planes en Nutriplania:\n\n${link}\n\nEl enlace caduca en 24 horas. Si no te registraste, ignora este correo.`,
    html: `<p>Confirma tu email para empezar a generar planes en Nutriplania:</p>
<p><a href="${link}">Verificar mi email</a></p>
<p style="color:#6b7280;font-size:14px">El enlace caduca en 24 horas. Si no te registraste, ignora este correo.</p>`,
  }
}

export function resetEmail(link) {
  return {
    subject: 'Restablece tu contraseña · Nutriplania',
    text: `Has pedido restablecer tu contraseña de Nutriplania:\n\n${link}\n\nEl enlace caduca en 1 hora. Si no lo pediste, ignora este correo — tu contraseña no cambia.`,
    html: `<p>Has pedido restablecer tu contraseña de Nutriplania:</p>
<p><a href="${link}">Cambiar mi contraseña</a></p>
<p style="color:#6b7280;font-size:14px">El enlace caduca en 1 hora. Si no lo pediste, ignora este correo — tu contraseña no cambia.</p>`,
  }
}
