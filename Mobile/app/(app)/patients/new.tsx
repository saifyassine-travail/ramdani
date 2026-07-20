import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import * as patientsApi from "@/src/api/patients";
import { PatientForm } from "@/src/components/PatientForm";
import { colors } from "@/src/theme/colors";
import type { PatientInput } from "@/src/types/patient";

export default function NewPatientScreen() {
  const router = useRouter();

  async function handleSubmit(data: PatientInput) {
    const response = await patientsApi.createPatient(data);
    if (response.success && response.data?.patient) {
      router.replace(`/(app)/patients/${response.data.patient.ID_patient}`);
      return { success: true };
    }
    return { success: false, message: response.message };
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ title: "Nouveau patient" }} />
      <PatientForm onSubmit={handleSubmit} submitLabel="Ajouter le patient" />
    </SafeAreaView>
  );
}
