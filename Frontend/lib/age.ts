// Age helpers for patient forms. Minors (under 18) have no CIN of their own,
// so the parent/guardian CIN is collected instead.

export function getAge(birthDay?: string | null): number | null {
  if (!birthDay) return null
  const b = new Date(birthDay)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export function isMinor(birthDay?: string | null): boolean {
  const age = getAge(birthDay)
  return age !== null && age < 18
}
