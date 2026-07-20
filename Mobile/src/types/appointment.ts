import { colors } from "@/src/theme/colors";
import type { Patient } from "@/src/types/patient";

export type AppointmentType = "Consultation" | "Control";

// Server stores/returns the French label (see AppointmentController::updateStatus's
// statusMapping) — this is what's on Appointment.status, not the English key.
export type AppointmentStatusLabel =
  | "Programmé"
  | "Salle dattente"
  | "En préparation"
  | "En consultation"
  | "Terminé"
  | "Annulé";

// English keys accepted by POST /appointments/update-status.
export type AppointmentStatusKey = "scheduled" | "waiting" | "preparing" | "consulting" | "completed" | "canceled";

export interface Appointment {
  ID_RV: number;
  appointment_date: string;
  type: AppointmentType;
  status: AppointmentStatusLabel;
  mutuelle?: boolean | number;
  payement?: number | null;
  credit?: number | null;
  diagnostic?: string | null;
  notes?: string | null;
  ID_patient: number;
  patient?: Patient;
  created_at?: string;
  updated_at?: string;
}

export interface AppointmentDayResponse {
  success: boolean;
  date: string;
  appointments: Appointment[];
  count: number;
}

export type MonthlyCounts = Record<string, number>;

export interface AppointmentInput {
  patient_id: number;
  type: AppointmentType;
  appointment_date: string;
  notes?: string | null;
}

interface StatusColor {
  bg: string;
  border: string;
  text: string;
}

export const STATUS_OPTIONS: { key: AppointmentStatusKey; label: AppointmentStatusLabel; color: StatusColor }[] = [
  { key: "scheduled", label: "Programmé", color: colors.statusBlue },
  { key: "waiting", label: "Salle dattente", color: colors.statusYellow },
  { key: "preparing", label: "En préparation", color: colors.statusOrange },
  { key: "consulting", label: "En consultation", color: colors.statusPurple },
  { key: "completed", label: "Terminé", color: colors.statusGreen },
  { key: "canceled", label: "Annulé", color: colors.statusRed },
];

export function statusColorFor(label: string) {
  return STATUS_OPTIONS.find((s) => s.label === label)?.color ?? colors.statusBlue;
}

export function typeLabel(type: AppointmentType): string {
  return type === "Control" ? "Contrôle" : "Consultation";
}
