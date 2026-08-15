// ============================================================
// IterUp - Import alimenti base da USDA FoodData Central
// ------------------------------------------------------------
// Come si usa:
//   1. node --version  (serve Node.js 18+, ha fetch nativo)
//   2. export USDA_API_KEY="la_tua_chiave_qui"
//   3. node import-foods.mjs
//   4. Apri il file "iterup_foods_seed.sql" generato e incollalo
//      nell'SQL Editor di Supabase (Run)
// ============================================================

const API_KEY = process.env.USDA_API_KEY;
if (!API_KEY) {
  console.error("Manca USDA_API_KEY. Esegui: export USDA_API_KEY=xxxxx");
  process.exit(1);
}

// Lista curata base mediterranea/italiana (~180 alimenti).
// query = termine di ricerca su USDA (in inglese, il DB è americano)
// name_it = nome che vedrai nell'app
// category = raggruppamento per l'UI
const FOODS = [
  // --- PROTEINE ANIMALI ---
  { q: "chicken breast raw", name: "Petto di pollo", cat: "proteine" },
  { q: "chicken thigh raw", name: "Coscia di pollo", cat: "proteine" },
  { q: "turkey breast raw", name: "Petto di tacchino", cat: "proteine" },
  { q: "beef ground 90% lean raw", name: "Manzo macinato magro", cat: "proteine" },
  { q: "beef sirloin raw", name: "Manzo (scamone)", cat: "proteine" },
  { q: "pork loin raw", name: "Lonza di maiale", cat: "proteine" },
  { q: "salmon atlantic raw", name: "Salmone", cat: "proteine" },
  { q: "tuna raw", name: "Tonno fresco", cat: "proteine" },
  { q: "tuna canned in water", name: "Tonno in scatola (al naturale)", cat: "proteine" },
  { q: "cod raw", name: "Merluzzo", cat: "proteine" },
  { q: "shrimp raw", name: "Gamberi", cat: "proteine" },
  { q: "egg whole raw", name: "Uovo intero", cat: "proteine" },
  { q: "egg white raw", name: "Albume d'uovo", cat: "proteine" },
  { q: "prosciutto crudo", name: "Prosciutto crudo", cat: "proteine" },
  { q: "ham cooked", name: "Prosciutto cotto", cat: "proteine" },
  { q: "bresaola", name: "Bresaola", cat: "proteine" },

  // --- PROTEINE VEGETALI / LEGUMI ---
  { q: "tofu firm raw", name: "Tofu", cat: "legumi" },
  { q: "tempeh", name: "Tempeh", cat: "legumi" },
  { q: "lentils cooked", name: "Lenticchie (cotte)", cat: "legumi" },
  { q: "chickpeas cooked", name: "Ceci (cotti)", cat: "legumi" },
  { q: "kidney beans cooked", name: "Fagioli borlotti (cotti)", cat: "legumi" },
  { q: "black beans cooked", name: "Fagioli neri (cotti)", cat: "legumi" },
  { q: "cannellini beans cooked", name: "Fagioli cannellini (cotti)", cat: "legumi" },
  { q: "edamame cooked", name: "Edamame", cat: "legumi" },
  { q: "peas green cooked", name: "Piselli (cotti)", cat: "legumi" },

  // --- CARBOIDRATI ---
  { q: "pasta dry raw", name: "Pasta di semola (cruda)", cat: "carboidrati" },
  { q: "pasta whole wheat raw", name: "Pasta integrale (cruda)", cat: "carboidrati" },
  { q: "rice white raw", name: "Riso bianco (crudo)", cat: "carboidrati" },
  { q: "rice brown raw", name: "Riso integrale (crudo)", cat: "carboidrati" },
  { q: "rice basmati raw", name: "Riso basmati (crudo)", cat: "carboidrati" },
  { q: "bread white", name: "Pane bianco", cat: "carboidrati" },
  { q: "bread whole wheat", name: "Pane integrale", cat: "carboidrati" },
  { q: "bread rye", name: "Pane di segale", cat: "carboidrati" },
  { q: "potato raw", name: "Patate", cat: "carboidrati" },
  { q: "sweet potato raw", name: "Patate dolci", cat: "carboidrati" },
  { q: "oats rolled dry", name: "Fiocchi d'avena", cat: "carboidrati" },
  { q: "quinoa raw", name: "Quinoa (cruda)", cat: "carboidrati" },
  { q: "couscous raw", name: "Cous cous (crudo)", cat: "carboidrati" },
  { q: "cornmeal yellow degermed", name: "Polenta (farina di mais)", cat: "carboidrati" },
  { q: "crackers whole wheat", name: "Crackers integrali", cat: "carboidrati" },
  { q: "rice cakes", name: "Gallette di riso", cat: "carboidrati" },

  // --- VERDURE ---
  { q: "spinach raw", name: "Spinaci", cat: "verdure" },
  { q: "broccoli raw", name: "Broccoli", cat: "verdure" },
  { q: "zucchini raw", name: "Zucchine", cat: "verdure" },
  { q: "tomato raw", name: "Pomodori", cat: "verdure" },
  { q: "cherry tomatoes raw", name: "Pomodorini", cat: "verdure" },
  { q: "carrot raw", name: "Carote", cat: "verdure" },
  { q: "bell pepper raw", name: "Peperoni", cat: "verdure" },
  { q: "eggplant raw", name: "Melanzane", cat: "verdure" },
  { q: "lettuce romaine raw", name: "Lattuga", cat: "verdure" },
  { q: "arugula raw", name: "Rucola", cat: "verdure" },
  { q: "cucumber raw", name: "Cetrioli", cat: "verdure" },
  { q: "onion raw", name: "Cipolle", cat: "verdure" },
  { q: "garlic raw", name: "Aglio", cat: "verdure" },
  { q: "mushrooms raw", name: "Funghi champignon", cat: "verdure" },
  { q: "cauliflower raw", name: "Cavolfiore", cat: "verdure" },
  { q: "green beans raw", name: "Fagiolini", cat: "verdure" },
  { q: "asparagus raw", name: "Asparagi", cat: "verdure" },
  { q: "cabbage raw", name: "Cavolo", cat: "verdure" },
  { q: "artichoke raw", name: "Carciofi", cat: "verdure" },
  { q: "fennel raw", name: "Finocchi", cat: "verdure" },
  { q: "celery raw", name: "Sedano", cat: "verdure" },
  { q: "pumpkin raw", name: "Zucca", cat: "verdure" },

  // --- FRUTTA ---
  { q: "banana raw", name: "Banana", cat: "frutta" },
  { q: "apple raw", name: "Mela", cat: "frutta" },
  { q: "orange raw", name: "Arancia", cat: "frutta" },
  { q: "strawberries raw", name: "Fragole", cat: "frutta" },
  { q: "blueberries raw", name: "Mirtilli", cat: "frutta" },
  { q: "kiwi raw", name: "Kiwi", cat: "frutta" },
  { q: "pear raw", name: "Pera", cat: "frutta" },
  { q: "grapes raw", name: "Uva", cat: "frutta" },
  { q: "pineapple raw", name: "Ananas", cat: "frutta" },
  { q: "watermelon raw", name: "Anguria", cat: "frutta" },
  { q: "melon cantaloupe raw", name: "Melone", cat: "frutta" },
  { q: "peach raw", name: "Pesca", cat: "frutta" },
  { q: "apricot raw", name: "Albicocca", cat: "frutta" },
  { q: "avocado raw", name: "Avocado", cat: "frutta" },
  { q: "lemon raw", name: "Limone", cat: "frutta" },
  { q: "fig raw", name: "Fichi", cat: "frutta" },
  { q: "raisins", name: "Uvetta", cat: "frutta" },
  { q: "dates dried", name: "Datteri", cat: "frutta" },

  // --- LATTICINI E UOVA ---
  { q: "milk whole", name: "Latte intero", cat: "latticini" },
  { q: "milk skim", name: "Latte scremato", cat: "latticini" },
  { q: "greek yogurt plain nonfat", name: "Yogurt greco (0%)", cat: "latticini" },
  { q: "yogurt plain whole milk", name: "Yogurt intero", cat: "latticini" },
  { q: "mozzarella cheese", name: "Mozzarella", cat: "latticini" },
  { q: "parmesan cheese", name: "Parmigiano", cat: "latticini" },
  { q: "ricotta cheese", name: "Ricotta", cat: "latticini" },
  { q: "cottage cheese", name: "Cottage cheese (fiocchi di latte)", cat: "latticini" },
  { q: "feta cheese", name: "Feta", cat: "latticini" },
  { q: "provolone cheese", name: "Provolone", cat: "latticini" },
  { q: "mascarpone cheese", name: "Mascarpone", cat: "latticini" },

  // --- GRASSI, OLI, FRUTTA SECCA ---
  { q: "olive oil", name: "Olio extravergine d'oliva", cat: "grassi" },
  { q: "butter", name: "Burro", cat: "grassi" },
  { q: "almonds raw", name: "Mandorle", cat: "grassi" },
  { q: "walnuts raw", name: "Noci", cat: "grassi" },
  { q: "pistachios raw", name: "Pistacchi", cat: "grassi" },
  { q: "hazelnuts raw", name: "Nocciole", cat: "grassi" },
  { q: "peanuts raw", name: "Arachidi", cat: "grassi" },
  { q: "peanut butter", name: "Burro d'arachidi", cat: "grassi" },
  { q: "sunflower seeds", name: "Semi di girasole", cat: "grassi" },
  { q: "chia seeds", name: "Semi di chia", cat: "grassi" },
  { q: "flaxseed", name: "Semi di lino", cat: "grassi" },
  { q: "olives", name: "Olive", cat: "grassi" },

  // --- CONDIMENTI / VARIE ---
  { q: "honey", name: "Miele", cat: "condimenti" },
  { q: "balsamic vinegar", name: "Aceto balsamico", cat: "condimenti" },
  { q: "tomato sauce canned", name: "Passata di pomodoro", cat: "condimenti" },
  { q: "dark chocolate 70%", name: "Cioccolato fondente 70%", cat: "condimenti" },
  { q: "protein powder whey", name: "Proteine whey (polvere)", cat: "condimenti" },

  // --- PROTEINE ANIMALI (extra) ---
  { q: "sausage pork raw", name: "Salsiccia di maiale", cat: "proteine" },
  { q: "beef steak raw", name: "Bistecca di manzo", cat: "proteine" },
  { q: "duck breast raw", name: "Petto d'anatra", cat: "proteine" },
  { q: "rabbit meat raw", name: "Coniglio", cat: "proteine" },
  { q: "sardines canned in oil", name: "Sardine (in scatola)", cat: "proteine" },
  { q: "anchovies raw", name: "Acciughe", cat: "proteine" },
  { q: "mussels raw", name: "Cozze", cat: "proteine" },
  { q: "mackerel raw", name: "Sgombro", cat: "proteine" },
  { q: "speck", name: "Speck", cat: "proteine" },
  { q: "veal cutlet raw", name: "Vitello", cat: "proteine" },
  { q: "lamb leg raw", name: "Agnello", cat: "proteine" },

  // --- LEGUMI (extra) ---
  { q: "soybeans cooked", name: "Semi di soia (cotti)", cat: "legumi" },
  { q: "split peas cooked", name: "Piselli spezzati (cotti)", cat: "legumi" },
  { q: "fava beans cooked", name: "Fave (cotte)", cat: "legumi" },
  { q: "lupini beans", name: "Lupini", cat: "legumi" },
  { q: "mung beans cooked", name: "Fagioli mung (cotti)", cat: "legumi" },

  // --- CARBOIDRATI (extra) ---
  { q: "farro raw", name: "Farro (crudo)", cat: "carboidrati" },
  { q: "barley pearled raw", name: "Orzo perlato (crudo)", cat: "carboidrati" },
  { q: "buckwheat raw", name: "Grano saraceno (crudo)", cat: "carboidrati" },
  { q: "tortilla wheat flour", name: "Tortilla di frumento", cat: "carboidrati" },
  { q: "breadsticks", name: "Grissini", cat: "carboidrati" },
  { q: "cornflakes", name: "Fiocchi di mais (cornflakes)", cat: "carboidrati" },
  { q: "muesli", name: "Muesli", cat: "carboidrati" },
  { q: "pretzels", name: "Pretzel", cat: "carboidrati" },
  { q: "rye crispbread", name: "Fette croccanti di segale", cat: "carboidrati" },
  { q: "semolina flour", name: "Semolino", cat: "carboidrati" },

  // --- VERDURE (extra) ---
  { q: "radicchio raw", name: "Radicchio", cat: "verdure" },
  { q: "swiss chard raw", name: "Bietola", cat: "verdure" },
  { q: "turnip greens raw", name: "Cime di rapa", cat: "verdure" },
  { q: "savoy cabbage raw", name: "Verza", cat: "verdure" },
  { q: "kale raw", name: "Cavolo nero", cat: "verdure" },
  { q: "leek raw", name: "Porri", cat: "verdure" },
  { q: "radish raw", name: "Ravanelli", cat: "verdure" },
  { q: "beetroot raw", name: "Barbabietola", cat: "verdure" },
  { q: "brussels sprouts raw", name: "Cavoletti di Bruxelles", cat: "verdure" },
  { q: "okra raw", name: "Gombo", cat: "verdure" },
  { q: "chives raw", name: "Erba cipollina", cat: "verdure" },
  { q: "parsley raw", name: "Prezzemolo", cat: "verdure" },
  { q: "scallion raw", name: "Cipollotto", cat: "verdure" },

  // --- FRUTTA (extra) ---
  { q: "pomegranate raw", name: "Melograno", cat: "frutta" },
  { q: "persimmon raw", name: "Cachi", cat: "frutta" },
  { q: "plum raw", name: "Prugna", cat: "frutta" },
  { q: "cherries raw", name: "Ciliegie", cat: "frutta" },
  { q: "mandarin raw", name: "Mandarino", cat: "frutta" },
  { q: "papaya raw", name: "Papaya", cat: "frutta" },
  { q: "mango raw", name: "Mango", cat: "frutta" },
  { q: "coconut fresh raw", name: "Cocco fresco", cat: "frutta" },
  { q: "blackberries raw", name: "More", cat: "frutta" },
  { q: "raspberries raw", name: "Lamponi", cat: "frutta" },

  // --- LATTICINI (extra) ---
  { q: "gorgonzola cheese", name: "Gorgonzola", cat: "latticini" },
  { q: "taleggio cheese", name: "Taleggio", cat: "latticini" },
  { q: "stracchino cheese", name: "Stracchino", cat: "latticini" },
  { q: "kefir plain", name: "Kefir", cat: "latticini" },
  { q: "almond milk unsweetened", name: "Latte di mandorla (senza zucchero)", cat: "latticini" },
  { q: "soy milk unsweetened", name: "Latte di soia (senza zucchero)", cat: "latticini" },

  // --- GRASSI (extra) ---
  { q: "cashews raw", name: "Anacardi", cat: "grassi" },
  { q: "macadamia nuts raw", name: "Macadamia", cat: "grassi" },
  { q: "pumpkin seeds", name: "Semi di zucca", cat: "grassi" },
  { q: "sesame seeds", name: "Semi di sesamo", cat: "grassi" },
  { q: "coconut oil", name: "Olio di cocco", cat: "grassi" },
  { q: "tahini", name: "Tahina (crema di sesamo)", cat: "grassi" },
  { q: "pine nuts raw", name: "Pinoli", cat: "grassi" },

  // --- CONDIMENTI (extra) ---
  { q: "mustard", name: "Senape", cat: "condimenti" },
  { q: "soy sauce", name: "Salsa di soia", cat: "condimenti" },
  { q: "apple cider vinegar", name: "Aceto di mele", cat: "condimenti" },
  { q: "cocoa powder unsweetened", name: "Cacao amaro in polvere", cat: "condimenti" },
  { q: "maple syrup", name: "Sciroppo d'acero", cat: "condimenti" },
  { q: "fruit jam", name: "Marmellata", cat: "condimenti" },
];

