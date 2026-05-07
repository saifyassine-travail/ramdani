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
import { Loader2, Users, Settings as SettingsIcon, Save, Plus, Trash2, Edit, Cloud, Download, Lock, RefreshCw, AlertCircle, CheckCircle2, FileText } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import OrdonnanceLayoutEditor from "@/components/ordonnance-layout-editor"

export default function SettingsPage() {
  const { toast } = useToast()
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Paramètres</h1>
        <p className="text-gray-500 mt-2">Gérez vos préférences et utilisateurs</p>
      </div>

      <Tabs defaultValue="preferences" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="preferences">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Préférences
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="ordonnance">
            <FileText className="w-4 h-4 mr-2" />
            Ordonnance
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Cloud className="w-4 h-4 mr-2" />
            Sauvegarde & Sync
          </TabsTrigger>
        </TabsList>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          {/* Case Description Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Mesures Personnalisées</CardTitle>
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

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Gérez vos préférences de notification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label>Notifications par email</Label>
                  <p className="text-sm text-gray-500">Recevoir des emails pour les nouveaux rendez-vous</p>
                </div>
                <Switch
                  checked={settings?.email_notifications ?? true}
                  onCheckedChange={(checked) => setSettings({ ...settings, email_notifications: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
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
              <CardTitle>Affichage</CardTitle>
              <CardDescription>Personnalisez l'interface</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
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
                  <CardTitle>Gestion des Utilisateurs</CardTitle>
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
              <div className="space-y-4">
                {users && users.length > 0 ? (
                  users.map((user) => {
                    const userPermissions = user.permissions ? JSON.parse(user.permissions) : []
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleUserClick(user)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            {userPermissions.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {userPermissions.slice(0, 3).map((permission: string) => (
                                  <span key={permission} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                    {permission}
                                  </span>
                                ))}
                                {userPermissions.length > 3 && (
                                  <span className="text-xs text-gray-500">+{userPermissions.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            {user.role}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteUser(user.id)
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun utilisateur trouvé</p>
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
              <CardTitle>Configuration de l'Ordonnance</CardTitle>
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
      </Tabs>
    </div>
  )
}
