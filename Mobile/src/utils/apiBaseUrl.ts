import { Platform } from "react-native";

// EXPO_PUBLIC_API_BASE_URL (from Mobile/.env) is the primary way to point
// the app at the backend. These are only used if it's unset.
const ANDROID_EMULATOR_DEFAULT = "http://10.0.2.2:8000/api";
const IOS_SIMULATOR_DEFAULT = "http://localhost:8000/api";

export function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured;

  return Platform.OS === "android" ? ANDROID_EMULATOR_DEFAULT : IOS_SIMULATOR_DEFAULT;
}