const BASE_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

// ID nutrienti ufficiali USDA (univoci, niente ambiguità di testo)
const NUTRIENT_IDS = {
  protein: 1003,
  fat: 1004,    // Total lipid (fat)
  carbs: 1005,  // Carbohydrate, by difference
  fiber: 1079,  // Fiber, total dietary
};

// L'energia a volte non è sotto l'ID standard 1008 (succede nel dataset
// Foundation Foods), ma sotto una delle due varianti "Atwater factors".
// Proviamo in ordine finché non troviamo un valore.
const ENERGY_IDS = [1008, 2047, 2048];

// Parole che segnalano un prodotto trasformato/diverso da quello cercato
// (es. "milk whole" non deve prendere latte in polvere)
const BLACKLIST = [
  "powder", "dehydrat", "dried", "infant", "baby food",
  "imitation", "substitute", "concentrate", "candied", "condensed",
];

function isBadMatch(description, query) {
  const d = description.toLowerCase();
  const q = query.toLowerCase();
  // parola sospetta nella descrizione ma non richiesta nella query
  if (BLACKLIST.some((bad) => d.includes(bad) && !q.includes(bad))) return true;
  // stato cotto/crudo opposto a quanto cercato (cambia i macro per 100g)
  if (q.includes("raw") && d.includes("cooked")) return true;
  if (q.includes("cooked") && d.includes("raw")) return true;
  // marchi commerciali: parole tutte maiuscole di almeno 3 lettere (es. "QUAKER")
  if (/\b[A-Z]{3,}\b/.test(description)) return true;
  return false;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

async function fetchFood(item) {
  const url = `${BASE_URL}?query=${encodeURIComponent(item.q)}&dataType=Foundation,SR%20Legacy&pageSize=8&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  [ERRORE HTTP ${res.status}] ${item.name}`);
    return null;
  }
  const data = await res.json();
  const candidates = data.foods || [];
  const noCleanMatch = candidates.length > 0 && !candidates.some((f) => !isBadMatch(f.description, item.q));
  let food = candidates.find((f) => !isBadMatch(f.description, item.q));
  if (!food && candidates.length > 0) {
    // nessun candidato pulito: prendo il più corto (di solito il più generico, meno un prodotto specifico)
    food = [...candidates].sort((a, b) => a.description.length - b.description.length)[0];
  }
  if (!food) {
    console.warn(`  [NON TROVATO] ${item.name} (query: "${item.q}")`);
    return null;
  }

  const nutrients = food.foodNutrients || [];
  const getVal = (id) => {
    const n = nutrients.find((x) => x.nutrientId === id);
    return n ? n.value : 0;
  };
  const getEnergy = () => {
    for (const id of ENERGY_IDS) {
      const n = nutrients.find((x) => x.nutrientId === id);
      if (n && typeof n.value === "number") return n.value;
    }
    return 0;
  };

  const kcal = round1(getEnergy());
  const protein = round1(getVal(NUTRIENT_IDS.protein));
  const carbs = round1(getVal(NUTRIENT_IDS.carbs));
  const fat = round1(getVal(NUTRIENT_IDS.fat));
  const fiber = round1(getVal(NUTRIENT_IDS.fiber));

  // controllo di coerenza: le kcal dichiarate devono tornare +/- coi macro
  // (e se kcal è 0 ma ci sono macro, è comunque un dato mancante da segnalare)
  const computedKcal = protein * 4 + carbs * 4 + fat * 9;
  const mismatch =
    (kcal > 0 && Math.abs(computedKcal - kcal) / kcal > 0.25) ||
    (kcal === 0 && computedKcal > 5) ||
    noCleanMatch;

  return {
    name: item.name,
    cat: item.cat,
    kcal, protein, carbs, fat, fiber,
    source_id: String(food.fdcId),
    usda_description: food.description,
    mismatch,
  };
}

