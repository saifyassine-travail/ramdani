"use client"

// Shared TipTap toolbar + editor prose styles for the "Lettres" feature
// (Frontend/app/letters/new and Frontend/app/letters/[id]). Kept in one
// place so the two pages (compose / open-and-edit) stay visually and
// behaviorally identical, like a real word processor.

import type { Editor } from "@tiptap/react"
import {
  Bold,
  Italic,
  UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
} from "lucide-react"

export function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "bg-rose-100 text-rose-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  )
}

export function ToolbarDivider() {
  return <div className="w-px h-6 bg-gray-200 mx-1" />
}

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  return (
    <div className="flex flex-wrap items-center gap-1 border border-gray-200 border-b-0 rounded-t-md bg-gray-50 px-2 py-2">
      <ToolbarButton
        title="Annuler"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Rétablir"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Gras"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Italique"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Souligné"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Paragraphe"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Titre 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Titre 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Titre 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Liste à puces"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Liste numérotée"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Aligner à gauche"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Centrer"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Aligner à droite"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
    </div>
  )
}

// Word-like typography for the editor content area. Shared via a global
// style tag so both the compose page and the open/edit page render letters
// identically.
export function LetterProseStyles() {
  return (
    <style jsx global>{`
      .prose-letter h1 {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 1rem 0 0.5rem;
      }
      .prose-letter h2 {
        font-size: 1.4rem;
        font-weight: 700;
        margin: 1rem 0 0.5rem;
      }
      .prose-letter h3 {
        font-size: 1.15rem;
        font-weight: 600;
        margin: 0.75rem 0 0.5rem;
      }
      .prose-letter p {
        margin: 0.5rem 0;
      }
      .prose-letter ul {
        list-style: disc;
        padding-left: 1.5rem;
        margin: 0.5rem 0;
      }
      .prose-letter ol {
        list-style: decimal;
        padding-left: 1.5rem;
        margin: 0.5rem 0;
      }
      .prose-letter li {
        margin: 0.25rem 0;
      }
    `}</style>
  )
}

export const EDITOR_CONTENT_CLASS =
  "prose-letter min-h-[60vh] w-full max-w-none px-6 py-5 focus:outline-none text-gray-800 leading-relaxed"
