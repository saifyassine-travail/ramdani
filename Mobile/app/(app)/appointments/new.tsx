import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as appointmentsApi from "@/src/api/appointments";
import * as patientsApi from "@/src/api/patients";
import { CalendarPicker } from "@/src/components/CalendarPicker";
import { colors } from "@/src/theme/colors";
import type { AppointmentType } from "@/src/types/appointment";
import type { PatientSearchResult } from "@/src/types/patient";
import { toIsoDate } from "@/src/utils/date";

function formatDisplayDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export default function NewAppointmentScreen() {
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const router = useRouter();
  const lockedPatientId = patientId ? Number(patientId) : null;

  const [selectedPatient, setSelectedPatient] = useState<{ id: number; name: string } | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);

  const [type, setType] = useState<AppointmentType>("Consultation");
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const now = new Date();
  const [hour, setHour] = useState(String(now.getHours()).padStart(2, "0"));
  const [minute, setMinute] = useState(String(now.getMinutes()).padStart(2, "0"));
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!lockedPatientId) return;
    (async () => {
      const response = await patientsApi.getPatient(lockedPatientId);
      if (response.success && response.data) {
        const p = response.data.patient;
        setSelectedPatient({ id: p.ID_patient, name: `${p.first_name} ${p.last_name}` });
      }
    })();
  }, [lockedPatientId]);

  useEffect(() => {
    if (lockedPatientId) return;
    const term = patientQuery.trim();
    if (term.length < 2) {
      setPatientResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearchingPatients(true);
      const response = await patientsApi.searchPatients(term, false);
      if (response.success && response.data) setPatientResults(response.data);
      setIsSearchingPatients(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [patientQuery, lockedPatientId]);

  async function handleSubmit() {
    setFormError(null);

    if (!selectedPatient) {
      setFormError("Veuillez sélectionner un patient");
      return;
    }
    const h = Number(hour);
    const m = Number(minute);
    if (Number.isNaN(h) || h < 0 || h > 23 || Number.isNaN(m) || m < 0 || m > 59) {
      setFormError("Heure invalide");
      return;
    }

    const appointmentDate = `${date} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;

    setIsSubmitting(true);
    const response = await appointmentsApi.createAppointment({
      patient_id: selectedPatient.id,
      type,
      appointment_date: appointmentDate,
      notes: notes.trim() || null,
    });
    setIsSubmitting(false);

    if (response.success && response.data?.appointment) {
      router.replace(`/(app)/appointments/${response.data.appointment.ID_RV}`);
    } else {
      setFormError(response.message ?? "Échec de la création du rendez-vous");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ title: "Nouveau rendez-vous" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>Patient</Text>
        {selectedPatient ? (
          <View style={styles.selectedPatient}>
            <Feather name="user" size={16} color={colors.indigo700} />
            <Text style={styles.selectedPatientText}>{selectedPatient.name}</Text>
            {!lockedPatientId && (
              <Pressable onPress={() => setSelectedPatient(null)} hitSlop={8}>
                <Feather name="x" size={16} color={colors.gray500} />
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Rechercher un patient..."
              placeholderTextColor={colors.gray400}
              value={patientQuery}
              onChangeText={setPatientQuery}
              autoCapitalize="none"
            />
            {isSearchingPatients && <ActivityIndicator style={{ marginBottom: 12 }} color={colors.primary} />}
            {patientResults.length > 0 && (
              <View style={styles.resultsBox}>
                {patientResults.map((p) => (
                  <Pressable
                    key={p.ID_patient}
                    style={styles.resultRow}
                    onPress={() => {
                      setSelectedPatient({ id: p.ID_patient, name: `${p.first_name} ${p.last_name}` });
                      setPatientResults([]);
                      setPatientQuery("");
                    }}
                  >
                    <Text style={styles.resultName}>
                      {p.first_name} {p.last_name}
                    </Text>
                    {!!p.phone && <Text style={styles.resultMeta}>{p.phone}</Text>}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={styles.label}>Type</Text>
        <View style={styles.row}>
          <Chip label="Consultation" selected={type === "Consultation"} onPress={() => setType("Consultation")} />
          <Chip label="Contrôle" selected={type === "Control"} onPress={() => setType("Control")} />
        </View>

        <Text style={styles.label}>Date</Text>
        <Pressable style={[styles.input, styles.dateInput]} onPress={() => setShowDatePicker(true)}>
          <Feather name="calendar" size={16} color={colors.gray400} />
          <Text style={styles.dateText}>{formatDisplayDate(date)}</Text>
        </Pressable>
        <CalendarPicker
          visible={showDatePicker}
          value={date}
          minimumDate={new Date()}
          onSelect={(iso) => {
            setDate(iso);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />

        <Text style={styles.label}>Heure</Text>
        <View style={styles.timeRow}>
          <TextInput
            style={styles.timeInput}
            value={hour}
            onChangeText={setHour}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Text style={styles.timeSeparator}>:</Text>
          <TextInput
            style={styles.timeInput}
            value={minute}
            onChangeText={setMinute}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Notes additionnelles..."
          placeholderTextColor={colors.gray400}
        />

        {formError && <Text style={styles.error}>{formError}</Text>}

        <Pressable
          style={[styles.submitButton, isSubmitting && styles.disabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Planifier</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 13, fontWeight: "700", color: colors.gray700, marginBottom: 6 },
  input: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.gray900,
    marginBottom: 14,
  },
  multilineInput: { minHeight: 70, textAlignVertical: "top" },
  dateInput: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateText: { fontSize: 15, color: colors.gray900 },
  selectedPatient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.indigo300,
    backgroundColor: colors.indigo50,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  selectedPatientText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.gray900 },
  resultsBox: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 8,
    marginTop: -8,
    marginBottom: 14,
    maxHeight: 180,
    overflow: "hidden",
  },
  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  resultName: { fontSize: 14, fontWeight: "600", color: colors.gray900 },
  resultMeta: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  row: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: { backgroundColor: colors.gray100, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { color: colors.gray600, fontWeight: "600" },
  chipTextSelected: { color: colors.white, fontWeight: "700" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  timeInput: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray900,
    width: 64,
    textAlign: "center",
  },
  timeSeparator: { fontSize: 18, fontWeight: "700", color: colors.gray500 },
  error: { color: colors.danger, marginBottom: 12, textAlign: "center" },
  submitButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  disabled: { opacity: 0.6 },
  submitButtonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
});
