// Variables available in the customizable certificate template. Shown as a
// legend in Settings so the doctor knows which placeholders they can use.
export const CERTIFICATE_VARIABLES: { token: string; label: string }[] = [
  { token: "{patient}", label: "Nom du patient" },
  { token: "{cin}", label: "CIN" },
  { token: "{jours}", label: "Nombre de jours de repos" },
  { token: "{jours_lettre}", label: "Nombre de jours en lettres" },
  { token: "{date_debut}", label: "Date de début" },
  { token: "{date_fin}", label: "Date de fin" },
  { token: "{docteur}", label: "Nom du médecin" },
  { token: "{ville}", label: "Ville" },
  { token: "{date}", label: "Date du jour" },
]

// Reproduces the previously hardcoded certificate body, with the fixed doctor
// name / city replaced by variables. Used as the fallback whenever no custom
// template has been saved in Settings.
export const DEFAULT_CERTIFICATE_TEMPLATE = `Je soussigné(e), {docteur}, certifie avoir vu et examiné en consultation aujourd'hui :
{patient}
portant le CIN : {cin}
et atteste que son état de santé nécessite un arrêt de travail de {jours} jours, du {date_debut} au {date_fin}.
Certificat délivré en main propre à l'intéressé(e) pour servir et valoir ce que de droit.
A {ville} le {date}`

export interface CertificateVars {
  patient: string
  cin: string
  jours: string
  date_debut: string
  date_fin: string
  docteur: string
  ville: string
  date: string
}

// Write an integer (0..999999) in French words, e.g. 15 -> "quinze".
export function numberToFrenchWords(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return "zéro"
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"]
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"]
  const below100 = (x: number): string => {
    if (x < 20) return units[x]
    const t = Math.floor(x / 10)
    const u = x % 10
    if (t === 7 || t === 9) {
      const base = t === 7 ? "soixante" : "quatre-vingt"
      if (t === 7 && u === 1) return "soixante et onze"
      return base + "-" + units[10 + u]
    }
    if (u === 0) return t === 8 ? "quatre-vingts" : tens[t]
    if (u === 1 && t >= 2 && t <= 6) return tens[t] + " et un"
    return tens[t] + "-" + units[u]
  }
  const below1000 = (x: number): string => {
    const h = Math.floor(x / 100)
    const r = x % 100
    let s = ""
    if (h > 0) {
      s = (h > 1 ? units[h] + " " : "") + "cent"
      if (h > 1 && r === 0) s += "s"
    }
    if (r > 0) s = (s ? s + " " : "") + below100(r)
    return s
  }
  let result = ""
  const thousands = Math.floor(n / 1000)
  const rest = n % 1000
  if (thousands > 0) result += (thousands > 1 ? below1000(thousands) + " mille" : "mille") + " "
  if (rest > 0) result += below1000(rest)
  return result.trim()
}

// Substitutes each {token} in the template. Falls back to the default template
// when none is provided; unknown tokens are left as-is. {jours_lettre} is derived
// from {jours} (the day count written in words).
export function renderCertificateTemplate(
  template: string | null | undefined,
  vars: CertificateVars,
): string {
  const base = template && template.trim() ? template : DEFAULT_CERTIFICATE_TEMPLATE
  const joursNum = parseInt(String(vars.jours), 10)
  const joursLettre = isNaN(joursNum) ? "" : numberToFrenchWords(joursNum)
  return base
    .split("{patient}").join(vars.patient)
    .split("{cin}").join(vars.cin)
    .split("{jours_lettre}").join(joursLettre)
    .split("{jours}").join(vars.jours)
    .split("{date_debut}").join(vars.date_debut)
    .split("{date_fin}").join(vars.date_fin)
    .split("{docteur}").join(vars.docteur)
    .split("{ville}").join(vars.ville)
    .split("{date}").join(vars.date)
}
