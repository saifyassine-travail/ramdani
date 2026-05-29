import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatName(firstName: string, lastName: string): string {
  const nom = lastName.toUpperCase()
  const prenom = firstName
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
  if (!nom && !prenom) return ""
  if (!nom) return prenom
  if (!prenom) return nom
  return `${nom} ${prenom}`
}
