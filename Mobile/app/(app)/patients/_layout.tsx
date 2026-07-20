import { Stack } from "expo-router";

import { colors } from "@/src/theme/colors";

export default function PatientsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.gray900, fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
