import { useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { extractCin } from "@/src/api/cin";
import { CalendarPicker } from "@/src/components/CalendarPicker";
import { colors } from "@/src/theme/colors";
import type { BloodType, Patient, PatientInput } from "@/src/types/patient";
import { showAlert } from "@/src/utils/alert";
import { computeAge } from "@/src/utils/date";
import { toDataUri } from "@/src/utils/image";

const BLOOD_TYPES: BloodType[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function formatDisplayDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

interface PatientFormProps {
  initialData?: Patient;
  onSubmit: (data: PatientInput) => Promise<{ success: boolean; message?: string }>;
  submitLabel: string;
}

export function PatientForm({ initialData, onSubmit, submitLabel }: PatientFormProps) {
  const [firstName, setFirstName] = useState(initialData?.first_name ?? "");
  const [lastName, setLastName] = useState(initialData?.last_name ?? "");
  const [gender, setGender] = useState<"Male" | "Female">(initialData?.gender ?? "Male");
  const [birthDay, setBirthDay] = useState(initialData?.birth_day ?? "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [cin, setCin] = useState(initialData?.CIN ?? "");
  const [guardianCin, setGuardianCin] = useState(initialData?.guardian_cin ?? "");
  const [guardianRelation, setGuardianRelation] = useState<"father" | "mother">(
    initialData?.guardian_relation ?? "father",
  );
  const [phoneNum, setPhoneNum] = useState(initialData?.phone_num ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [mutuelle, setMutuelle] = useState(initialData?.mutuelle ?? "");
  const [allergies, setAllergies] = useState(initialData?.allergies ?? "");
  const [chronicConditions, setChronicConditions] = useState(initialData?.chronic_conditions ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [bloodType, setBloodType] = useState<BloodType | null>(initialData?.blood_type ?? null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(initialData?.photo_base64 ?? null);

  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isMinor = useMemo(() => (computeAge(birthDay) ?? 99) < 18, [birthDay]);

  async function handleScanCin() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert("Permission requise", "L'accès à la caméra est nécessaire pour scanner une CIN.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setIsScanning(true);
    setFormError(null);

    const response = await extractCin({
      uri: asset.uri,
      name: "cin.jpg",
      type: "image/jpeg",
    });

    setIsScanning(false);

    if (!response.success || !response.data) {
      setFormError(response.message ?? "Échec du scan de la CIN");
      return;
    }

    const { data, photo_base64 } = response.data;
    if (data.first_name) setFirstName(data.first_name);
    if (data.last_name) setLastName(data.last_name);
    if (data.cin_number) setCin(data.cin_number);
    if (data.date_of_birth) setBirthDay(data.date_of_birth);
    if (photo_base64) setPhotoBase64(photo_base64);
  }

  async function handleSubmit() {
    setFormError(null);

    if (!firstName.trim() || !lastName.trim() || !birthDay.trim() || !phoneNum.trim()) {
      setFormError("Prénom, nom, date de naissance et téléphone sont requis");
      return;
    }
    if (!isMinor && !cin.trim()) {
      setFormError("Le CIN est requis pour un patient majeur");
      return;
    }
    if (isMinor && !guardianCin.trim()) {
      setFormError("Le CIN du tuteur est requis pour un patient mineur");
      return;
    }

    const payload: PatientInput = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      birth_day: birthDay,
      gender,
      phone_num: phoneNum.trim(),
      email: email.trim() || null,
      mutuelle: mutuelle.trim() || null,
      allergies: allergies.trim() || null,
      chronic_conditions: chronicConditions.trim() || null,
      notes: notes.trim() || null,
      blood_type: bloodType,
      photo_base64: photoBase64,
      CIN: isMinor ? null : cin.trim(),
      guardian_cin: isMinor ? guardianCin.trim() : null,
      guardian_relation: isMinor ? guardianRelation : null,
    };

    setIsSubmitting(true);
    const result = await onSubmit(payload);
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.message ?? "Échec de l'enregistrement");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {photoBase64 && (
        <View style={styles.avatarPreviewSection}>
          <Image source={{ uri: toDataUri(photoBase64)! }} style={styles.avatar} />
        </View>
      )}

      <View style={styles.scanBox}>
        <View style={styles.scanBoxTextRow}>
          <Feather name="camera" size={18} color={colors.indigo600} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scanBoxTitle}>Scanner la carte d'identité (CIN)</Text>
            <Text style={styles.scanBoxSubtitle}>
              Remplit automatiquement le nom, la date de naissance et le CIN.
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}
          onPress={handleScanCin}
          disabled={isScanning}
        >
          {isScanning ? (
            <ActivityIndicator color={colors.indigo700} />
          ) : (
            <>
              <Feather name="camera" size={15} color={colors.indigo700} />
              <Text style={styles.scanButtonText}>Scanner la CIN</Text>
            </>
          )}
        </Pressable>
      </View>

      <Field label="Prénom" value={firstName} onChangeText={setFirstName} />
      <Field label="Nom" value={lastName} onChangeText={setLastName} />

      <Text style={styles.label}>Genre</Text>
      <View style={styles.row}>
        <Chip label="Homme" selected={gender === "Male"} onPress={() => setGender("Male")} />
        <Chip label="Femme" selected={gender === "Female"} onPress={() => setGender("Female")} />
      </View>

      <Text style={styles.label}>Date de naissance</Text>
      <Pressable
        style={[styles.input, styles.dateInput]}
        onPress={() => setShowDatePicker(true)}
      >
        <Feather name="calendar" size={16} color={colors.gray400} />
        <Text style={birthDay ? styles.dateText : styles.datePlaceholder}>
          {formatDisplayDate(birthDay) || "Sélectionner une date"}
        </Text>
      </Pressable>
      <CalendarPicker
        visible={showDatePicker}
        value={birthDay}
        maximumDate={new Date()}
        onSelect={(iso) => {
          setBirthDay(iso);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {isMinor ? (
        <>
          <Field label="CIN du tuteur" value={guardianCin} onChangeText={setGuardianCin} autoCapitalize="characters" />
          <Text style={styles.label}>Relation</Text>
          <View style={styles.row}>
            <Chip label="Père" selected={guardianRelation === "father"} onPress={() => setGuardianRelation("father")} />
            <Chip label="Mère" selected={guardianRelation === "mother"} onPress={() => setGuardianRelation("mother")} />
          </View>
        </>
      ) : (
        <Field label="CIN" value={cin} onChangeText={setCin} autoCapitalize="characters" />
      )}

      <Field label="Téléphone" value={phoneNum} onChangeText={setPhoneNum} keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Mutuelle" value={mutuelle} onChangeText={setMutuelle} />

      <Text style={styles.label}>Groupe sanguin</Text>
      <View style={[styles.row, styles.wrap]}>
        {BLOOD_TYPES.map((type) => (
          <Chip key={type} label={type} selected={bloodType === type} onPress={() => setBloodType(type)} />
        ))}
      </View>

      <Field label="Allergies" value={allergies} onChangeText={setAllergies} multiline />
      <Field label="Maladies chroniques" value={chronicConditions} onChangeText={setChronicConditions} multiline />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />

      {formError && <Text style={styles.error}>{formError}</Text>}

      <Pressable style={[styles.submitButton, isSubmitting && styles.disabled]} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitButtonText}>{submitLabel}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "characters";
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, rest.multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        {...rest}
      />
    </View>
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
  avatarPreviewSection: { alignItems: "center", marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  scanBox: {
    borderWidth: 1,
    borderColor: colors.indigo300,
    borderStyle: "dashed",
    borderRadius: 10,
    backgroundColor: colors.indigo50,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  scanBoxTextRow: { flexDirection: "row", gap: 10 },
  scanBoxTitle: { fontSize: 14, fontWeight: "600", color: colors.gray900 },
  scanBoxSubtitle: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.indigo300,
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: 10,
  },
  scanButtonPressed: { backgroundColor: colors.indigo100 },
  scanButtonText: { color: colors.indigo700, fontWeight: "600" },
  field: { marginBottom: 14 },
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
  datePlaceholder: { fontSize: 15, color: colors.gray400 },
  row: { flexDirection: "row", gap: 8, marginBottom: 14 },
  wrap: { flexWrap: "wrap" },
  chip: {
    backgroundColor: colors.gray100,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { color: colors.gray600, fontWeight: "600" },
  chipTextSelected: { color: colors.white, fontWeight: "700" },
  error: { color: colors.danger, marginBottom: 12, textAlign: "center" },
  submitButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  disabled: { opacity: 0.6 },
  submitButtonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
});
