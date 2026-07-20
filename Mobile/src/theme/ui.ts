import type { ViewStyle } from "react-native";

// Shared elevation recipe for white cards sitting on colors.appBg — indigo-tinted
// so shadows feel branded rather than plain gray.
export const cardShadow: ViewStyle = {
  shadowColor: "#312e81",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

// The brand gradient used by the web sidebar (Frontend/app/globals.css
// .medical-sidebar) — reused for screen headers and hero banners.
export const brandGradient = ["#4361ee", "#3a0ca3"] as const;
