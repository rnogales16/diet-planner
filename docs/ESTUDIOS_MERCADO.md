# Estudios de mercado — insumo para features de Fase 3

> Documento de referencia. NO es código. Contiene dos estudios que alimentan
> features futuras: (1) recomendaciones de supermercado en la lista de compra,
> y (2) límites de presupuesto para la generación de dietas.
>
> Todos los datos provienen de fuentes citables (principalmente OCU) y llevan
> fecha, porque caducan. Revisar anualmente antes de usar en producción.
>
> Última actualización de datos: julio 2026 (fuentes 2024–2026).

---

## Estudio 1 — Recomendaciones de supermercado por categoría

### Objetivo de la feature

En la lista de la compra (tier premium), mostrar al usuario en qué supermercado
está mejor valorada cada categoría de producto, para que decida dónde comprar
cada cosa. Es **contenido curado**, no una llamada al LLM: se hardcodea una
tabla y se muestra junto a la lista.

### Regla legal / de presentación (IMPORTANTE)

Una recomendación sobre marcas comerciales ("compra el pescado en X") es una
afirmación pública sobre empresas. Para no exponer el negocio:

- **Siempre citar la fuente**: presentar como *"Según los estudios de calidad de
  la OCU, [categoría] está mejor valorada en [cadena]"*, nunca como afirmación
  propia sin respaldo.
- **Nunca inventar** datos de calidad. Si no hay dato citable de una cadena
  (p. ej. supermercados de Andorra), presentar como "referencia España/Cataluña"
  o dejar el hueco, no rellenarlo con suposiciones.
- La fuente usada aquí es la **OCU** (Organización de Consumidores y Usuarios),
  independiente y creíble. Encuestas de satisfacción 2025–2026.

### Contexto de mercado (ventaja para Cataluña/Andorra)

- 7 de las 10 cadenas mejor valoradas por OCU son **regionales**.
- Las cadenas **catalanas** dominan en calidad de fresco (Ametller Origen,
  Plus Fresc, Esclat). Como el público objetivo es catalán/andorrano, la
  recomendación es relevante y local, no genérica.

### Datos por categoría (puntuación OCU sobre 100)

| Categoría | Media sector | Cadenas mejor valoradas | Notas |
|---|---|---|---|
| **Carne** | 76/100 (el fresco mejor valorado) | Hipercor, El Corte Inglés, Costco, **Plus Fresc** (catalana); Ametller Origen alto | La mitad de consumidores aún prefiere carnicería. Recomendación honesta: incluir "o tu carnicería de confianza". |
| **Pescado** | 72/100 | El Corte Inglés, Costco, Hipercor, **Plus Fresc**. En estudio específico de pescado fresco: **Costco 93/100**, **Esclat 88/100** (catalana) | OCU **desaconseja** pescado en Aldi, Lidl y Covirán. Muchos prefieren pescadería. |
| **Fruta y verdura** | 69/100 (la más baja de frescos) | Solo 4 superan 80: **Ametller Origen**, Costco, El Corte Inglés, Hipercor | Ametller Origen destaca especialmente aquí (es su fuerte). |
| **Pan fresco** | 63/100 (peor valorado) | Unide, Esclat, El Corte Inglés | Ninguna supera 80. Mi Alcampo no llega a 50. La mayoría prefiere panadería/tahona. |

### Avisos para NO recomendar

- **BonÀrea**: buena en carne, pero de las **peor valoradas en fruta/verdura**
  (28 puntos por debajo de la media). No recomendar para vegetales.
- **Aldi, Lidl, Covirán**: OCU desaconseja pescado.
- **Mi Alcampo**: pan muy mal valorado (<50).

### Eje económico (para recomendación por precio)

- Más baratos según OCU: **Supermercados Dani** (el más barato, pero solo
  Andalucía), **Alcampo** (nacional más barato), Lidl/Aldi en su zona.
- **Mercadona**: 71/100 satisfacción general. No destaca en calidad de fresco,
  pero es el súper habitual de ~1 de cada 3 españoles por cercanía y
  precio-conveniencia. Es el catálogo base actual de la app.

### Hueco pendiente (rellenar con datos locales)

- Andorra tiene cadenas propias; la OCU es española. Para usuarios de Andorra:
  o adaptar con datos locales (que NO tenemos aquí), o presentar la
  recomendación etiquetada como "referencia España/Cataluña". **No inventar
  datos de calidad de supermercados andorranos.**

---

## Estudio 2 — Coste de comida por rangos (límites de presupuesto)

