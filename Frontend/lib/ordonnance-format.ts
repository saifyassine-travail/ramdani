// Shared ordonnance medication formatting so the patient-info quick print and the
// appointment page produce identical posology lines.

const TIME_ORDER = ["Matin", "Midi", "Soir"] as const

interface MedDose {
  time: string
  units: string
}

export interface OrdMed {
  name?: string
  type?: string
  type_category?: string
  pivot?: { frequence?: string; duree?: string; dosage?: string }
}

export function isInjType(med: { type?: string; type_category?: string; name?: string }): boolean {
  const src = `${med.type_category || ""} ${med.type || ""} ${med.name || ""}`.toLowerCase()
  return (
    src.includes("injectable") ||
    src.includes("injection") ||
    src.includes("parenteral") ||
    src.includes("parentéral") ||
    src.includes("insulin") ||
    src.includes("[ins]")
  )
}

// Parse "Matin:2,Midi:1,Soir:2;après repas" into per-time units + one meal timing.
function parseMedFrequence(frequence: string): { doses: MedDose[]; mealTiming: string } {
  if (!frequence) return { doses: [], mealTiming: "" }
  let mealTiming = ""
  let dosePart = frequence
  const semiIdx = frequence.indexOf(";")
  if (semiIdx >= 0) {
    dosePart = frequence.slice(0, semiIdx)
    mealTiming = frequence.slice(semiIdx + 1).trim()
  }
  const doses = dosePart
    .split(",")
    .map((part) => {
      const seg = part.split(":")
      const time = (seg[0] || "").trim()
      let units = (seg[1] || "").trim()
      const looksLikeDose = /^\d+(?:\.\d*)?$|^\d+\/\d*$/.test(units)
      if (units && !looksLikeDose) {
        if (!mealTiming) mealTiming = units
        units = ""
      }
      if (seg.length >= 3 && !mealTiming) mealTiming = seg.slice(2).join(":").trim()
      return { time, units }
    })
    .filter((d) => (TIME_ORDER as readonly string[]).includes(d.time))
  return { doses, mealTiming }
}

// 1.5 -> "1 et demi", 1/2 -> "un demi", 3/4 -> "trois quarts", etc.
export function formatDoseQty(raw: string): string {
  const s = String(raw ?? "").trim()
  if (!s) return "1"
  let whole = 0
  let frac = 0
  const fr = s.match(/^(\d+)\/(\d+)$/)
  if (fr) {
    const den = Number(fr[2])
    if (!den) return s
    const val = Number(fr[1]) / den
    whole = Math.floor(val)
    frac = +(val - whole).toFixed(2)
  } else {
    const n = parseFloat(s.replace(",", "."))
    if (isNaN(n)) return s
    whole = Math.floor(n)
    frac = +(n - whole).toFixed(2)
  }
  const word = frac === 0.5 ? "demi" : frac === 0.25 ? "quart" : frac === 0.75 ? "trois quarts" : null
  if (!word) return s
  if (whole === 0) return word === "trois quarts" ? "trois quarts" : `un ${word}`
  return `${whole} et ${word}`
}

export function getMedTypeLabel(med: { type?: string; type_category?: string; name?: string }): string {
  const cat = (med.type_category || "").toLowerCase()
  const raw = (med.type || "").toLowerCase()
  const src = cat || raw
  if (!src) {
    const name = med.name || ""
    const hasComma = name.includes(",")
    const afterComma = name.split(",").pop()?.trim().toLowerCase() || ""
    if (afterComma.includes("comprim")) return "cp"
    if (afterComma.includes("sirop")) return "sirop"
    if (afterComma.includes("gélule") || afterComma.includes("gelule") || afterComma.includes("capsule")) return "gél"
    if (afterComma.includes("gel")) return "fois"
    if (afterComma.includes("inject") || afterComma.includes("solution inj")) return "inj"
    return hasComma ? afterComma.split(" ")[0] || "cp" : "cp"
  }
  if (src.includes("comprim")) return "cp"
  if (src.includes("sirop")) return "sirop"
  if (src.includes("gelule") || src.includes("gélule") || src.includes("capsule")) return "gél"
  if (src.includes("gel")) return "fois"
  if (src.includes("suspension injectable")) return "susp inj"
  if (src.includes("injectable") || src.includes("injection")) return "inj"
  if (src.includes("perfusion")) return "perf"
  if (src.includes("solution")) return "sol"
  if (src.includes("suspension")) return "susp"
  if (src.includes("sachet")) return "sachet"
  if (src.includes("creme") || src.includes("crème") || src.includes("pommade")) return "crème"
  if (src.includes("spray") || src.includes("aerosol") || src.includes("aérosol")) return "spray"
  if (src.includes("suppositoire")) return "supp"
  if (src.includes("goutte") || src.includes("collyre")) return "gouttes"
  if (src.includes("patch")) return "patch"
  if (src.includes("poudre")) return "pdr"
  if (src.includes("lotion")) return "lotion"
  return cat.split(" ")[0] || raw.split(" ")[0] || "cp"
}

// One medication block for the ordonnance (name + posology), 1-based numbered.
export function getMedicationHTML(med: OrdMed, index: number): string {
  const { doses, mealTiming } = parseMedFrequence(med.pivot?.frequence || "")
  const duration = med.pivot?.duree || ""
  const fullName = med.name || "Médicament"
  const typeLabel = getMedTypeLabel(med)
  const isInj = isInjType(med) || typeLabel === "inj" || typeLabel === "susp inj"
  const baseName = fullName.includes(",") ? fullName.split(",")[0].trim() : fullName
  const parts = doses.map((d) => {
    const qty = formatDoseQty(d.units || "1")
    const label = isInj ? "UI" : typeLabel
    return `${qty} ${label} ${d.time.toLowerCase()}`
  })
  if (mealTiming) parts.push(mealTiming)
  if (duration) parts.push(`pendant ${duration}`)
  const posology = parts.join(", ")
  return `<div style="margin-bottom:16px;"><div style="font-weight:bold;margin-bottom:1px;">${index + 1} - ${baseName} :</div><div style="padding-left:30px;line-height:1.9;">${posology}</div></div>`
}
