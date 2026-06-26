"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { apiClient } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Users, Settings as SettingsIcon, Save, Plus, Trash2, Edit, Cloud, Download, Lock, RefreshCw, AlertCircle, CheckCircle2, FileText, Stethoscope, History, Bell, Wallet, CalendarClock, Activity, Monitor, Shield } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import OrdonnanceLayoutEditor from "@/components/ordonnance-layout-editor"
import ActivityLogPanel from "@/components/activity-log-panel"
import { useAuth } from "@/hooks/use-auth"

export default function SettingsPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  // Shared style for the segmented tab buttons (brand-coloured active pill).
  const tabTriggerClass =
    "gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 transition-all hover:text-gray-800 data-[state=active]:bg-[#007090] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-cyan-900/20"

  // Role → French label + badge/avatar colours for the Users tab.
  const ROLE_META: Record<string, { label: string; badge: string; avatar: string }> = {
    admin: { label: "Administrateur", badge: "bg-purple-100 text-purple-700", avatar: "bg-gradient-to-br from-purple-500 to-purple-600" },
    doctor: { label: "Médecin", badge: "bg-blue-100 text-blue-700", avatar: "bg-gradient-to-br from-blue-500 to-blue-600" },
    nurse: { label: "Infirmière", badge: "bg-emerald-100 text-emerald-700", avatar: "bg-gradient-to-br from-emerald-500 to-emerald-600" },
    receptionist: { label: "Réceptionniste", badge: "bg-amber-100 text-amber-700", avatar: "bg-gradient-to-br from-amber-500 to-amber-600" },
  }
  const roleMeta = (role?: string) =>
    ROLE_META[role || ""] || { label: role || "—", badge: "bg-gray-100 text-gray-600", avatar: "bg-gradient-to-br from-gray-400 to-gray-500" }
  const userInitials = (name?: string) =>
    (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "nurse"
  })

  // Medical Acts State
  const [newAct, setNewAct] = useState({ name: "", price: "" })

  // Custom Measures State
  const [newMeasure, setNewMeasure] = useState({
    name: "",
    short: "",
    min_value: "",
    max_value: "",
    choices: "",
    color: "red"
  })
  const [measureType, setMeasureType] = useState<"standard" | "choice">("standard")
  const [currentChoice, setCurrentChoice] = useState("")
  const [choicesList, setChoicesList] = useState<string[]>([])

  // Backup & Sync State
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  const [backups, setBackups] = useState<any[]>([])
  const [isGoogleLinked, setIsGoogleLinked] = useState<boolean | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupPassword, setBackupPassword] = useState("")
  const [showBackupDialog, setShowBackupDialog] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [selectedBackupId, setSelectedBackupId] = useState("")

  useEffect(() => {
    fetchSettings()
    fetchUsers()
    fetchBackups()
    fetchUserProfile()

    // Feedback when returning from the Google OAuth callback
    const params = new URLSearchParams(window.location.search)
    if (params.get("google_linked") === "success") {
      toast({ title: "Succès", description: "Google Drive connecté avec succès" })
      window.history.replaceState({}, "", window.location.pathname)
    } else if (params.get("error")) {
      toast({
        title: "Erreur",
        description: "Échec de la connexion à Google Drive. Veuillez réessayer.",
        variant: "destructive",
      })
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const fetchUserProfile = async () => {
    try {
      const response = await apiClient.getProfile()
      if (response.success && response.data) {
        setCurrentUserId(response.data.id)
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await apiClient.getUserSettings()
      if (response.success) {
        // response.data can sometimes be nested depending on backend wrapping. Fix double-nesting:
        let parsedData = response.data.data ? { ...response.data.data } : { ...response.data }

        // Ensure custom_measures is always an array in local state
        if (typeof parsedData.custom_measures === 'string') {
          try {
            parsedData.custom_measures = JSON.parse(parsedData.custom_measures)
          } catch (e) {
            parsedData.custom_measures = []
          }
        }
        if (!Array.isArray(parsedData.custom_measures)) {
          parsedData.custom_measures = []
        }

        // Ensure medical_acts is always an array
        if (typeof parsedData.medical_acts === 'string') {
          try { parsedData.medical_acts = JSON.parse(parsedData.medical_acts) } catch { parsedData.medical_acts = [] }
        }
        if (!Array.isArray(parsedData.medical_acts)) parsedData.medical_acts = []

        // Parse ordonnance_layout if it's a string
        if (typeof parsedData.ordonnance_layout === 'string') {
          try {
            parsedData.ordonnance_layout = JSON.parse(parsedData.ordonnance_layout)
          } catch (e) {
            parsedData.ordonnance_layout = null
          }
        }

        // Fix background URL (ensure use of proxy link for CORS)
        if (parsedData.ordonnance_background) {
          const backendBase = "http://127.0.0.1:8000"
          if (parsedData.ordonnance_background.includes('/storage/ordonnances/')) {
            const filename = parsedData.ordonnance_background.split('/').pop()
            parsedData.ordonnance_background = `${backendBase}/api/settings/ordonnance-background/${filename}`
          } else if (!parsedData.ordonnance_background.startsWith('http')) {
            parsedData.ordonnance_background = `${backendBase}${parsedData.ordonnance_background}`
          }
        }

        localStorage.setItem("app_settings", JSON.stringify(parsedData))
        setSettings(parsedData)
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await apiClient.getUsers()
      if (response.success && response.data) {
        // Handle nested data structure
        setUsers(Array.isArray(response.data) ? response.data : response.data.data || [])
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const fetchBackups = async () => {
    try {
      setBackupLoading(true)
      const response = await apiClient.listBackups()
      if (response.success && response.data) {
        setIsGoogleLinked(true)
        setBackups(response.data.backups || [])
      } else {
        setIsGoogleLinked(false)
      }
    } catch (error) {
      console.error("Error fetching backups:", error)
      setIsGoogleLinked(false)
    } finally {
      setBackupLoading(false)
    }
  }

  const handleLinkGoogle = async () => {
    let userId = currentUserId;
    if (!userId) {
      toast({ title: "Information", description: "Vérification de l'identité en cours..." })
      try {
        const response = await apiClient.getProfile()
        if (response.success && response.data) {
          userId = response.data.id
          setCurrentUserId(userId)
        }
      } catch (error) {
        console.error("Error fetching profile on click", error)
      }
    }

    if (!userId) {
      toast({ title: "Erreur", description: "Veuillez vous reconnecter pour lier votre compte Google.", variant: "destructive" })
      return
    }
    window.location.href = apiClient.getGoogleOAuthUrl(userId)
  }

  const handleCreateBackup = async () => {
    if (!backupPassword || backupPassword.length < 6) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 6 caractères", variant: "destructive" })
      return
    }
    try {
      setBackupLoading(true)
      const response = await apiClient.createBackup(backupPassword)
      if (response.success) {
        toast({ title: "Succès", description: "Sauvegarde créée avec succès" })
        setShowBackupDialog(false)
        setBackupPassword("")
        fetchBackups()
      } else {
        toast({ title: "Erreur", description: response.message || "Erreur de création", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Erreur", description: "Une erreur est survenue", variant: "destructive" })
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRestoreBackup = async () => {
    if (!backupPassword || backupPassword.length < 6) {
      toast({ title: "Erreur", description: "Mot de passe requis", variant: "destructive" })
      return
    }
    if (!selectedBackupId) return

    if (!confirm("Attention: Cette action écrasera vos données locales par les données de la sauvegarde (les données les plus récentes seront conservées). Continuer ?")) {
      return
    }

    try {
      setBackupLoading(true)
      const response = await apiClient.restoreBackup(selectedBackupId, backupPassword)
      if (response.success) {
        toast({ title: "Succès", description: "Données restaurées avec succès. Veuillez rafraîchir la page." })
        setShowRestoreDialog(false)
        setBackupPassword("")
      } else {
        toast({ title: "Erreur", description: response.message || "Mot de passe incorrect ou erreur réseau", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Erreur", description: "Une erreur est survenue", variant: "destructive" })
    } finally {
      setBackupLoading(false)
    }
  }

  // Helper: extract only the DB columns we care about, stripping any API wrapper fields
  const sanitizeSettings = (s: any) => {
    if (!s) return {}
    const { success, message, data, ...flat } = s
    // If the old state was { success, data: { real settings } }, flatten properly
    const base = data && typeof data === 'object' && !Array.isArray(data)
      ? { ...data, ...flat }
      : flat

    return base
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const payload = sanitizeSettings(settings)
      const response = await apiClient.updateUserSettings(payload)
      if (response.success) {
        // After save, refresh settings from backend to keep state in sync
        await fetchSettings()
        toast({
          title: "Succès",
          description: "Paramètres enregistrés avec succès",
        })
      } else {
        toast({
          title: "Erreur",
          description: response.message || "Erreur lors de l'enregistrement",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de l'enregistrement des paramètres",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateUser = async () => {
    try {
      const response = await apiClient.createUser(newUser)
      if (response.success) {
        toast({
          title: "Succès",
          description: "Utilisateur créé avec succès",
        })
        setShowUserDialog(false)
        setNewUser({ name: "", email: "", password: "", role: "nurse" })
        fetchUsers()
      } else {
        toast({
          title: "Erreur de validation",
          description: response.errors
            ? Object.values(response.errors).flat().join("\n")
            : (response.message || "Erreur lors de la création"),
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création de l'utilisateur",
        variant: "destructive",
      })
    }
  }

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return

    try {
      const response = await apiClient.deleteUser(id)
      if (response.success) {
        toast({
          title: "Succès",
          description: "Utilisateur supprimé avec succès",
        })
        fetchUsers()
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression",
        variant: "destructive",
      })
    }
  }

  const handleUserClick = (user: any) => {
    setSelectedUser(user)
    setShowPermissionsDialog(true)
  }

  const availableRoutes = [
    { id: "dashboard", label: "Tableau de Bord" },
    { id: "medecin", label: "Espace Médecin" },
    { id: "patients", label: "Patients" },
    { id: "medicaments", label: "Médicaments" },
    { id: "analyses", label: "Analyses" },
    { id: "statistics", label: "Statistiques" },
    { id: "settings", label: "Paramètres" },
  ]

  const togglePermission = (routeId: string) => {
    if (!selectedUser) return

    const currentPermissions = selectedUser.permissions ? JSON.parse(selectedUser.permissions) : []
    const newPermissions = currentPermissions.includes(routeId)
      ? currentPermissions.filter((p: string) => p !== routeId)
      : [...currentPermissions, routeId]

    setSelectedUser({
      ...selectedUser,
      permissions: JSON.stringify(newPermissions)
    })
  }

  const handleSavePermissions = async () => {
    if (!selectedUser) return

    try {
      const permissions = selectedUser.permissions ? JSON.parse(selectedUser.permissions) : []
      const response = await apiClient.updateUserPermissions(selectedUser.id, permissions)

      if (response.success) {
        toast({
          title: "Succès",
          description: "Permissions mises à jour avec succès",
        })
        setShowPermissionsDialog(false)
        fetchUsers()
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de la mise à jour des permissions",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#007090]" />
          <p className="text-sm">Chargement des paramètres…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#007090] to-[#005570] text-white shadow-lg shadow-cyan-900/20">
          <SettingsIcon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Paramètres</h1>
          <p className="text-gray-500 mt-1">Gérez vos préférences, votre équipe et vos sauvegardes</p>
        </div>
      </div>

      <Tabs defaultValue="preferences" className="space-y-6">
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <TabsList className="h-auto w-max inline-flex gap-1 rounded-xl border border-gray-100 bg-white p-1.5 shadow-sm">
            <TabsTrigger value="preferences" className={tabTriggerClass}>
              <SettingsIcon className="w-4 h-4" />
              Préférences
            </TabsTrigger>
            <TabsTrigger value="users" className={tabTriggerClass}>
              <Users className="w-4 h-4" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="ordonnance" className={tabTriggerClass}>
              <FileText className="w-4 h-4" />
              Ordonnance
            </TabsTrigger>
            <TabsTrigger value="backup" className={tabTriggerClass}>
              <Cloud className="w-4 h-4" />
              Sauvegarde & Sync
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="activity" className={tabTriggerClass}>
                <History className="w-4 h-4" />
                Journal
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          {/* Case Description Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                Mesures Personnalisées
              </CardTitle>
              <CardDescription>Ajoutez d'autres métriques à la consultation avec le code couleur (min/max)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Custom Measures Section */}
              </div>

              {/* Custom Measures Section */}
              <div className="pt-2">

                <div className="space-y-3">
                  {(Array.isArray(settings?.custom_measures) ? settings.custom_measures : []).map((measure: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-white border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs
                          ${measure.color === 'red' ? 'bg-red-100 text-red-600' :
                            measure.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                              measure.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                                measure.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                                  'bg-gray-100 text-gray-600'}`}
                        >
                          {measure.short}
                        </div>
                        <div>
                          <Label className="font-medium block">{measure.name}</Label>
                          <span className="text-xs text-gray-500">
                            {measure.choices ? `Choix: ${measure.choices}` : `Min: ${measure.min_value} | Max: ${measure.max_value}`}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const current = Array.isArray(settings?.custom_measures) ? [...settings.custom_measures] : [];
                          current.splice(idx, 1);
                          const newSettings = { ...settings, custom_measures: current };
                          setSettings(newSettings);
                          try {
                            await apiClient.updateUserSettings(sanitizeSettings(newSettings));
                            await fetchSettings();
                          } catch (e) {
                            console.error("Failed to auto-save settings", e);
                          }
                        }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="grid grid-cols-12 gap-2 mt-4 items-start bg-gray-50 p-3 rounded-lg border border-gray-200 border-dashed">
                    <Tabs value={measureType} onValueChange={(val: any) => setMeasureType(val)} className="col-span-12 w-full mb-2">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="standard">Standard (Min/Max)</TabsTrigger>
                        <TabsTrigger value="choice">Choix Multiples</TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="col-span-12 grid grid-cols-12 gap-2 items-end">
                      <div className={measureType === "choice" ? "col-span-4 space-y-1" : "col-span-3 space-y-1"}>
                        <Label className="text-xs">Nom complet</Label>
                        <Input
                          placeholder="Ex: SpO2"
                          className="h-8 text-sm"
                          value={newMeasure.name}
                          onChange={(e) => setNewMeasure({ ...newMeasure, name: e.target.value })}
                        />
                      </div>
                      <div className={measureType === "choice" ? "col-span-4 space-y-1" : "col-span-2 space-y-1"}>
                        <Label className="text-xs">Sigle</Label>
                        <Input
                          placeholder="Ex: O2"
                          maxLength={3}
                          className="h-8 text-sm"
                          value={newMeasure.short}
                          onChange={(e) => setNewMeasure({ ...newMeasure, short: e.target.value })}
                        />
                      </div>

                      {measureType === "standard" && (
                        <>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Min</Label>
                            <Input
                              type="text"
                              placeholder="Ex: 95"
                              className="h-8 text-sm"
                              value={newMeasure.min_value}
                              onChange={(e) => setNewMeasure({ ...newMeasure, min_value: e.target.value })}
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Max</Label>
                            <Input
                              type="text"
                              placeholder="Ex: 100"
                              className="h-8 text-sm"
                              value={newMeasure.max_value}
                              onChange={(e) => setNewMeasure({ ...newMeasure, max_value: e.target.value })}
                            />
                          </div>
                        </>
                      )}

                      <div className={measureType === "choice" ? "col-span-4 space-y-1" : "col-span-2 space-y-1"}>
                        <Label className="text-xs">Couleur</Label>
                        <Select value={newMeasure.color} onValueChange={(val) => setNewMeasure({ ...newMeasure, color: val })}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="red">Rouge</SelectItem>
                            <SelectItem value="blue">Bleu</SelectItem>
                            <SelectItem value="orange">Orange</SelectItem>
                            <SelectItem value="purple">Violet</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {measureType === "standard" && (
                        <div className="col-span-1">
                          <Button
                            type="button"
                            className="h-8 w-full bg-blue-600 hover:bg-blue-700 p-0 flex items-center justify-center"
                            onClick={async () => {
                              if (!newMeasure.name) {
                                toast({ title: "Erreur", description: "Le nom de la mesure est requis", variant: "destructive" });
                                return;
                              }
                              const current = Array.isArray(settings?.custom_measures) ? [...settings.custom_measures] : [];
                              current.push(newMeasure);
                              const newSettings = { ...settings, custom_measures: current };
                              setSettings(newSettings);
                              setNewMeasure({ name: "", short: "", min_value: "", max_value: "", choices: "", color: "red" });
                              try {
                                const res = await apiClient.updateUserSettings(sanitizeSettings(newSettings));
                                if (!res.success) {
                                  toast({ title: "Erreur API", description: res.message, variant: "destructive" });
                                } else {
                                  toast({ title: "Succès", description: "Mesure ajoutée." });
                                }
                                await fetchSettings();
                              } catch (e) {
                                console.error("Failed to auto-save settings", e);
                                toast({ title: "Erreur Inattendue", description: String(e), variant: "destructive" });
                              }
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {measureType === "choice" && (
                      <div className="col-span-12 mt-4 space-y-3 p-3 bg-white rounded border border-gray-200">
                        <Label className="text-xs font-semibold">Options de la liste déroulante</Label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="Ex: ++"
                            className="h-8 text-sm flex-1"
                            value={currentChoice}
                            onChange={(e) => setCurrentChoice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (currentChoice.trim() && !choicesList.includes(currentChoice.trim())) {
                                  setChoicesList([...choicesList, currentChoice.trim()]);
                                  setCurrentChoice("");
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            className="h-8 bg-gray-800 hover:bg-gray-900 text-xs"
                            onClick={() => {
                              if (currentChoice.trim() && !choicesList.includes(currentChoice.trim())) {
                                setChoicesList([...choicesList, currentChoice.trim()]);
                                setCurrentChoice("");
                              }
                            }}
                          >
                            Ajouter ce choix
                          </Button>
                        </div>

                        {choicesList.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2" style={{ minHeight: '32px' }}>
                            {choicesList.map((choice, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded text-xs font-semibold">
                                {choice}
                                <button
                                  type="button"
                                  className="text-blue-400 hover:text-red-500 rounded-full"
                                  onClick={() => setChoicesList(choicesList.filter((_, index) => index !== i))}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <Button
                          type="button"
                          className="h-8 w-full bg-blue-600 hover:bg-blue-700 mt-2"
                          onClick={async () => {
                            if (!newMeasure.name) {
                              toast({ title: "Erreur", description: "Le nom de la mesure est requis", variant: "destructive" });
                              return;
                            }
                            if (choicesList.length === 0) {
                              toast({ title: "Erreur", description: "Veuillez ajouter au moins un choix", variant: "destructive" });
                              return;
                            }
                            const finalMeasure = { ...newMeasure, choices: choicesList.join(',') };

                            const current = Array.isArray(settings?.custom_measures) ? [...settings.custom_measures] : [];
                            current.push(finalMeasure);
                            const newSettings = { ...settings, custom_measures: current };
                            setSettings(newSettings);

                            setNewMeasure({ name: "", short: "", min_value: "", max_value: "", choices: "", color: "red" });
                            setMeasureType("standard");
                            setChoicesList([]);
                            setCurrentChoice("");

                            try {
                              const res = await apiClient.updateUserSettings(sanitizeSettings(newSettings));
                              if (!res.success) {
                                toast({ title: "Erreur API", description: res.message, variant: "destructive" });
                              } else {
                                toast({ title: "Succès", description: "Mesure (Choix) ajoutée." });
                              }
                              await fetchSettings();
                            } catch (e) {
                              console.error("Failed to auto-save settings", e);
                              toast({ title: "Erreur Inattendue", description: String(e), variant: "destructive" });
                            }
                          }}
                        >
                          Enregistrer la mesure ({choicesList.length} choix)
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Default Prices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-600" />
                Prix par défaut
              </CardTitle>
              <CardDescription>Définissez les tarifs de base pour les actes de consultation et de contrôle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="consultation_price">Prix Consultation (DH)</Label>
                  <Input
                    id="consultation_price"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="250"
                    value={settings?.default_consultation_price ?? 250}
                    onChange={(e) => setSettings({ ...settings, default_consultation_price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="control_price">Prix Contrôle (DH)</Label>
                  <Input
                    id="control_price"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={settings?.default_control_price ?? 0}
                    onChange={(e) => setSettings({ ...settings, default_control_price: Number(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Control Appointment Defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-amber-600" />
                Rendez-vous de contrôle
              </CardTitle>
              <CardDescription>Nombre de jours proposé par défaut lors de l'ajout d'un contrôle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="control_days">Nombre de jours par défaut</Label>
                  <Input
                    id="control_days"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="90"
                    value={settings?.default_control_days ?? 90}
                    onChange={(e) => setSettings({ ...settings, default_control_days: Number(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical Acts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-blue-600" />
                Actes Médicaux
              </CardTitle>
              <CardDescription>Personnalisez la liste des actes et leurs tarifs affichés lors des consultations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* List */}
              <div className="space-y-2">
                {(Array.isArray(settings?.medical_acts) ? settings.medical_acts : []).map((act: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                    <span className="flex-1 text-sm font-medium text-gray-800">{act.name}</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={act.price}
                      onChange={(e) => {
                        const updated = [...(settings?.medical_acts ?? [])]
                        updated[idx] = { ...act, price: Number(e.target.value) }
                        setSettings({ ...settings, medical_acts: updated })
                      }}
                      className="w-28 h-8 text-sm text-right"
                    />
                    <span className="text-xs text-gray-400 w-6">DH</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        const updated = [...(settings?.medical_acts ?? [])]
                        updated.splice(idx, 1)
                        const next = { ...settings, medical_acts: updated }
                        setSettings(next)
                        try {
                          await apiClient.updateUserSettings(sanitizeSettings(next))
                          await fetchSettings()
                          toast({ title: "Succès", description: "Acte supprimé" })
                        } catch { toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" }) }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add new act */}
              <div className="flex gap-2 items-end pt-2 border-t">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Nom de l'acte</Label>
                  <Input
                    placeholder="Ex: Biopsie"
                    className="h-8 text-sm"
                    value={newAct.name}
                    onChange={(e) => setNewAct({ ...newAct, name: e.target.value })}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Prix (DH)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="h-8 text-sm"
                    value={newAct.price}
                    onChange={(e) => setNewAct({ ...newAct, price: e.target.value })}
                  />
                </div>
                <Button
                  className="h-8 bg-blue-600 hover:bg-blue-700 shrink-0"
                  disabled={!newAct.name.trim()}
                  onClick={async () => {
                    if (!newAct.name.trim()) return
                    const updated = [...(settings?.medical_acts ?? []), { name: newAct.name.trim(), price: Number(newAct.price) || 0 }]
                    const next = { ...settings, medical_acts: updated }
                    setSettings(next)
                    setNewAct({ name: "", price: "" })
                    try {
                      await apiClient.updateUserSettings(sanitizeSettings(next))
                      await fetchSettings()
                      toast({ title: "Succès", description: "Acte ajouté" })
                    } catch { toast({ title: "Erreur", description: "Impossible d'ajouter", variant: "destructive" }) }
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              </div>

              {/* Save prices button */}
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    try {
                      await apiClient.updateUserSettings(sanitizeSettings(settings))
                      await fetchSettings()
                      toast({ title: "Succès", description: "Tarifs des actes enregistrés" })
                    } catch { toast({ title: "Erreur", description: "Enregistrement échoué", variant: "destructive" }) }
                  }}
                >
                  <Save className="w-3 h-3 mr-1" />
                  Enregistrer les tarifs
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-rose-600" />
                Notifications
              </CardTitle>
              <CardDescription>Gérez vos préférences de notification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors">
                <div>
                  <Label>Notifications par email</Label>
                  <p className="text-sm text-gray-500">Recevoir des emails pour les nouveaux rendez-vous</p>
                </div>
                <Switch
                  checked={settings?.email_notifications ?? true}
                  onCheckedChange={(checked) => setSettings({ ...settings, email_notifications: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors">
                <div>
                  <Label>Rappels SMS aux patients</Label>
                  <p className="text-sm text-gray-500">Envoyer des rappels automatiques</p>
                </div>
                <Switch
                  checked={settings?.sms_reminders ?? true}
                  onCheckedChange={(checked) => setSettings({ ...settings, sms_reminders: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Timing des rappels</Label>
                <Select
                  value={settings?.reminder_timing || "1_day"}
                  onValueChange={(value) => setSettings({ ...settings, reminder_timing: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2_hours">2 heures avant</SelectItem>
                    <SelectItem value="1_day">1 jour avant</SelectItem>
                    <SelectItem value="2_days">2 jours avant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-cyan-600" />
                Affichage
              </CardTitle>
              <CardDescription>Personnalisez l'interface</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors">
                <div>
                  <Label>Afficher le champ DDR</Label>
                  <p className="text-sm text-gray-500">Afficher la Date des Dernières Règles dans les détails du rendez-vous</p>
                </div>
                <Switch
                  checked={settings?.show_ddr ?? true}
                  onCheckedChange={(checked) => setSettings({ ...settings, show_ddr: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors">
                <div>
                  <Label>Suggestions automatiques (Description du cas)</Label>
                  <p className="text-sm text-gray-500">
                    Proposer une complétion en gris pendant la saisie ; appuyez sur Tab pour l'accepter
                  </p>
                </div>
                <Switch
                  checked={settings?.case_autosuggest ?? true}
                  onCheckedChange={(checked) => setSettings({ ...settings, case_autosuggest: checked })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Langue</Label>
                  <Select
                    value={settings?.language || "fr"}
                    onValueChange={(value) => setSettings({ ...settings, language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Format de date</Label>
                  <Select
                    value={settings?.date_format || "DD/MM/YYYY"}
                    onValueChange={(value) => setSettings({ ...settings, date_format: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Format d'heure</Label>
                  <Select
                    value={settings?.time_format || "24h"}
                    onValueChange={(value) => setSettings({ ...settings, time_format: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">24 heures</SelectItem>
                      <SelectItem value="12h">12 heures (AM/PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-4 z-10 flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              size="lg"
              className="bg-[#007090] hover:bg-[#005570] shadow-lg shadow-cyan-900/20"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer les paramètres
            </Button>
          </div>
        </TabsContent>


        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#007090]" />
                    Gestion des Utilisateurs
                  </CardTitle>
                  <CardDescription>Ajoutez et gérez les infirmières et le personnel</CardDescription>
                </div>
                <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Nouvel utilisateur
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Nom complet</Label>
                        <Input
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          placeholder="Jean Dupont"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          placeholder="jean@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mot de passe</Label>
                        <Input
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rôle</Label>
                        <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nurse">Infirmière</SelectItem>
                            <SelectItem value="receptionist">Réceptionniste</SelectItem>
                            <SelectItem value="doctor">Médecin</SelectItem>
                            <SelectItem value="admin">Administrateur</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateUser} className="w-full bg-blue-600 hover:bg-blue-700">
                        Créer l'utilisateur
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {users && users.length > 0 ? (
                  users.map((user) => {
                    const userPermissions = user.permissions ? JSON.parse(user.permissions) : []
                    const meta = roleMeta(user.role)
                    const isAdminUser = user.role === "admin"
                    return (
                      <div
                        key={user.id}
                        className="group relative flex items-center justify-between gap-3 p-4 border border-gray-100 rounded-xl bg-white hover:border-[#007090]/30 hover:shadow-md cursor-pointer transition-all"
                        onClick={() => handleUserClick(user)}
                        title="Modifier les permissions"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`relative h-11 w-11 flex-shrink-0 rounded-full ${meta.avatar} flex items-center justify-center text-white font-semibold text-sm shadow-sm`}>
                            {userInitials(user.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{user.name}</p>
                            <p className="text-sm text-gray-500 truncate">{user.email}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>
                                {isAdminUser && <Shield className="w-3 h-3" />}
                                {meta.label}
                              </span>
                              {isAdminUser ? (
                                <span className="text-[11px] text-gray-400">Accès complet</span>
                              ) : userPermissions.length > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                                  <Lock className="w-3 h-3" />
                                  {userPermissions.length} accès
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400">Aucun accès</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUserClick(user)
                            }}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-[#007090] hover:bg-cyan-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Permissions"
                          >
                            <Lock className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteUser(user.id)
                            }}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Aucun utilisateur trouvé</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Permissions Dialog */}
          <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Gérer les permissions - {selectedUser?.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-gray-600">Sélectionnez les routes auxquelles cet utilisateur peut accéder:</p>
                <div className="space-y-2">
                  {availableRoutes.map((route) => {
                    const currentPermissions = selectedUser?.permissions ? JSON.parse(selectedUser.permissions) : []
                    const isChecked = currentPermissions.includes(route.id)

                    return (
                      <label
                        key={route.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(route.id)}
                          className="w-4 h-4 text-blue-600 border-2 border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{route.label}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSavePermissions}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Enregistrer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPermissionsDialog(false)}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Ordonnance Tab */}
        <TabsContent value="ordonnance" key={settings ? "loaded" : "loading"} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Configuration de l'Ordonnance
              </CardTitle>
              <CardDescription>
                Personnalisez l'emplacement des éléments sur votre papier d'ordonnance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrdonnanceLayoutEditor
                initialBackground={settings?.ordonnance_background}
                initialLayout={settings?.ordonnance_layout}
                onSave={async (background, layout) => {
                  setSaving(true)
                  try {
                    const newSettings = {
                      ...settings,
                      ordonnance_background: background,
                      ordonnance_layout: layout
                    }
                    const response = await apiClient.updateUserSettings(sanitizeSettings(newSettings))
                    if (response.success) {
                      await fetchSettings()
                      toast({ title: "Succès", description: "Configuration de l'ordonnance enregistrée" })
                    } else {
                      toast({ title: "Erreur", description: response.message || "Échec de l'enregistrement", variant: "destructive" })
                    }
                  } catch (error: any) {
                    toast({ title: "Erreur", description: error?.message || "Échec de l'enregistrement", variant: "destructive" })
                  } finally {
                    setSaving(false)
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup & Sync Tab */}
        <TabsContent value="backup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-600" />
                Sauvegarde Cloud Automatique
              </CardTitle>
              <CardDescription>
                Synchronisez et sauvegardez vos données de manière sécurisée (chiffrement de bout en bout) sur Google Drive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isGoogleLinked === null ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : !isGoogleLinked ? (
                <div className="text-center p-8 border-2 border-dashed rounded-lg bg-gray-50">
                  <Cloud className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Connecter Google Drive</h3>
                  <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                    Afin de protéger vos données, connectez votre compte Google. Vos données médicales seront chiffrées avec votre mot de passe avant d'être envoyées.
                  </p>
                  <Button onClick={handleLinkGoogle} className="bg-blue-600 hover:bg-blue-700">
                    Associer mon compte Google
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-green-900">Google Drive Connecté</p>
                        <p className="text-sm text-green-700">La sauvegarde automatique nocturne est active.</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleLinkGoogle} className="text-sm">
                      Changer de compte
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">Historique des Sauvegardes</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={fetchBackups} disabled={backupLoading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${backupLoading ? 'animate-spin' : ''}`} />
                        Actualiser
                      </Button>
                      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
                        <DialogTrigger asChild>
                          <Button className="bg-blue-600 hover:bg-blue-700">
                            <Cloud className="w-4 h-4 mr-2" />
                            Créer une sauvegarde
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Créer une sauvegarde chiffrée</DialogTitle>
                            <DialogDescription>
                              Vos données seront chiffrées avant l'envoi vers Google Drive. Seul ce mot de passe permettra de les restaurer.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Mot de passe de chiffrement</Label>
                              <div className="relative">
                                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                <Input
                                  type="password"
                                  className="pl-9"
                                  placeholder="Votre mot de passe"
                                  value={backupPassword}
                                  onChange={(e) => setBackupPassword(e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowBackupDialog(false)}>Annuler</Button>
                            <Button onClick={handleCreateBackup} disabled={backupLoading} className="bg-blue-600 hover:bg-blue-700">
                              {backupLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                              Sauvegarder
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    {backups.length > 0 ? (
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                          <tr>
                            <th className="px-6 py-3">Fichier</th>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Taille</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backups.map((backup) => (
                            <tr key={backup.drive_file_id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                                <Lock className="w-4 h-4 text-blue-500" />
                                {backup.file_name}
                              </td>
                              <td className="px-6 py-4 text-gray-600">
                                {new Date(backup.created_time).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-gray-600">
                                {(parseInt(backup.size) / 1024 / 1024).toFixed(2)} MB
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Button
                                  variant="ghost"
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 h-8 px-3"
                                  onClick={() => {
                                    setSelectedBackupId(backup.drive_file_id)
                                    setShowRestoreDialog(true)
                                  }}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Restaurer
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Aucune sauvegarde trouvée sur votre Google Drive</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Restore Dialog */}
          <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Restaurer une sauvegarde</DialogTitle>
                <DialogDescription>
                  Veuillez entrer le mot de passe utilisé lors de la création de cette sauvegarde pour la déchiffrer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Mot de passe de chiffrement</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                      type="password"
                      className="pl-9"
                      placeholder="Mot de passe"
                      value={backupPassword}
                      onChange={(e) => setBackupPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>Annuler</Button>
                <Button onClick={handleRestoreBackup} disabled={backupLoading} className="bg-red-600 hover:bg-red-700 text-white">
                  {backupLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Lancer la Restauration
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Activity Log Tab (admin only) */}
        {isAdmin && (
          <TabsContent value="activity" className="space-y-6">
            <ActivityLogPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
