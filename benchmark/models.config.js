// ============================================================================
//  ⚠️  PRECIOS = PLACEHOLDERS — EDITAR ANTES DE DECIDIR NADA  ⚠️
// ----------------------------------------------------------------------------
//  Los valores `pricing` de abajo NO son reales. Los costes que calcula el
//  benchmark (coste/plan en €) son INVÁLIDOS hasta que pongas los precios
//  reales de cada proveedor.
//
//  Verifica en la página de pricing oficial de cada proveedor y edita
//  `inputPerM` / `outputPerM` (precio en la MONEDA que quieras — el informe
//  solo multiplica, no convierte divisa — por 1.000.000 de tokens).
//
//  Fuentes a comprobar:
//    - Anthropic: https://www.anthropic.com/pricing
//    - Google Gemini: https://ai.google.dev/pricing
//    - DeepSeek: https://api-docs.deepseek.com/quick_start/pricing
// ============================================================================

// Precio por 1.000.000 de tokens. EDITAR — placeholders, no reales.
export const PRICES_ARE_PLACEHOLDERS = true

// Añadir un modelo = una entrada más aquí.
//   provider: 'anthropic' | 'gemini' | 'deepseek'  (selecciona el caller)
//   model:    id exacto del modelo en la API del proveedor
//   pricing:  { inputPerM, outputPerM }  ← EDITAR con precios reales
export const MODELS = [
  {
    id: 'sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    pricing: { inputPerM: 0, outputPerM: 0 }, // EDITAR — verificar en pricing de Anthropic
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    pricing: { inputPerM: 0, outputPerM: 0 }, // EDITAR — verificar en pricing de Google
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    provider: 'gemini',
    model: 'gemini-2.5-flash-lite',
    pricing: { inputPerM: 0, outputPerM: 0 }, // EDITAR — verificar en pricing de Google
  },
  {
    id: 'deepseek-chat',
    label: 'DeepSeek Chat',
    provider: 'deepseek',
    model: 'deepseek-chat',
    pricing: { inputPerM: 0, outputPerM: 0 }, // EDITAR — verificar en pricing de DeepSeek
  },

  // Ejemplos para añadir (descomentar y ajustar):
  // { id:'gemini-3.5-flash', label:'Gemini 3.5 Flash', provider:'gemini',
  //   model:'gemini-3.5-flash', pricing:{ inputPerM:0, outputPerM:0 } },  // EDITAR
]

// Parámetros de generación compartidos por todos los modelos (mismo input
// para todos → comparación justa).
export const GEN = {
  language: 'es',
  temperature: 0.7,
  maxTokens: 32000,
  timeoutMs: 120000,
}
