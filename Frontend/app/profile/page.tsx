"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { apiClient, UserProfile } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

// Icons - unchanged
const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const MailIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)

const PhoneIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const MapPinIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const AwardIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21,13.89 7,23 12,20 17,23 15.79,13.88" />
  </svg>
)

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [profile, setProfile] = useState<UserProfile>({
    id: 0,
    name: "",
    email: "",
    phone: "",
    address: "",
    specialization: "",
    license: "",
    experience: "",
    education: "",
    bio: "",
    avatar: "",
  })

  // We keep a separate state for editing to allow cancellation
  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const result = await apiClient.getProfile()
      if (result.success && result.data) {
        // Ensure all fields are strings (handling nulls)
        const data = result.data
        const sanitizedProfile: UserProfile = {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone || "",
          address: data.address || "",
          specialization: data.specialization || "Médecin",
          license: data.license || "",
          experience: data.experience || "",
          education: data.education || "",
          bio: data.bio || "",
          avatar: data.avatar || "",
        }
        setProfile(sanitizedProfile)
        setEditedProfile(sanitizedProfile)
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de charger le profil.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const result = await apiClient.updateProfile(editedProfile)
      if (result.success && result.data?.user) {
        const data = result.data.user
        const sanitizedProfile: UserProfile = {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone || "",
          address: data.address || "",
          specialization: data.specialization || "Médecin",
          license: data.license || "",
          experience: data.experience || "",
          education: data.education || "",
          bio: data.bio || "",
          avatar: data.avatar || "",
        }
        setProfile(sanitizedProfile)
        setEditedProfile(sanitizedProfile) // Sync edited state
        setIsEditing(false)
        toast({
          title: "Succès",
          description: "Profil mis à jour avec succès.",
        })
        // Force refresh to update header name if changed (optional, requires context or reload)
        // window.location.reload() // A bit aggressive, avoid if possible
      } else {
        toast({
          title: "Erreur",
          description: result.message || "Erreur lors de la sauvegarde.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      })
    }
  }

  const handleCancel = () => {
    setEditedProfile(profile)
    setIsEditing(false)
  }

  const stats = [
    { label: "Patients traités", value: "1,247", icon: <UserIcon /> },
    { label: "Rendez-vous ce mois", value: "89", icon: <CalendarIcon /> },
    { label: "Années d'expérience", value: profile.experience ? parseInt(profile.experience) || 15 : "15", icon: <AwardIcon /> },
    { label: "Taux de satisfaction", value: "98%", icon: <AwardIcon /> },
  ]

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 pl-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pl-64">
      <div className="pg-stagger p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <UserIcon />
            Mon Profil
          </h1>
          <p className="text-gray-600 mt-2">Gérez vos informations personnelles et professionnelles</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile.avatar || "/placeholder.svg"} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {profile.name
                        ? profile.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                        : "DR"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <CardTitle className="text-xl">{profile.name}</CardTitle>
                <CardDescription className="flex items-center justify-center gap-1">
                  <Badge variant="secondary">{profile.specialization}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <MailIcon className="text-gray-500" />
                  <span>{profile.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <PhoneIcon className="text-gray-500" />
                  <span>{profile.phone || "Non renseigné"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPinIcon className="text-gray-500" />
                  <span>{profile.address || "Non renseigné"}</span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Licence:</span>
                    <span className="font-medium">{profile.license || "N/A"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Expérience:</span>
                    <span className="font-medium">{profile.experience || "N/A"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              {stats.map((stat, index) => (
                <Card key={index}>
                  <CardContent className="p-4 text-center">
                    <div className="flex justify-center mb-2 text-blue-600">{stat.icon}</div>
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-xs text-gray-500">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Informations Personnelles</CardTitle>
                  <CardDescription>Gérez vos informations personnelles et professionnelles</CardDescription>
                </div>
                <Button
                  variant={isEditing ? "outline" : "default"}
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2"
                >
                  <EditIcon />
                  {isEditing ? "Annuler" : "Modifier"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom complet</Label>
                    <Input
                      id="name"
                      value={isEditing ? editedProfile.name : profile.name}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, name: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={isEditing ? editedProfile.email : profile.email}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, email: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      value={isEditing ? editedProfile.phone : profile.phone}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialization">Spécialisation</Label>
                    <Input
                      id="specialization"
                      value={isEditing ? editedProfile.specialization : profile.specialization}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, specialization: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license">Numéro de licence</Label>
                    <Input
                      id="license"
                      value={isEditing ? editedProfile.license : profile.license}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, license: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experience">Expérience</Label>
                    <Input
                      id="experience"
                      value={isEditing ? editedProfile.experience : profile.experience}
                      onChange={(e) => setEditedProfile((prev) => ({ ...prev, experience: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    value={isEditing ? editedProfile.address : profile.address}
                    onChange={(e) => setEditedProfile((prev) => ({ ...prev, address: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="education">Formation</Label>
                  <Input
                    id="education"
                    value={isEditing ? editedProfile.education : profile.education}
                    onChange={(e) => setEditedProfile((prev) => ({ ...prev, education: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Biographie</Label>
                  <Textarea
                    id="bio"
                    rows={4}
                    value={isEditing ? editedProfile.bio : profile.bio}
                    onChange={(e) => setEditedProfile((prev) => ({ ...prev, bio: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Décrivez votre parcours professionnel..."
                  />
                </div>

                {isEditing && (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleCancel}>
                      Annuler
                    </Button>
                    <Button onClick={handleSave}>Sauvegarder</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
