# TODO / Pendientes

Cosas a medias o que hay que revisar. Apuntadas para retomar más adelante.

## Compartir semana (share)

- [x] **`weekRange` vacío rompía el share (400).** ~~El cliente envía `weekRange: ''` en
  `src/components/summary/WeeklySummary.vue:36` y el servidor lo rechazaba.~~ Resuelto
  (Opción A): `functions/api/share.js` valida solo `if (!body.week)` y guarda
  `weekRange: body.weekRange || ''` para no romper la forma del payload. `weekRange` no se
  consume aguas abajo, así que no se cableó un valor real en el cliente.

- [ ] 🚩 **La función de compartir NO cumple su propósito de cara al usuario.**
  El link que se copia apunta a `/api/shared/<id>` (`src/components/summary/WeeklySummary.vue:41`),
  que es el endpoint API `functions/api/shared/[id].js` y devuelve **JSON crudo**
  (`{ success, weekRange, week, sharedAt }`). **No existe ninguna ruta ni vista de frontend
  que renderice el plan compartido** (verificado: nada en `src/router/` ni `src/views/`
  consume `/api/shared`). Resultado: hoy quien abre un link compartido ve un volcado de JSON,
  no un plan legible. Pendiente: construir una vista pública (p.ej. ruta `/shared/:id` que
  haga fetch a `/api/shared/:id` y pinte el plan), y que el link copiado apunte a esa vista
  en lugar de al endpoint API. Mientras tanto, compartir "funciona" técnicamente (crea y sirve
  el share) pero es inservible para un humano.

## Despliegue

- [x] **Cambios de seguridad de `share.js` desplegados a producción** (deployment `b3f61d9`).
  Incluye auth obligatoria, TTL, límite de tamaño, randomId sin sesgo, verificación JWT de
  Access y métricas de generación. Despliegue por direct upload:
  `npm run build && npx wrangler pages deploy dist --project-name=diet-planner --branch main`.
- [x] Tabla `shared_plans` (id, data, email, created_at, expires_at) ya creada en la D1 remota
  (migración idempotente). El código nuevo ya **no** la auto-crea.
- Recordatorio: los commits locales **no están en GitHub** (no se hace push; el deploy es direct
  upload). Sincronizar `origin/main` solo si se pide explícitamente.

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
