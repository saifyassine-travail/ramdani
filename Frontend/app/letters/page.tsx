"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import { formatGlobalDate } from "@/lib/format-date"
import { NotebookPen, Plus, Loader2, AlertCircle } from "lucide-react"

interface LetterListItem {
  id: number
  title: string
  content: string
  created_at?: string
}

// Strip HTML down to a short plain-text preview for the list card.
function excerpt(html: string, max = 160) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  if (text.length <= max) return text
  return text.slice(0, max).trim() + "…"
}

export default function LettersHubPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [letters, setLetters] = useState<LetterListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLetters = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getAllCustomDocuments()
      if (response.success && response.data) {
        const data: any = response.data
        setLetters(data.customDocuments || [])
      } else {
        setError("Impossible de charger les lettres")
      }
    } catch (err) {
      console.error("[v0] Error fetching letters:", err)
      setError("Une erreur s'est produite lors du chargement des lettres")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLetters()
  }, [fetchLetters])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <NotebookPen className="h-6 w-6 text-rose-500" />
            Lettres
          </div>
          <Button
            onClick={() => router.push("/letters/new")}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Lettre
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
            <AlertCircle className="h-8 w-8 mb-2 text-red-400" />
            <p>{error}</p>
          </div>
        ) : letters.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-10 text-center text-gray-500">
              <NotebookPen className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="mb-4">Aucune lettre pour le moment.</p>
              <Button
                onClick={() => router.push("/letters/new")}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 mx-auto"
              >
                <Plus className="h-4 w-4" />
                Nouvelle Lettre
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {letters.map((letter) => (
              <Card
                key={letter.id}
                className="shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/letters/${letter.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{letter.title || "Document sans titre"}</p>
                      {letter.content && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{excerpt(letter.content)}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {letter.created_at && (
                        <span className="text-xs text-gray-400">{formatGlobalDate(letter.created_at)}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
