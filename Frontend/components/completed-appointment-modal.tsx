"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Loader2, CalendarPlus, Wallet } from "lucide-react"
import { apiClient } from "@/lib/api"

interface CompletedAppointmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: any | null
  patientName: string
  onSaved?: (message: string) => void
  onPlanAnother?: () => void
}

export default function CompletedAppointmentModal({
  open,
  onOpenChange,
  appointment,
  patientName,
  onSaved,
  onPlanAnother,
}: CompletedAppointmentModalProps) {
  const [payement, setPayement] = useState<string>("")
  const [credit, setCredit] = useState<string>("")
  const [mutuelle, setMutuelle] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)

  const isFreeConsultation = Boolean(appointment?.is_free_consultation)

  // Seed from the appointment each time the modal opens.
  useEffect(() => {
    if (!open || !appointment) return
    setPayement(appointment.is_free_consultation ? "0" : (appointment.payement != null ? String(appointment.payement) : ""))
    setCredit(appointment.credit != null ? String(appointment.credit) : "")
    setMutuelle(Boolean(appointment.mutuelle))
  }, [open, appointment])

  const handleSave = async () => {
    if (!appointment) return
    setSaving(true)
    try {
      const id = appointment.ID_RV
      const newPayement = Number.parseFloat(payement) || 0
      const newCredit = Number.parseFloat(credit) || 0
      const origPayement = Number(appointment.payement) || 0
      const origCredit = Number(appointment.credit) || 0
      const origMutuelle = Boolean(appointment.mutuelle)

      if (newPayement !== origPayement) {
        await apiClient.updatePrice(id, newPayement)
      }
      if (newCredit !== origCredit) {
        await apiClient.updateCredit(id, newCredit)
      }
      if (mutuelle !== origMutuelle) {
        await apiClient.toggleMutuelle(id)
      }

      onSaved?.("Rendez-vous mis à jour")
      onOpenChange(false)
    } catch {
      onSaved?.("Erreur lors de la mise à jour")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            Rendez-vous terminé
          </DialogTitle>
        </DialogHeader>

        <p className="-mt-1 text-sm text-gray-500">
          <span className="font-semibold text-gray-700">{patientName || "Ce patient"}</span> — modifiez le paiement,
          le crédit et la mutuelle.
        </p>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm text-gray-700">
              <Wallet className="h-4 w-4 text-gray-400" />
              Payé (DH)
              {isFreeConsultation && <span className="text-xs font-normal text-gray-400">(consultation gratuite)</span>}
            </Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={isFreeConsultation ? 0 : payement}
              onChange={(e) => setPayement(e.target.value)}
              className="focus-visible:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="0"
              disabled={isFreeConsultation}
              title={isFreeConsultation ? "Consultation gratuite — prix non modifiable" : undefined}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-gray-700">Reste / Impayé (DH)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
              className={`focus-visible:ring-green-500 ${(Number.parseFloat(credit) || 0) > 0 ? "text-red-600 font-semibold border-red-300" : ""}`}
              placeholder="0"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <Label className="text-sm text-gray-700">Mutuelle</Label>
            <Switch checked={mutuelle} onCheckedChange={setMutuelle} />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          {onPlanAnother && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                onPlanAnother()
              }}
              disabled={saving}
              className="gap-2"
            >
              <CalendarPlus className="h-4 w-4" />
              Planifier un autre RV
            </Button>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
