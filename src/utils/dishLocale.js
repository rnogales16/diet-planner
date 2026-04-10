// Returns a dish projection with text fields swapped to the target locale.
// Falls back to the original fields when no translation is available.
//
// A dish that has not been touched by the translation pipeline simply
// behaves as before, so this is fully backwards compatible.

export function localizedDish(dish, locale) {
  if (!dish) return dish

  const originalLang = dish.originalLang || 'en'
  if (!locale || locale === originalLang) return dish

  const translation = dish.translations?.[locale]
  if (!translation) return dish

  return {
    ...dish,
    name: translation.name ?? dish.name,
    notes: translation.notes ?? dish.notes,
    ingredients: Array.isArray(translation.ingredients) && translation.ingredients.length
      ? translation.ingredients
      : dish.ingredients,
    instructions: Array.isArray(translation.instructions) && translation.instructions.length
      ? translation.instructions
      : dish.instructions,
  }
}

// Returns true when the given dish has no translation for the requested locale
// AND the locale is different from the original. Used to surface a "translate"
// hint to the user.
export function dishNeedsTranslation(dish, locale) {
  if (!dish) return false
  const originalLang = dish.originalLang || 'en'
  if (locale === originalLang) return false
  return !dish.translations?.[locale]
}
