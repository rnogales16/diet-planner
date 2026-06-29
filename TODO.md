# TODO / Pendientes

Cosas a medias o que hay que revisar. Apuntadas para retomar más adelante.

## Compartir semana (share)

- [ ] **`weekRange` vacío rompe el share (devuelve 400).**
  El cliente envía `weekRange: ''` en `src/components/summary/WeeklySummary.vue:36`, pero
  el servidor valida `if (!body.week || !body.weekRange)` en `functions/api/share.js` y
  rechaza un `weekRange` vacío con 400. Resultado: compartir falla siempre hasta resolverlo.
  Opciones: (a) que el cliente mande un `weekRange` real, o (b) hacer `weekRange` opcional
  en el servidor. Se dejó la validación tal cual (fuera del alcance del cambio de seguridad).

## Despliegue

- [ ] **Cambios de seguridad de `share.js` sin desplegar.** Están en el working tree (sin commitear).
  Se acumulan varios cambios para desplegar a **preview** manualmente. Recordatorio:
  `npm run build && npx wrangler pages deploy dist --project-name=diet-planner --commit-dirty=true`.
- [x] Tabla `shared_plans` (id, data, email, created_at, expires_at) ya creada en la D1 remota
  (migración idempotente). El código nuevo ya **no** la auto-crea.

## Cloudflare Access (verificación JWT)

- [ ] **Añadir las env vars de Access en el dashboard de Cloudflare** (lo hace Raúl a mano):
  Pages → **diet-planner → Settings → Environment variables**, marcando **Production** y **Preview**:
  - Valores reales en el dashboard de Cloudflare (Pages → Settings → Environment variables) y en `.dev.vars` local. No incluir aquí: el repo es público.
  ⚠️ **Sin estas variables, el fallback por cookie (`CF_Authorization`) falla en cerrado y
  devuelve 401** (la verificación de firma no puede resolver el JWKS). El path primario por
  header `Cf-Access-Authenticated-User-Email` sigue funcionando, pero en dominios custom ese
  header a veces no llega → por eso hay que ponerlas **antes** de desplegar a preview.
  En local ya están en `.dev.vars`.

## Notas de contexto

- El endpoint público de lectura del share (`functions/api/shared/[id].js`) ahora devuelve
  **410** para shares expirados y **404** solo para id inexistente. TTL = 30 días.
- Recuperación de datos de usuario: D1 Time Travel (30 días) + tabla `user_data_backups`
  (snapshots automáticos antes de cada sobrescritura).
