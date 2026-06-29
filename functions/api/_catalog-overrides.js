// Manual corrections for Mercadona catalog entries with broken OCR data.
// Each entry overrides the per-100g macros for that product ID.
//
// Detected by sanity-checking AI-extracted nutrition against typical values
// for the food category (raw veggies < 70 kcal, plain fish < 250 kcal,
// plain yogurt < 130 kcal, etc). When in doubt, use values from USDA/BEDCA.
//
// Use this list sparingly — re-extracting the image with a better prompt
// is the proper long-term fix.

export const OVERRIDES = {
  // Verduras frescas / congeladas / preparadas
  '69730': { kcal: 23, protein: 2.9, carbs: 1.6, fat: 0.4 },   // Espinacas cortadas y lavadas
  '69414': { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },   // Tomates cherry en rama Dulcita
  '69722': { kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },   // Zanahoria rallada lavada
  '69938': { kcal: 21, protein: 1.0, carbs: 4.0, fat: 0.1 },   // Tomate rallado
  '69695': { kcal: 150, protein: 7.0, carbs: 30, fat: 0.5 },   // Ajo negro dientes pelados
  '52749': { kcal: 200, protein: 1.0, carbs: 50, fat: 0.0 },   // Cebolla caramelizada (con azúcar)
  '16005': { kcal: 28, protein: 1.0, carbs: 6.0, fat: 0.3 },   // Pimientos del piquillo enteros
  '16124': { kcal: 31, protein: 1.0, carbs: 6.5, fat: 0.4 },   // Pimientos rojos asados en tiras
  '22411': { kcal: 60, protein: 2.0, carbs: 7.0, fat: 3.0 },   // Verduras asadas
  '16022': { kcal: 21, protein: 1.0, carbs: 4.0, fat: 0.1 },   // Tomate troceado pelado
  '16041': { kcal: 21, protein: 1.0, carbs: 4.0, fat: 0.1 },   // Tomate entero pelado
  '16074': { kcal: 100, protein: 5.0, carbs: 20, fat: 0.5 },   // Tomate doble concentrado
  '16046': { kcal: 250, protein: 5.0, carbs: 20, fat: 17 },    // Tomate seco en aceite
  '61251': { kcal: 60, protein: 6.0, carbs: 5.0, fat: 0.5 },   // Ajo troceado ultracongelado
  '11617': { kcal: 70, protein: 2.5, carbs: 10, fat: 1.0 },    // Wok de verduras Hacendado ultracongelado
  '35653': { kcal: 60, protein: 1.5, carbs: 8.0, fat: 2.0 },   // Pisto de verduras Hacendado ultracongelado

  // Salsas de tomate (los "tomate frito" normales son OK; sólo arreglar los rotos)
  '17163': { kcal: 80, protein: 1.5, carbs: 12, fat: 3.0 },    // Tomate frito receta artesana (era 201)
  '17131': { kcal: 80, protein: 1.5, carbs: 12, fat: 3.0 },    // (variant 833)
  '17110': { kcal: 80, protein: 1.5, carbs: 12, fat: 3.0 },    // Tomate frito Hida (era 393)

  // Pescado y marisco
  '62145': { kcal: 121, protein: 19, carbs: 0, fat: 4.2 },     // Rodajas de emperador pequeñas ultracongeladas
  '24712': { kcal: 71, protein: 16, carbs: 0, fat: 0.7 },      // Langostino crudo ultracongelado
  '24486': { kcal: 71, protein: 16, carbs: 0, fat: 0.7 },      // Langostino crudo y pelado ultracongelado
  '60874': { kcal: 73, protein: 13, carbs: 3.0, fat: 0.5 },    // Almeja Hacendado congelada
  '24274': { kcal: 80, protein: 16, carbs: 0, fat: 1.0 },      // Sepia faraónica troceada
  '62176': { kcal: 90, protein: 19, carbs: 0, fat: 1.0 },      // Pescadilla de merluza ultracongelada
  '63144': { kcal: 200, protein: 16, carbs: 15, fat: 8.0 },    // Langostino caballitos rebozados
  '23560': { kcal: 150, protein: 12, carbs: 8.0, fat: 8.0 },   // Chipirones rellenos en aceite
  '18086': { kcal: 200, protein: 25, carbs: 0, fat: 11 },      // Atún en aceite girasol
  '18055': { kcal: 200, protein: 25, carbs: 0, fat: 11 },      // Atún claro en aceite girasol
  '18092': { kcal: 200, protein: 25, carbs: 0, fat: 11 },      // (variant)
  '18030': { kcal: 200, protein: 25, carbs: 0, fat: 11 },      // Atún en aceite oliva
  '18002': { kcal: 200, protein: 25, carbs: 0, fat: 11 },      // Atún claro aceite oliva
  '18071': { kcal: 200, protein: 25, carbs: 0, fat: 11 },      // (variant)
  '18054': { kcal: 200, protein: 25, carbs: 0, fat: 11 },      // (variant 708)
  '18018': { kcal: 116, protein: 26, carbs: 0, fat: 1.0 },     // Atún claro al natural
  '18225': { kcal: 200, protein: 24, carbs: 0, fat: 11 },      // Sardinas en aceite oliva

  // Filetes/lomos de merluza y otros pescados (OCR roto — kcal 3-4× lo real)
  '62228': { kcal: 90, protein: 19, carbs: 0, fat: 1.0 },      // Filetes de merluza del Cabo sin piel
  '62103': { kcal: 90, protein: 19, carbs: 0, fat: 1.0 },      // Porciones de merluza del Cabo sin piel
  '63151': { kcal: 200, protein: 12, carbs: 18, fat: 8.0 },    // Palitos de merluza a la romana (rebozados)
  '13628': { kcal: 200, protein: 22, carbs: 0, fat: 12 },      // Filetes de caballa en aceite oliva
  '12794': { kcal: 200, protein: 22, carbs: 0, fat: 12 },      // (variant)

  // Lácteos
  '52421': { kcal: 100, protein: 4.0, carbs: 4.0, fat: 7.0 },  // Yogur griego natural ligero
  '20584': { kcal: 95, protein: 4.0, carbs: 13, fat: 3.0 },    // Yogur natural con azúcar
  '20001': { kcal: 95, protein: 4.0, carbs: 14, fat: 1.5 },    // Yogur sabores
  '20040': { kcal: 95, protein: 4.0, carbs: 14, fat: 1.5 },    // Yogur sabor fresa
  '20041': { kcal: 95, protein: 4.0, carbs: 14, fat: 1.5 },    // Yogur sabor limón
  '20221': { kcal: 50, protein: 4.0, carbs: 5.0, fat: 1.5 },   // Yogur natural edulcorado 0% MG
  '21332': { kcal: 60, protein: 4.5, carbs: 8.0, fat: 0.4 },   // Bífidus desnatado con piña
  '20946': { kcal: 50, protein: 4.5, carbs: 5.0, fat: 0.4 },   // Bífidus desnatado natural Activia
  '10505': { kcal: 47, protein: 3.2, carbs: 4.7, fat: 1.6 },   // Leche semidesnatada Asturiana
  '10599': { kcal: 35, protein: 3.5, carbs: 5.0, fat: 0.2 },   // Leche desnatada Asturiana
  '10532': { kcal: 35, protein: 3.5, carbs: 5.0, fat: 0.2 },   // (variant)
  '15599': { kcal: 134, protein: 7.0, carbs: 10, fat: 7.6 },   // Leche evaporada
  '17174': { kcal: 200, protein: 2.0, carbs: 3.0, fat: 22 },   // Leche de coco

  // Carne / preparados
  '2689':  { kcal: 200, protein: 19, carbs: 0, fat: 14 },      // Espinazo de cerdo
  '4176':  { kcal: 180, protein: 22, carbs: 0, fat: 8 },       // Medallones solomillo cerdo marinados
  '52426': { kcal: 220, protein: 18, carbs: 5, fat: 13 },      // Alas de pollo barbacoa congeladas
  '2873':  { kcal: 250, protein: 17, carbs: 2, fat: 20 },      // Burger de vacuno
  '2622':  { kcal: 200, protein: 16, carbs: 2, fat: 14 },      // Burger de pollo
  '10467': { kcal: 200, protein: 16, carbs: 2, fat: 14 },      // Mini burgers de pollo
  '3976':  { kcal: 200, protein: 17, carbs: 5, fat: 12 },      // Burger de pavo y espinacas
  '59364': { kcal: 250, protein: 18, carbs: 1, fat: 20 },      // Cabeza de cerdo finas lonchas
  '20154': { kcal: 200, protein: 22, carbs: 2, fat: 12 },      // Sticks longaniza de pavo
  '52100': { kcal: 290, protein: 12, carbs: 5, fat: 25 },      // Paté de cerdo con finas hierbas
  '23139': { kcal: 180, protein: 16, carbs: 7, fat: 9 },       // Albóndigas de pollo
  '84676': { kcal: 280, protein: 8, carbs: 30, fat: 15 },      // Mini empanadillas de pisto
}
