"use client"

import type React from "react"
import { usePathname } from "next/navigation"

/**
 * Fondu d'entrée rejoué à chaque changement de route.
 *
 * Le `key` sur le pathname force le remontage : sans lui l'animation ne
 * se déclencherait qu'au premier rendu. Les pages « Paramètres » sont
 * volontairement exclues (formulaires longs, l'animation gênait la lecture).
 *
 * Le conteneur garde `h-full` pour ne pas casser les pages en hauteur fixe
 * (tableau de bord, page médecin, actualités) qui s'appuient dessus.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith("/settings")) return <>{children}</>
  return (
    <div key={pathname} className="pg-route h-full">
      {children}
    </div>
  )
}
