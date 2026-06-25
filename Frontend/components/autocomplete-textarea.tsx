"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Mirror of the shadcn <Textarea> base classes so the ghost backdrop and the
// textarea share identical box metrics (font, padding, border, wrapping).
const BASE =
  "flex min-h-[60px] w-full rounded-md border border-input px-3 py-2 text-base shadow-sm md:text-sm"

const MIN_CHARS = 3

/**
 * Find an inline completion for `value`. Tries the whole text as a prefix
 * first, then the current line. `suggestions` is searched in order, so callers
 * should put higher-priority items (e.g. the doctor's history) first.
 */
function findGhost(value: string, suggestions: string[]): string {
  if (!value) return ""

  const matchPrefix = (prefix: string): string => {
    if (prefix.length < MIN_CHARS) return ""
    const lower = prefix.toLowerCase()
    for (const s of suggestions) {
      if (s.length > prefix.length && s.toLowerCase().startsWith(lower)) {
        return s.slice(prefix.length)
      }
    }
    return ""
  }

  const whole = matchPrefix(value)
  if (whole) return whole

  const nl = value.lastIndexOf("\n")
  if (nl >= 0) return matchPrefix(value.slice(nl + 1))

  return ""
}

interface AutocompleteTextareaProps {
  value: string
  onChange: (value: string) => void
  suggestions?: string[]
  enabled?: boolean
  className?: string
  placeholder?: string
  rows?: number
  id?: string
}

export function AutocompleteTextarea({
  value,
  onChange,
  suggestions = [],
  enabled = true,
  className,
  placeholder,
  rows,
  id,
}: AutocompleteTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const backdropRef = React.useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = React.useState(true)

  const ghost = React.useMemo(() => {
    if (!enabled || !atEnd) return ""
    return findGhost(value, suggestions)
  }, [enabled, atEnd, value, suggestions])

  const syncCaret = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    setAtEnd(el.selectionStart === el.selectionEnd && el.selectionStart === el.value.length)
  }, [])

  const syncScroll = React.useCallback(() => {
    const el = textareaRef.current
    const bd = backdropRef.current
    if (el && bd) {
      bd.scrollTop = el.scrollTop
      bd.scrollLeft = el.scrollLeft
    }
  }, [])

  const accept = React.useCallback(() => {
    if (!ghost) return
    onChange(value + ghost)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.selectionStart = el.selectionEnd = el.value.length
        setAtEnd(true)
        syncScroll()
      }
    })
  }, [ghost, value, onChange, syncScroll])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab accepts the suggestion; with no suggestion, Tab keeps its normal
    // focus-moving behaviour.
    if (e.key === "Tab" && ghost) {
      e.preventDefault()
      accept()
    }
  }

  return (
    <div className="relative">
      <div
        ref={backdropRef}
        aria-hidden="true"
        className={cn(
          BASE,
          className,
          "absolute inset-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none select-none text-transparent",
        )}
      >
        {value}
        {ghost ? <span className="text-gray-400">{ghost}</span> : null}
        {"​"}
      </div>

      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => {
          onChange(e.target.value)
          const el = e.target
          setAtEnd(el.selectionStart === el.selectionEnd && el.selectionStart === el.value.length)
        }}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        onSelect={syncCaret}
        onClick={syncCaret}
        onKeyUp={syncCaret}
        className={cn(
          BASE,
          "relative bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
          "bg-transparent",
        )}
      />

      {ghost ? (
        <span className="pointer-events-none absolute bottom-2 right-2 rounded border border-gray-200 bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
          Tab ↹
        </span>
      ) : null}
    </div>
  )
}
