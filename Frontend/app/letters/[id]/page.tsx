"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import { ArrowLeft, Save, Trash2, NotebookPen, Loader2 } from "lucide-react"
import { EditorToolbar, LetterProseStyles, EDITOR_CONTENT_CLASS } from "@/components/letter-editor-toolbar"

// Open an existing letter, edit it like a Word document (no title field —
// same editor as /letters/new), save changes, or delete it.
export default function OpenLetterPage() {
  const router = useRouter()
  const params = useParams()
  const documentId = Number.parseInt(params.id as string)
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  useEffect(() => {
    if (!documentId || Number.isNaN(documentId)) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const fetchDocument = async () => {
      try {
        setLoading(true)
        const response = await apiClient.getCustomDocument(documentId)
        if (response.success && response.data) {
          const doc: any = (response.data as any).customDocument || response.data
          if (doc?.content && editor) {
            editor.commands.setContent(doc.content)
          }
        } else {
          setNotFound(true)
        }
      } catch (err) {
        console.error("[v0] Error fetching letter:", err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    if (editor) fetchDocument()
    // Wait for the editor instance to exist before loading, since we set its
    // content directly once the document arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, editor])

  const handleSave = useCallback(async () => {
    if (!editor) return
    if (editor.isEmpty) {
      toast({ title: "Document vide", description: "Merci de rédiger le contenu du document.", variant: "destructive" })
      return
    }

    try {
      setSaving(true)
      const response = await apiClient.updateCustomDocument(documentId, { content: editor.getHTML() })
      if (response.success) {
        toast({ title: "Succès", description: "Document mis à jour avec succès" })
      } else {
        toast({ title: "Erreur", description: "Impossible d'enregistrer le document", variant: "destructive" })
      }
    } catch (err) {
      console.error("[v0] Error updating letter:", err)
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de l'enregistrement du document",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [editor, documentId, toast])

  const handleDelete = useCallback(async () => {
    if (!window.confirm("Supprimer définitivement ce document ?")) return

    try {
      setDeleting(true)
      const response = await apiClient.deleteCustomDocument(documentId)
      if (response.success) {
        toast({ title: "Succès", description: "Document supprimé avec succès" })
        router.push("/letters")
      } else {
        toast({ title: "Erreur", description: "Impossible de supprimer le document", variant: "destructive" })
      }
    } catch (err) {
      console.error("[v0] Error deleting letter:", err)
      toast({ title: "Erreur", description: "Une erreur s'est produite", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }, [documentId, router, toast])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Document introuvable.</p>
        <Button variant="outline" onClick={() => router.push("/letters")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux lettres
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/letters")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux lettres
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Suppression..." : "Supprimer"}
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

          <div className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <NotebookPen className="h-6 w-6 text-rose-500" />
            Lettre
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
