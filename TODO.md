# TODO / Pendientes

Cosas a medias o que hay que revisar. Apuntadas para retomar más adelante.

## Compartir semana (share)

- [x] **`weekRange` vacío rompía el share (400).** ~~El cliente envía `weekRange: ''` en
  `src/components/summary/WeeklySummary.vue:36` y el servidor lo rechazaba.~~ Resuelto
  (Opción A): `functions/api/share.js` valida solo `if (!body.week)` y guarda
  `weekRange: body.weekRange || ''` para no romper la forma del payload. `weekRange` no se
  consume aguas abajo, así que no se cableó un valor real en el cliente.

- [x] ✅ **Vista de compartir: RESUELTA Y VALIDADA.**
  `/shared/<id>` (Function `functions/shared/[id].js`) sirve el **plan completo** como HTML de
  solo lectura: macros por plato (kcal + P/C/F/V), ingredientes con cantidades, recetas/pasos
  en `<details>` plegable, metadatos compactos (cookedWeight/tiempos/raciones) y notas; totales
  por día y de la semana; 404/410/500 legibles; `esc()` en todo string del plan. El link copiado
  apunta a `/shared/<id>` (`src/components/summary/WeeklySummary.vue:41`).
  - Bypass de `/shared/*` en Cloudflare Access **configurado**.
  - **Validado en incógnito** (sin sesión): el link muestra la vista del plan, no el login.
  Desplegado: vista base `f45e089`, enriquecida `dce9158`. Compartir funciona para extraños. ✔

## Mejoras opcionales (baja prioridad)

- [ ] **Persistir `model`/`provider` en el blob del plan para un badge en planes recargados.**
  **OPCIONAL y cosmético.** Hoy el badge "Generado con &lt;modelo&gt;" solo existe en el objeto
  de preview (`GeneratePlanPreview.vue`); al aceptar el plan, `applyGeneratedPlan` no guarda
  `model`/`provider` en el `week`, así que se pierde al recargar. La **trazabilidad real ya
  existe** en la tabla `generation_metrics` (model, provider, outcome, drift… por generación);
  el badge persistido sería **solo decorativo**.
  Tres partes ya diagnosticadas:
  1. **Persistir**: que `applyGeneratedPlan` (`src/stores/dietStore.js:388`) reciba y guarde
     `model`/`provider` en el week (p.ej. `week.generatedWith = { model, provider, at }`) — al ir
     dentro del `week` se serializa solo al blob de D1.
  2. **Renderizar**: badge en `PlannerView` leyendo `week.generatedWith` (hoy no referencia `model`).
  3. **Sin retrocompat**: los planes ya guardados no tienen el campo → el badge solo saldría en
     planes nuevos; no hay migración posible (el dato nunca se guardó).

## Prompt caching (después del benchmark, se optimiza al modelo ganador)

Ya hecho (independiente del modelo): el system prompt está reestructurado
estable-primero (`SYSTEM_STATIC` = intro + instrucciones + catálogo + recordatorio,
byte-idéntico) / variable-después (`buildSystemVariable` = idioma + tipos de comida),
y los callers devuelven `usage: { input, output, cacheRead, cacheWrite }`.

Pendiente, cuando decida Anthropic vs Gemini:
- [ ] **Anthropic — `cache_control` en bloques (`systemBlocks`)**: enviar el system como
  array `[{ text: SYSTEM_STATIC, cache_control: ephemeral }, { text: variable }]` para que
  el prefijo estable (catálogo) se cachee. Hoy `_llm.js` cachea el system entero como un
  bloque vía `cacheSystem`; falta el cableado fino por bloques.
- [ ] **Gemini — context caching**: es OTRA implementación (crear recurso `cachedContents`
  y referenciarlo por nombre en `generateContent`, con su propio TTL y mínimo de tokens).
  Solo si Gemini gana el benchmark.
- [ ] **Decisión de TTL**: ephemeral 5 min (refresca en cada lectura) vs 1 h (escritura 2×
  en vez de 1.25×). Elegir según la frecuencia real de generación observada.
- Nota de ahorro: la caché es por organización (API key), no por usuario → generaciones
  con <TTL de diferencia comparten la lectura del catálogo. Con tráfico esporádico
  (>TTL entre generaciones) cada una paga escritura fría (1.25×) y el caching puede subir
  el coste; rinde con frecuencia/escala.

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