function sqlEscape(str) {
  return str.replace(/'/g, "''");
}

async function main() {
  const results = [];
  console.log(`Interrogo USDA per ${FOODS.length} alimenti...\n`);

  for (const item of FOODS) {
    const result = await fetchFood(item);
    if (result) {
      results.push(result);
      const flag = result.mismatch ? "  ⚠️ DA VERIFICARE" : "";
      console.log(
        `  OK: ${result.name} — ${result.kcal} kcal | P:${result.protein}g C:${result.carbs}g G:${result.fat}g F:${result.fiber}g — "${result.usda_description}"${flag}`
      );
    }
    // rispetto rate limit USDA (1000 req/ora con chiave personale)
    await new Promise((r) => setTimeout(r, 150));
  }

  const rows = results
    .map((f) => {
      const comment = `-- ${f.name} → USDA: "${f.usda_description}"${f.mismatch ? "  ⚠️ VERIFICARE: kcal non coerente con i macro" : ""}`;
      const values = `('${sqlEscape(f.name)}', '${f.cat}', ${f.kcal}, ${f.protein}, ${f.carbs}, ${f.fat}, ${f.fiber}, 'usda', '${f.source_id}')`;
      return `${comment}\n${values}`;
    })
    .join(",\n");

  const mismatchCount = results.filter((f) => f.mismatch).length;

  const sql = `-- Import automatico da USDA FoodData Central (${results.length}/${FOODS.length} trovati)
-- ${mismatchCount} righe segnalate come DA VERIFICARE (vedi commenti sopra ogni riga)
insert into public.foods (name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, source, source_id)
values
${rows};
`;

  const fs = await import("fs");
  fs.writeFileSync("iterup_foods_seed.sql", sql);

  console.log(`\nFatto. ${results.length}/${FOODS.length} alimenti trovati e scritti in iterup_foods_seed.sql`);
  if (results.length < FOODS.length) {
    console.log(`${FOODS.length - results.length} non trovati (vedi [NON TROVATO] sopra) — li aggiungi a mano dopo.`);
  }
  if (mismatchCount > 0) {
    console.log(`${mismatchCount} alimenti segnalati ⚠️ DA VERIFICARE — controlla i commenti nel file SQL prima di fidarti dei dati.`);
  }
}

main();
