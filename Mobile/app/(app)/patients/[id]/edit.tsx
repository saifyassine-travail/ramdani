import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as patientsApi from "@/src/api/patients";
import { PatientForm } from "@/src/components/PatientForm";
import { colors } from "@/src/theme/colors";
import type { Patient, PatientInput } from "@/src/types/patient";

export default function EditPatientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const patientId = Number(id);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const response = await patientsApi.getPatient(patientId);
      if (response.success && response.data) {
        setPatient(response.data.patient);
      } else {
        setError(response.message ?? "Impossible de charger le patient");
      }
      setIsLoading(false);
    })();
  }, [patientId]);

  async function handleSubmit(data: PatientInput) {
    const response = await patientsApi.updatePatient(patientId, data);
    if (response.success) {
      router.replace(`/(app)/patients/${patientId}`);
      return { success: true };
    }
    return { success: false, message: response.message };
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ title: "Modifier le patient" }} />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : error || !patient ? (
        <Text style={{ color: colors.danger, textAlign: "center", marginTop: 40 }}>
          {error ?? "Patient introuvable"}
        </Text>
      ) : (
        <PatientForm initialData={patient} onSubmit={handleSubmit} submitLabel="Enregistrer" />
      )}
    </SafeAreaView>
  );
}
