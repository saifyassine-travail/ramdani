"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { authApiClient } from "@/lib/auth-api"
import { apiClient } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShieldCheck, Building2, UserPlus, Check } from "lucide-react"

type Step = 1 | 2 | 3

const STEP_META = [
  { step: 1 as Step, label: "Compte" },
  { step: 2 as Step, label: "Cabinet" },
  { step: 3 as Step, label: "Équipe" },
]

export default function SetupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuth()

  const [checking, setChecking] = useState(true)
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)

  // Step 1 — admin account
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "", passwordConfirmation: "" })
  const [adminError, setAdminError] = useState("")

  // Step 2 — practice info
  const [practiceForm, setPracticeForm] = useState({
    practice_name: "",
    specialization: "",
    address: "",
    practice_city: "",
    phone: "",
    practice_email: "",
  })

  // Step 3 — nurse account
  const [nurseForm, setNurseForm] = useState({ name: "", email: "", password: "" })

  // Guard: if setup was already completed, bounce to /login. If we land here
  // already authenticated (e.g. page refresh mid-wizard), resume at step 2.
  useEffect(() => {
    if (authLoading) return
    if (isAuthenticated) {
      setStep((s) => (s === 1 ? 2 : s))
      setChecking(false)
      return
    }
    authApiClient.getSetupStatus().then(({ needsSetup }) => {
      if (!needsSetup) {
        router.replace("/login")
        return
      }
      setChecking(false)
    })
  }, [authLoading, isAuthenticated, router])

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError("")

    if (adminForm.password !== adminForm.passwordConfirmation) {
      setAdminError("Les mots de passe ne correspondent pas.")
      return
    }

    setSubmitting(true)
    const result = await authApiClient.createAdmin(
      adminForm.name,
      adminForm.email,
      adminForm.password,
      adminForm.passwordConfirmation,
    )
    setSubmitting(false)

    if (!result.success) {
      setAdminError(result.message || "Impossible de créer le compte administrateur.")
      return
    }

    await checkAuth()
    setStep(2)
  }

  const handleSavePractice = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const response = await apiClient.updateUserSettings(practiceForm)
    setSubmitting(false)

    if (!response.success) {
      toast({ title: "Erreur", description: response.message || "Échec de l'enregistrement", variant: "destructive" })
      return
    }
    setStep(3)
  }

  // Land on Settings rather than the (empty) dashboard — Préférences (working
  // hours, tarifs...) and Documents (ordonnance/facture/certificate layouts)
  // still need configuring and that's where those live.
  const finish = () => router.push("/settings")

  const handleCreateNurse = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const response = await apiClient.createUser({ ...nurseForm, role: "nurse" })
    setSubmitting(false)

    if (!response.success) {
      toast({
        title: "Erreur",
        description: response.errors ? Object.values(response.errors).flat().join("\n") : response.message || "Impossible de créer le compte",
        variant: "destructive",
      })
      return
    }
    finish()
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#007090]/5 to-[#005570]/10">
        <Loader2 className="h-8 w-8 animate-spin text-[#007090]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#007090]/5 to-[#005570]/10 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Bienvenue sur MediAssist</h1>
          <p className="text-gray-500 mt-1">Configurons votre cabinet en quelques étapes.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEP_META.map((s, i) => (
            <div key={s.step} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  step === s.step
                    ? "bg-[#007090] text-white"
                    : step > s.step
                    ? "bg-[#007090]/10 text-[#007090]"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {step > s.step ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5 text-center">{s.step}</span>}
                {s.label}
              </div>
              {i < STEP_META.length - 1 && <div className="h-px w-6 bg-gray-200" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#007090]/10 text-[#007090]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle>Créer votre compte administrateur</CardTitle>
              <CardDescription>C'est vous, le médecin — ce compte a accès à toutes les fonctionnalités.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                {adminError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{adminError}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Nom complet</Label>
                  <Input
                    id="admin-name"
                    placeholder="Dr. Nom Prénom"
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="docteur@cabinet.com"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Mot de passe</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="••••••••"
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                      required
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password-confirm">Confirmer</Label>
                    <Input
                      id="admin-password-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={adminForm.passwordConfirmation}
                      onChange={(e) => setAdminForm({ ...adminForm, passwordConfirmation: e.target.value })}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-[#007090] hover:bg-[#005570]" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Continuer
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#007090]/10 text-[#007090]">
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle>Informations du cabinet</CardTitle>
              <CardDescription>Utilisées sur vos ordonnances, factures et certificats. Modifiable plus tard dans Paramètres.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePractice} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="practice-name">Nom du cabinet / médecin</Label>
                  <Input
                    id="practice-name"
                    placeholder="Dr. ..."
                    value={practiceForm.practice_name}
                    onChange={(e) => setPracticeForm({ ...practiceForm, practice_name: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="practice-specialization">Spécialité</Label>
                    <Input
                      id="practice-specialization"
                      value={practiceForm.specialization}
                      onChange={(e) => setPracticeForm({ ...practiceForm, specialization: e.target.value })}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="practice-city">Ville</Label>
                    <Input
                      id="practice-city"
                      value={practiceForm.practice_city}
                      onChange={(e) => setPracticeForm({ ...practiceForm, practice_city: e.target.value })}
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="practice-address">Adresse</Label>
                  <Input
                    id="practice-address"
                    value={practiceForm.address}
                    onChange={(e) => setPracticeForm({ ...practiceForm, address: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="practice-phone">Téléphone</Label>
                    <Input
                      id="practice-phone"
                      value={practiceForm.phone}
                      onChange={(e) => setPracticeForm({ ...practiceForm, phone: e.target.value })}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="practice-email">Email</Label>
                    <Input
                      id="practice-email"
                      type="email"
                      value={practiceForm.practice_email}
                      onChange={(e) => setPracticeForm({ ...practiceForm, practice_email: e.target.value })}
                      disabled={submitting}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-[#007090] hover:bg-[#005570]" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Continuer
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#007090]/10 text-[#007090]">
                <UserPlus className="h-5 w-5" />
              </div>
              <CardTitle>Ajouter un(e) infirmier(ère)</CardTitle>
              <CardDescription>
                Facultatif — vous pourrez ajouter d'autres comptes plus tard dans Paramètres → Utilisateurs.
                Ensuite, vous serez dirigé vers les Paramètres pour finaliser vos préférences et vos documents
                (ordonnance, facture, certificat).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateNurse} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nurse-name">Nom complet</Label>
                  <Input
                    id="nurse-name"
                    value={nurseForm.name}
                    onChange={(e) => setNurseForm({ ...nurseForm, name: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nurse-email">Email</Label>
                  <Input
                    id="nurse-email"
                    type="email"
                    value={nurseForm.email}
                    onChange={(e) => setNurseForm({ ...nurseForm, email: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nurse-password">Mot de passe</Label>
                  <Input
                    id="nurse-password"
                    type="password"
                    placeholder="••••••••"
                    value={nurseForm.password}
                    onChange={(e) => setNurseForm({ ...nurseForm, password: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={finish} disabled={submitting}>
                    Plus tard
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#007090] hover:bg-[#005570]"
                    disabled={submitting || !nurseForm.name || !nurseForm.email || !nurseForm.password}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Terminer
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
