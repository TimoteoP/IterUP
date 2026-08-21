// ============================================================
// IterUp — Negative Self-Talk: tassonomia fissa
// ------------------------------------------------------------
// Vedi PRD-addendum-negative-self-talk.md sezione 2. Enum fisso, non
// estendibile senza revisione esplicita (evita drift semantico che
// romperebbe la dashboard analitica) — vedi anche la scelta esplicita
// dell'utente di tenere anche `theme` come enum fisso, non semi-libero.
// ============================================================

export const DISTORTION_TYPES = [
  { value: "ALL_OR_NOTHING", label: "Tutto o niente", description: "Pensiero in bianco e nero, senza vie di mezzo." },
  { value: "OVERGENERALIZATION", label: "Generalizzazione eccessiva", description: "Un singolo evento diventa una regola generale." },
  { value: "MENTAL_FILTER", label: "Filtro mentale", description: "Solo il dettaglio negativo resta visibile." },
  { value: "DISCOUNTING_POSITIVE", label: "Svalutazione del positivo", description: "Il positivo viene liquidato come irrilevante o casuale." },
  { value: "JUMPING_TO_CONCLUSIONS", label: "Conclusioni affrettate", description: "Leggere la mente altrui o prevedere il futuro senza prove (mind-reading, fortune-telling)." },
  { value: "MAGNIFICATION", label: "Ingigantimento/minimizzazione", description: "Catastrofizzare un problema o minimizzarne uno reale." },
  { value: "EMOTIONAL_REASONING", label: "Ragionamento emotivo", description: "\"Mi sento così, quindi deve essere vero.\"" },
  { value: "SHOULD_STATEMENTS", label: "Imperativi rigidi", description: "\"Dovrei\"/\"devo\" applicati con rigidità a sé o agli altri." },
  { value: "LABELING", label: "Etichettamento", description: "Un errore diventa un'identità (\"ho sbagliato\" → \"sono un fallito\")." },
  { value: "PERSONALIZATION", label: "Personalizzazione", description: "Attribuzione di colpa/causalità eccessiva a sé stessi." },
] as const;

export type DistortionType = (typeof DISTORTION_TYPES)[number]["value"];

export function isDistortionType(value: unknown): value is DistortionType {
  return typeof value === "string" && DISTORTION_TYPES.some((d) => d.value === value);
}

export function distortionLabel(value: string): string {
  return DISTORTION_TYPES.find((d) => d.value === value)?.label ?? value;
}

export const THEME_TAGS = [
  { value: "lavoro", label: "Lavoro" },
  { value: "corpo", label: "Corpo" },
  { value: "relazioni", label: "Relazioni" },
  { value: "economico", label: "Economico" },
  { value: "altro", label: "Altro" },
] as const;

export type ThemeTag = (typeof THEME_TAGS)[number]["value"];

export function isThemeTag(value: unknown): value is ThemeTag {
  return typeof value === "string" && THEME_TAGS.some((t) => t.value === value);
}

export function themeLabel(value: string): string {
  return THEME_TAGS.find((t) => t.value === value)?.label ?? value;
}

export const PATTERN_FLAG_TYPES = ["frequency_high", "intensity_high", "theme_concentration"] as const;
export type PatternFlagType = (typeof PATTERN_FLAG_TYPES)[number];

export const REACTION_SOURCES = ["user", "llm"] as const;
export type TagSource = (typeof REACTION_SOURCES)[number];
