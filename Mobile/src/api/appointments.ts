import { request } from "@/src/api/client";
import type {
  Appointment,
  AppointmentDayResponse,
  AppointmentInput,
  AppointmentStatusKey,
  MonthlyCounts,
} from "@/src/types/appointment";

export async function getAppointmentsByDate(dateIso: string) {
  return request<AppointmentDayResponse>(`/appointments/${dateIso}`, { method: "GET" });
}

export async function getMonthlyCounts(yearMonth: string) {
  return request<MonthlyCounts>(`/appointments/monthly-counts/${yearMonth}`, { method: "GET" });
}

export async function createAppointment(data: AppointmentInput) {
  return request<{ appointment: Appointment }>("/appointments/v1", { method: "POST", body: data });
}

export async function updateAppointmentStatus(id: number, status: AppointmentStatusKey) {
  return request<{ status: string }>("/appointments/update-status", {
    method: "POST",
    body: { appointment_id: id, status },
  });
}

export async function updateAppointment(id: number, data: { diagnostic?: string | null; notes?: string | null }) {
  return request<{ appointment: Appointment }>(`/appointments/${id}`, { method: "PUT", body: data });
}

export async function deleteAppointment(id: number) {
  return request<{ message: string }>(`/appointments/${id}`, { method: "DELETE" });
}

// No dedicated single-appointment GET exists server-side — edit-data is the
// closest fit and already returns the full appointment (with patient eager
// loaded); the medicament/analysis lists it also returns are unused here.
export async function getAppointment(id: number) {
  return request<{ data: { appointment: Appointment } }>(`/appointments/${id}/edit-data`, { method: "GET" });
}
