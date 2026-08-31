"use client"

import { useCallback, useEffect, useState } from "react"
import {
  apiClient,
  type EquivalentCatalogue,
  type EquivalentOfficiel,
  type Medicament,
  type RemboursementRegime,
} from "@/lib/api"
import { Loader2, ShieldCheck, ShieldOff, ArrowLeftRight, ExternalLink } from "lucide-react"

const REGIME_STYLE: Record<string, { bg: string; fg: string; ring: string }> = {
  CNSS: { bg: "bg-sky-50", fg: "text-sky-700", ring: "ring-sky-200" },
  CNOPS: { bg: "bg-violet-50", fg: "text-violet-700", ring: "ring-violet-200" },
}

const num = (v: unknown) =>
  v === null || v === undefined || v === "" ? null : Number(v)

const dh = (v: unknown) => {
  const n = num(v)
  return n === null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH"
}

/** Compact CNSS / CNOPS chip — used inline in the table rows. */
export function RegimeTag({
  regime,
  remboursable,
  taux,
}: {
  regime: string
  remboursable: boolean
  taux?: number | null
}) {
  const s = REGIME_STYLE[regime] || { bg: "bg-gray-50", fg: "text-gray-600", ring: "ring-gray-200" }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-[2px] text-[10.5px] font-semibold ring-1 ring-inset ${
        remboursable ? `${s.bg} ${s.fg} ${s.ring}` : "bg-gray-50 text-gray-400 ring-gray-200"
      }`}
      title={
        remboursable
          ? `${regime} — pris en charge${taux ? ` à ${taux} %` : ""}`
          : `${regime} — non remboursable`
      }
    >
      {remboursable ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
      {regime}
      {remboursable && taux ? <span className="font-mono">{taux}%</span> : null}
    </span>
  )
}

/**
 * Reimbursement + equivalents for one medicament, loaded on demand.
 * Renders nothing at all when the national reference base is not installed,
 * so a practice without it never sees an empty scaffold.
 */
export default function MedicamentReferencePanel({
  medicament,
  onOpenEquivalent,
}: {
  medicament: Medicament
  onOpenEquivalent?: (name: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)
  const [regimes, setRegimes] = useState<RemboursementRegime[]>([])
  const [officiels, setOfficiels] = useState<EquivalentOfficiel[]>([])
  const [substituables, setSubstituables] = useState<EquivalentCatalogue[]>([])
  const [memeDci, setMemeDci] = useState<EquivalentCatalogue[]>([])
  const [tab, setTab] = useState<"officiels" | "substituables" | "dci">("officiels")

  const id = medicament.ID_Medicament

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [remb, equ] = await Promise.all([
        apiClient.getMedicamentRemboursement(id),
        apiClient.getMedicamentEquivalents(id),
      ])
      setAvailable(remb.available !== false)
      setRegimes(remb.regimes || [])
      setOfficiels(equ.officiels || [])
      setSubstituables(equ.substituables || [])
      setMemeDci(equ.meme_dci || [])
      setTab((equ.officiels?.length ? "officiels" : equ.substituables?.length ? "substituables" : "dci"))
    } catch {
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Consultation des listes CNSS / CNOPS…
      </div>
    )
  }
  if (!available) return null

  const counts = { officiels: officiels.length, substituables: substituables.length, dci: memeDci.length }
  const total = counts.officiels + counts.substituables + counts.dci

  return (
    <div className="space-y-4">
      {/* ── Remboursement ─────────────────────────────────────────────── */}
      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          Prise en charge AMO
        </h4>
        {regimes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
            Ce produit ne figure dans aucune des deux listes officielles — à la charge complète du
            patient, sauf accord particulier.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {regimes.map((r) => {
              const s = REGIME_STYLE[r.regime]
              const covered = r.remboursable === 1
              return (
                <div
                  key={r.regime}
                  className={`rounded-xl border p-3.5 ${
                    covered ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50/60"
                  }`}
                >
                  <div className="mb-2.5 flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-[3px] text-[11px] font-bold ring-1 ring-inset ${s.bg} ${s.fg} ${s.ring}`}
                    >
                      {r.regime}
                    </span>
                    <span className="text-[11px] text-gray-400">{r.ean13}</span>
                    {covered ? (
                      <span className="ml-auto text-[11px] font-semibold text-emerald-600">
                        Remboursable
                      </span>
                    ) : (
                      <span className="ml-auto text-[11px] font-semibold text-gray-400">
                        Non remboursable
                      </span>
                    )}
                  </div>

                  {covered ? (
                    <dl className="space-y-1 text-[12.5px]">
                      <Row label="Prix public" value={dh(r.ppv)} />
                      <Row label="Base de remboursement" value={dh(r.base)} />
                      <Row label="Taux appliqué" value={`${num(r.taux) ?? "—"} %`} />
                      <Row label="Remboursé" value={dh(r.montant_rembourse)} strong />
                      <Row label="Reste à charge" value={dh(r.reste_a_charge)} strong />
                      <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
                        <Row
                          label={`En ALD (${num(r.taux_ald) ?? 100} %)`}
                          value={dh(r.montant_rembourse_ald)}
                        />
                        <Row label="Reste à charge ALD" value={dh(r.reste_a_charge_ald)} />
                      </div>
                    </dl>
                  ) : (
                    <p className="text-[12.5px] text-gray-500">
                      Inscrit sur la liste {r.regime} mais au taux 0 % — non pris en charge.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Équivalents ───────────────────────────────────────────────── */}
      {total > 0 && (
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              Équivalents
            </h4>
            <div className="ml-auto flex gap-1">
              {(
                [
                  ["officiels", "Groupe officiel", counts.officiels],
                  ["substituables", "Substituables", counts.substituables],
                  ["dci", "Même DCI", counts.dci],
                ] as const
              ).map(([key, label, n]) =>
                n === 0 ? null : (
                  <button
                    key={key}
                    onClick={() => setTab(key as typeof tab)}
                    className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                      tab === key
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label} <span className="font-mono opacity-70">{n}</span>
                  </button>
                ),
              )}
            </div>
          </div>

          {tab === "officiels" && (
            <p className="mb-2 text-[11.5px] text-gray-500">
              Groupe de substitution officiel CNOPS — référence opposable pour la substitution.
            </p>
          )}

          <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200">
            <table className="w-full text-[12.5px]">
              <tbody>
                {tab === "officiels" &&
                  officiels.map((e) => (
                    <EquivRow
                      key={e.ean13}
                      name={e.nom}
                      sub={[e.dosage, e.forme].filter(Boolean).join(" · ")}
                      isPrinceps={e.type === "P"}
                      ppv={e.ppv}
                      economie={e.economie_pct}
                      onOpen={onOpenEquivalent}
                    />
                  ))}
                {tab === "substituables" &&
                  substituables.map((e) => (
                    <EquivRow
                      key={e.id}
                      name={e.nom}
                      sub={[e.laboratoire, e.presentation].filter(Boolean).join(" · ")}
                      isPrinceps={e.is_princeps === 1}
                      ppv={e.ppv}
                      economie={e.economie_pct}
                      onOpen={onOpenEquivalent}
                    />
                  ))}
                {tab === "dci" &&
                  memeDci.map((e) => (
                    <EquivRow
                      key={e.id}
                      name={e.nom}
                      sub={[e.dosage, e.laboratoire].filter(Boolean).join(" · ")}
                      isPrinceps={e.is_princeps === 1}
                      ppv={e.ppv}
                      onOpen={onOpenEquivalent}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd
        className={`font-mono tabular-nums ${
          strong ? "font-semibold text-gray-900" : "text-gray-700"
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function EquivRow({
  name,
  sub,
  isPrinceps,
  ppv,
  economie,
  onOpen,
}: {
  name: string
  sub: string
  isPrinceps: boolean
  ppv: string | number | null
  economie?: string | number | null
  onOpen?: (name: string) => void
}) {
  const eco = num(economie)
  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-900">{name}</span>
          <span
            className={`rounded px-1.5 py-[1px] text-[10px] font-semibold ${
              isPrinceps ? "bg-gray-100 text-gray-600" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isPrinceps ? "Princeps" : "Générique"}
          </span>
        </div>
        {sub && <div className="mt-0.5 text-[11px] text-gray-500">{sub}</div>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-gray-700">
        {dh(ppv)}
      </td>
      <td className="w-20 whitespace-nowrap px-3 py-2 text-right">
        {eco !== null && eco > 0 ? (
          <span className="rounded-md bg-emerald-50 px-1.5 py-[2px] text-[11px] font-semibold text-emerald-700">
            −{eco.toFixed(1)} %
          </span>
        ) : null}
      </td>
      <td className="w-9 px-2 py-2 text-right">
        {onOpen && (
          <button
            onClick={() => onOpen(name)}
            title="Rechercher ce produit dans le catalogue"
            className="text-gray-400 transition-colors hover:text-gray-700"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

export { ExternalLink }
