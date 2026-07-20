// Variables available in the customizable certificate template. Shown as a
// legend in Settings so the doctor knows which placeholders they can use.
export const CERTIFICATE_VARIABLES: { token: string; label: string }[] = [
  { token: "{patient}", label: "Nom du patient" },
  { token: "{cin}", label: "CIN" },
  { token: "{jours}", label: "Nombre de jours de repos" },
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

// Substitutes each {token} in the template. Falls back to the default template
// when none is provided; unknown tokens are left as-is.
export function renderCertificateTemplate(
  template: string | null | undefined,
  vars: CertificateVars,
): string {
  const base = template && template.trim() ? template : DEFAULT_CERTIFICATE_TEMPLATE
  return base
    .split("{patient}").join(vars.patient)
    .split("{cin}").join(vars.cin)
    .split("{jours}").join(vars.jours)
    .split("{date_debut}").join(vars.date_debut)
    .split("{date_fin}").join(vars.date_fin)
    .split("{docteur}").join(vars.docteur)
    .split("{ville}").join(vars.ville)
    .split("{date}").join(vars.date)
}
