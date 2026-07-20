import { useCallback, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as patientsApi from "@/src/api/patients";
import { colors } from "@/src/theme/colors";
import { brandGradient, cardShadow } from "@/src/theme/ui";
import type { AppointmentHistoryItem, Certificate, Patient, PatientDocument } from "@/src/types/patient";
import { showAlert } from "@/src/utils/alert";
import { computeAge } from "@/src/utils/date";
import { toDataUri } from "@/src/utils/image";

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const patientId = Number(id);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<AppointmentHistoryItem[]>([]);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [detailRes, docsRes, certsRes] = await Promise.all([
      patientsApi.getPatient(patientId),
      patientsApi.getPatientDocuments(patientId),
      patientsApi.getCertificates(patientId),
    ]);

    if (detailRes.success && detailRes.data) {
      setPatient(detailRes.data.patient);
      setHistory(detailRes.data.appointmentsHistory ?? []);
    } else {
      setError(detailRes.message ?? "Impossible de charger le patient");
    }

    if (docsRes.success && docsRes.data) setDocuments(docsRes.data.data ?? []);
    if (certsRes.success && certsRes.data) setCertificates(certsRes.data.certificates ?? []);

    setIsLoading(false);
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleArchiveToggle() {
    if (!patient) return;
    const nextArchived = !patient.archived;
    const response = await patientsApi.archivePatient(patient.ID_patient, nextArchived);
    if (response.success) {
      setPatient({ ...patient, archived: nextArchived ? 1 : 0 });
    } else {
      showAlert("Erreur", response.message ?? "Échec de l'archivage");
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !patient) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={16} color={colors.dangerText} />
          <Text style={styles.errorText}>{error ?? "Patient introuvable"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const age = computeAge(patient.birth_day);
  const isMinor = !patient.CIN && !!patient.guardian_cin;
  const isMale = patient.gender === "Male";
  const genderColors = isMale ? colors.male : colors.female;

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ title: `${patient.first_name} ${patient.last_name}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[...brandGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          {patient.photo_base64 ? (
            <Image source={{ uri: toDataUri(patient.photo_base64)! }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: genderColors.bg }]}>
              <Feather name="user" size={32} color={genderColors.text} />
            </View>
          )}
          <Text style={styles.name}>
            {patient.first_name} {patient.last_name}
          </Text>
          <View style={styles.heroBadges}>
            <View style={styles.heroBadge}>
              <Feather name="credit-card" size={11} color={colors.white} />
              <Text style={styles.heroBadgeText}>{isMinor ? "Mineur" : patient.CIN}</Text>
            </View>
            {age !== null && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{age} ans</Text>
              </View>
            )}
            {!!patient.blood_type && (
              <View style={[styles.heroBadge, styles.bloodBadge]}>
                <Feather name="droplet" size={11} color={colors.white} />
                <Text style={styles.heroBadgeText}>{patient.blood_type}</Text>
              </View>
            )}
          </View>
          {!!patient.archived && (
            <View style={styles.archivedBadge}>
              <Text style={styles.archivedBadgeText}>Archivé</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => router.push(`/(app)/appointments/new?patientId=${patientId}`)}
          >
            <Feather name="calendar" size={15} color={colors.white} />
            <Text style={styles.actionButtonText} numberOfLines={1}>Nouveau RV</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={() => router.push(`/(app)/patients/${patientId}/edit`)}
          >
            <Feather name="edit-2" size={15} color={colors.gray700} />
            <Text style={styles.secondaryButtonText} numberOfLines={1}>Modifier</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={handleArchiveToggle}
          >
            <Feather name={patient.archived ? "rotate-ccw" : "archive"} size={15} color={colors.gray700} />
            <Text style={styles.secondaryButtonText} numberOfLines={1}>
              {patient.archived ? "Désarchiver" : "Archiver"}
            </Text>
          </Pressable>
        </View>

        <Section title="Contact" icon="user">
          <InfoRow label="Téléphone" value={patient.phone_num} />
          <InfoRow label="Email" value={patient.email} />
          {isMinor && <InfoRow label="CIN tuteur" value={patient.guardian_cin} />}
          {isMinor && (
            <InfoRow label="Relation" value={patient.guardian_relation === "father" ? "Père" : "Mère"} />
          )}
        </Section>

        <Section title="Informations médicales" icon="heart">
          <InfoRow label="Groupe sanguin" value={patient.blood_type} />
          <InfoRow label="Mutuelle" value={patient.mutuelle} />
          <InfoRow label="Allergies" value={patient.allergies} />
          <InfoRow label="Maladies chroniques" value={patient.chronic_conditions} />
          <InfoRow label="Notes" value={patient.notes} />
        </Section>

        <Section title="Historique des rendez-vous" icon="calendar">
          {history.length === 0 ? (
            <Text style={styles.empty}>Aucun rendez-vous</Text>
          ) : (
            history.map((appt) => (
              <View key={appt.ID_RV} style={styles.listRow}>
                <Text style={styles.listRowTitle}>
                  {appt.appointment_date} {appt.type ? `· ${appt.type}` : ""}
                </Text>
                {appt.status && <Text style={styles.listRowMeta}>{appt.status}</Text>}
              </View>
            ))
          )}
        </Section>

        <Section title="Certificats" icon="file-text">
          {certificates.length === 0 ? (
            <Text style={styles.empty}>Aucun certificat</Text>
          ) : (
            certificates.map((cert) => (
              <View key={cert.ID_CM} style={styles.listRow}>
                <Text style={styles.listRowTitle}>
                  Du {cert.start_date} au {cert.end_date}
                </Text>
              </View>
            ))
          )}
        </Section>

        <Section title="Documents" icon="paperclip">
          {documents.length === 0 ? (
            <Text style={styles.empty}>Aucun document</Text>
          ) : (
            documents.map((doc) => (
              <View key={doc.id} style={styles.listRow}>
                <Text style={styles.listRowTitle}>{doc.document_name}</Text>
                <Text style={styles.listRowMeta}>{doc.document_type}</Text>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIconChip}>
          <Feather name={icon} size={14} color={colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: 16, paddingBottom: 48 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    margin: 16,
    padding: 12,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
  },
  errorText: { color: colors.dangerText, fontSize: 13, flexShrink: 1 },
  heroCard: {
    alignItems: "center",
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 16,
    marginBottom: 14,
    ...cardShadow,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.6)",
  },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 21, fontWeight: "800", color: colors.white, letterSpacing: 0.3 },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 10 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bloodBadge: { backgroundColor: "rgba(239,68,68,0.55)" },
  heroBadgeText: { fontSize: 12, fontWeight: "700", color: colors.white },
  archivedBadge: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 10,
  },
  archivedBadgeText: { fontSize: 12, fontWeight: "700", color: colors.dangerText },
  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    ...cardShadow,
  },
  actionButtonPressed: { backgroundColor: colors.accentDark },
  actionButtonText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  secondaryButton: { backgroundColor: colors.white },
  secondaryButtonPressed: { backgroundColor: colors.gray50 },
  secondaryButtonText: { color: colors.gray700, fontWeight: "700", fontSize: 13 },
  section: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...cardShadow,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionIconChip: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.indigo50,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.gray900 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  infoLabel: { color: colors.gray500, fontSize: 13, fontWeight: "500" },
  infoValue: { color: colors.gray900, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  empty: { color: colors.gray400, fontStyle: "italic", fontSize: 13 },
  listRow: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100 },
  listRowTitle: { fontSize: 13, color: colors.gray900, fontWeight: "600" },
  listRowMeta: { fontSize: 12, color: colors.gray500, marginTop: 2 },
});
