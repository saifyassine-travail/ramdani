import { getAuthToken } from "@/lib/auth-api"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export interface ResearchEntity {
  text: string
  tag: string
}

export interface ResearchCase {
  id: number
  source: "pmc_patients" | "e3c"
  source_id: string
  language: string
  title: string | null
  age: string | null
  gender: string | null
  summary_text: string
  entities: ResearchEntity[] | null
  license: string
  source_url: string | null
  created_at: string
  updated_at: string
}

export interface ResearchCasePage {
  data: ResearchCase[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface ResearchCaseFilters {
  term?: string
  language?: string
  source?: string
  page?: number
}

export async function fetchResearchCases(filters: ResearchCaseFilters): Promise<ResearchCasePage> {
  const params = new URLSearchParams()
  if (filters.term) params.set("term", filters.term)
  if (filters.language) params.set("language", filters.language)
  if (filters.source) params.set("source", filters.source)
  if (filters.page) params.set("page", String(filters.page))

  const res = await fetch(`${API_BASE}/research-cases?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error("Impossible de charger les cas cliniques")
  }
  return res.json()
}

export async function fetchResearchCase(id: number): Promise<ResearchCase> {
  const res = await fetch(`${API_BASE}/research-cases/${id}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error("Impossible de charger ce cas clinique")
  }
  return res.json()
}

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "Anglais",
  fr: "Français",
  it: "Italien",
  es: "Espagnol",
  eu: "Basque",
}

export const SOURCE_LABELS: Record<string, string> = {
  pmc_patients: "PMC-Patients",
  e3c: "E3C Corpus",
}