### Objetivo de la feature

Permitir generar dietas con un presupuesto semanal, pero con límites de
coherencia hardcodeados: si el presupuesto es inviable (p. ej. 3 personas con
20€/semana), la app responde **sin llamar al LLM** que no es posible y cuánto
haría falta. Ahorra la petición de pago.

### Datos base (España, 2025–2026)

- **Gasto mínimo realista por persona/mes** (cocina en casa, básico, sin
  premium/ecológico): **200–300€/mes** (~210–250€ es la cifra típica).
- **Gasto medio real por hogar**: 421€/mes en 2024 (incluye hogares de varios
  miembros).
- **Por persona/semana** (la unidad de la feature): **40–60€** una compra
  semanal para una persona. El extremo económico realista (Lidl, ofertas,
  legumbres, sin desperdicio): **~35–40€/persona/semana**. Por debajo ya es
  dieta de subsistencia poco variada.

### Dato clave: economías de escala (para validación multi-persona)

El gasto **NO se multiplica por el número de personas.** Comprar para varios
abarata el precio por ración (envases familiares, aprovechamiento). "3 personas"
cuesta **menos por cabeza** que 1. PERO hay un **suelo por persona** por debajo
del cual no se puede comer variado y equilibrado.

### Validación del ejemplo problemático

- 3 personas, 20€/semana = 6,7€/persona/semana ≈ **0,95€/día → INVIABLE.**
- Muy por debajo del suelo realista (~35€/persona/semana).
- (Referencia extrema: ~0,50€/ración cocinando solo legumbres, pero eso es UNA
  comida, no una dieta completa equilibrada con proteína/fruta/variedad.)

### Umbrales propuestos (hardcodear — PUNTO DE PARTIDA, ajustar)

Lógica: **coste mínimo viable por persona/semana según nivel calórico** (más
calorías = más comida = más coste; la proteína encarece).

| Nivel | Calorías/persona/día | Mínimo viable €/persona/semana |
|---|---|---|
| Básica | ~1500–2000 kcal | ~30–35€ |
| Estándar | ~2000–2500 kcal | ~35–45€ |
| Alta proteína / deportista | ~2500–3500 kcal | ~50–65€ (la proteína de calidad es el driver de coste) |

### Lógica de validación (pseudocódigo)

```
presupuestoPorPersona = presupuestoSemanal / numeroPersonas
umbral = umbralPara(nivelCalorico)   // de la tabla de arriba
si presupuestoPorPersona < umbral:
    rechazar SIN llamar al LLM
    mensaje: "Con {presupuesto}€ para {personas} persona(s) no es posible
              generar una dieta equilibrada. Necesitas al menos
              {umbral * numeroPersonas}€."
si no:
    proceder con la generación (pasar presupuesto al prompt + validar el plan
    generado contra el presupuesto con el recalculador, igual que se validan
    las macros)
```

### Riesgo ignorado / avisos

1. **Datos de España nacional.** Andorra tiene otro nivel de precios (algunos
   productos más baratos por fiscalidad, otros más caros por importación). Si el
   público es andorrano, los umbrales necesitan ajuste local **que no tenemos
   datos para hacer aquí**. No extrapolar sin datos.
2. **Caducidad.** La inflación alimentaria ha sido fuerte (cesta OCU +37% desde
   2021). Estos umbrales caducan. **Revisar anualmente** o quedarán cortos en un
   par de años y se rechazarán presupuestos que sí son viables.
3. **La validación de presupuesto reutiliza el patrón existente**: igual que hoy
   el recalculador valida macros contra el catálogo, aquí valida el coste del
   plan generado contra el presupuesto (los precios ya están en el catálogo
   Mercadona). No es arquitectura nueva, es el mismo "LLM propone, código
   verifica" aplicado a euros.

---

## Fuentes

- OCU — Encuesta satisfacción supermercados 2026 (24.000 experiencias, 7.600
  consumidores, 48 cadenas).
- OCU — Encuesta alimentos frescos 2025/2026 (carne 76, pescado 72, fruta/verdura
  69, pan 63 sobre 100).
- OCU — Estudio específico pescado fresco (Costco 93, Esclat 88).
- OCU — Estudio fruta/verdura (BonÀrea peor valorada, -28 sobre media).
- INE — Encuesta de presupuestos familiares (gasto medio hogar ~421€/mes 2024).
- Estimaciones coste de vida España 2025–2026 (compra semanal persona 40–60€).

*Datos recopilados julio 2026. Verificar vigencia antes de usar en producción.*
