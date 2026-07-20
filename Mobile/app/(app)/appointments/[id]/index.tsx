import { useCallback, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as appointmentsApi from "@/src/api/appointments";
import { colors } from "@/src/theme/colors";
import { cardShadow } from "@/src/theme/ui";
import { STATUS_OPTIONS, statusColorFor, typeLabel, type Appointment } from "@/src/types/appointment";
import { confirmAlert, showAlert } from "@/src/utils/alert";

function formatDateTime(appointmentDate: string): { date: string; time: string } {
  const parsed = new Date(appointmentDate.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return { date: appointmentDate, time: "" };
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const time = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  return { date: `${day}/${month}/${parsed.getFullYear()}`, time };
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const appointmentId = Number(id);

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [diagnostic, setDiagnostic] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const response = await appointmentsApi.getAppointment(appointmentId);
    if (response.success && response.data) {
      const appt = response.data.data.appointment;
      setAppointment(appt);
      setDiagnostic(appt.diagnostic ?? "");
      setNotes(appt.notes ?? "");
    } else {
      setError(response.message ?? "Impossible de charger le rendez-vous");
    }
    setIsLoading(false);
  }, [appointmentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleStatusChange(statusKey: (typeof STATUS_OPTIONS)[number]["key"]) {
    if (!appointment) return;
    setIsSavingStatus(true);
    const response = await appointmentsApi.updateAppointmentStatus(appointment.ID_RV, statusKey);
    setIsSavingStatus(false);
    if (response.success && response.data?.status) {
      setAppointment({ ...appointment, status: response.data.status as Appointment["status"] });
    } else {
      showAlert("Erreur", response.message ?? "Échec de la mise à jour du statut");
    }
  }

  async function handleSaveDetails() {
    if (!appointment) return;
    setIsSavingDetails(true);
    const response = await appointmentsApi.updateAppointment(appointment.ID_RV, {
      diagnostic: diagnostic.trim() || null,
      notes: notes.trim() || null,
    });
    setIsSavingDetails(false);
    if (!response.success) {
      showAlert("Erreur", response.message ?? "Échec de l'enregistrement");
    }
  }

  function handleDelete() {
    if (!appointment) return;
    confirmAlert(
      "Supprimer le rendez-vous",
      "Cette action est irréversible. Voulez-vous continuer ?",
      "Supprimer",
      async () => {
        const response = await appointmentsApi.deleteAppointment(appointment.ID_RV);
        if (response.success) {
          router.back();
        } else {
          showAlert("Erreur", response.message ?? "Échec de la suppression");
        }
      },
      true,
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !appointment) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={16} color={colors.dangerText} />
          <Text style={styles.errorText}>{error ?? "Rendez-vous introuvable"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { date, time } = formatDateTime(appointment.appointment_date);
  const statusColor = statusColorFor(appointment.status);
  const patient = appointment.patient;

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ title: `RV #${appointment.ID_RV}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        {patient && (
          <Pressable
            style={({ pressed }) => [styles.patientCard, pressed && styles.patientCardPressed]}
            onPress={() => router.push(`/(app)/patients/${patient.ID_patient}`)}
          >
            <View style={styles.patientAvatar}>
              <Text style={styles.patientAvatarText}>
                {`${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>
                {patient.first_name} {patient.last_name}
              </Text>
              {!!patient.phone_num && <Text style={styles.patientMeta}>{patient.phone_num}</Text>}
            </View>
            <View style={styles.chevronCircle}>
              <Feather name="chevron-right" size={16} color={colors.primary} />
            </View>
          </Pressable>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoBlock}>
            <Feather name="calendar" size={15} color={colors.primary} />
            <Text style={styles.infoText}>{date}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoBlock}>
            <Feather name="clock" size={15} color={colors.primary} />
            <Text style={styles.infoText}>{time}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoBlock}>
            <Feather name="activity" size={15} color={colors.primary} />
            <Text style={styles.infoText}>{typeLabel(appointment.type)}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Statut</Text>
            <View style={[styles.currentStatusPill, { backgroundColor: statusColor.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor.border }]} />
              <Text style={[styles.currentStatusText, { color: statusColor.text }]}>{appointment.status}</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((opt) => {
              const active = opt.label === appointment.status;
              return (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.statusChip,
                    { borderColor: opt.color.border },
                    active && { backgroundColor: opt.color.bg },
                  ]}
                  disabled={isSavingStatus}
                  onPress={() => handleStatusChange(opt.key)}
                >
                  <Text style={[styles.statusChipText, { color: opt.color.text }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Diagnostic</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={diagnostic}
            onChangeText={setDiagnostic}
            multiline
            placeholder="Diagnostic..."
            placeholderTextColor={colors.gray400}
          />

          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Notes..."
            placeholderTextColor={colors.gray400}
          />

          <Pressable
            style={[styles.saveButton, isSavingDetails && styles.disabled]}
            onPress={handleSaveDetails}
            disabled={isSavingDetails}
          >
            {isSavingDetails ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Feather name="check" size={16} color={colors.white} />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </>
            )}
          </Pressable>
        </View>

        <Pressable style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]} onPress={handleDelete}>
          <Feather name="trash-2" size={15} color={colors.danger} />
          <Text style={styles.deleteButtonText}>Supprimer le rendez-vous</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
  patientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...cardShadow,
  },
  patientCardPressed: { backgroundColor: colors.gray50 },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.indigo100,
    alignItems: "center",
    justifyContent: "center",
  },
  patientAvatarText: { fontSize: 15, fontWeight: "800", color: colors.indigo700 },
  patientName: { fontSize: 15, fontWeight: "700", color: colors.gray900 },
  patientMeta: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.indigo50,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 12,
    ...cardShadow,
  },
  infoBlock: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: colors.gray200 },
  infoText: { fontSize: 13, color: colors.gray800, fontWeight: "600" },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...cardShadow,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.gray900, marginBottom: 8 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  statusChipText: { fontSize: 12, fontWeight: "700" },
  currentStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  currentStatusText: { fontSize: 11, fontWeight: "700" },
  input: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.gray900,
    marginBottom: 14,
  },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  saveButton: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  disabled: { opacity: 0.6 },
  saveButtonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  deleteButtonPressed: { backgroundColor: colors.dangerBg },
  deleteButtonText: { color: colors.danger, fontWeight: "700", fontSize: 14 },
});
