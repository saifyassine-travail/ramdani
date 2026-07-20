// Mirrors Frontend's design language: the indigo brand gradient
// (Frontend/app/globals.css .medical-sidebar, #4361ee -> #3a0ca3), the teal
// CTA color used for primary actions (Frontend/components/medical-header.tsx,
// #007090), and the same Tailwind gray/red/blue/pink scale used throughout
// Frontend/app/patients/*.
export const colors = {
  primary: "#4361ee",
  primaryDark: "#3a0ca3",
  primaryLight: "#eef2ff",

  // Soft indigo-tinted app background; screens use this behind white cards.
  appBg: "#f2f4fb",

  accent: "#007090",
  accentDark: "#005570",

  success: "#10b981",
  successDark: "#059669",

  danger: "#dc2626",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",
  dangerText: "#991b1b",

  warning: "#d97706",
  warningBg: "#fffbeb",

  male: { bg: "#dbeafe", text: "#2563eb" },
  female: { bg: "#fce7f3", text: "#db2777" },

  indigo50: "#eef2ff",
  indigo100: "#e0e7ff",
  indigo300: "#a5b4fc",
  indigo600: "#4f46e5",
  indigo700: "#4338ca",

  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",

  white: "#ffffff",

  // Appointment status pills — mirrors AppointmentController::updateStatus's
  // statusColors map (bg-*-100 / border-*-400 / text-*-700 per status).
  statusBlue: { bg: "#dbeafe", border: "#60a5fa", text: "#1d4ed8" },
  statusYellow: { bg: "#fef9c3", border: "#facc15", text: "#a16207" },
  statusOrange: { bg: "#ffedd5", border: "#fb923c", text: "#c2410c" },
  statusPurple: { bg: "#f3e8ff", border: "#c084fc", text: "#7e22ce" },
  statusGreen: { bg: "#dcfce7", border: "#4ade80", text: "#15803d" },
  statusRed: { bg: "#fee2e2", border: "#f87171", text: "#b91c1c" },

  // Calendar day-density dots — mirrors the web header's getCountColor thresholds.
  densityNone: "#d1d5db",
  densityLow: "#22c55e",
  densityMedium: "#eab308",
  densityHigh: "#f97316",
  densityVeryHigh: "#ef4444",
} as const;
