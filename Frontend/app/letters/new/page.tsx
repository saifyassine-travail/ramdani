"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import { ArrowLeft, Save, NotebookPen } from "lucide-react"
import { EditorToolbar, LetterProseStyles, EDITOR_CONTENT_CLASS } from "@/components/letter-editor-toolbar"

// Free-standing "Nouvelle Lettre" page — reachable from the sidebar only, not
// tied to any patient. Behaves like a blank word-processor document: no
// title field, you just start typing.
export default function NewLetterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const editor = useEditor({
    // Required in the Next.js App Router: TipTap renders on the client only,
    // so it must not attempt to render during SSR (avoids a hydration
    // mismatch between the server-rendered empty shell and the client editor).
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    editorProps: {
      attributes: {
        class: EDITOR_CONTENT_CLASS,
      },
    },
  })

  const goBack = useCallback(() => {
    router.push("/letters")
  }, [router])

  const handleSave = useCallback(async () => {
    if (!editor) return
    if (editor.isEmpty) {
      toast({ title: "Document vide", description: "Merci de rédiger le contenu du document.", variant: "destructive" })
      return
    }

    try {
      setSaving(true)
      const response = await apiClient.createCustomDocument({ content: editor.getHTML() })
      if (response.success) {
        toast({ title: "Succès", description: "Document créé avec succès" })
        router.push("/letters")
      } else {
        toast({ title: "Erreur", description: "Impossible de créer le document", variant: "destructive" })
      }
    } catch (err) {
      console.error("[v0] Error saving letter:", err)
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la création du document",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [editor, router, toast])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={goBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux lettres
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <NotebookPen className="h-6 w-6 text-rose-500" />
            Nouvelle Lettre
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <EditorToolbar editor={editor} />
            <div className="border border-gray-200 rounded-b-md bg-white">
              <EditorContent editor={editor} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={goBack}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>

      <LetterProseStyles />
    </div>
  )
}
