import { request } from "@/src/api/client";
import type {
  Certificate,
  Patient,
  PatientDetailResponse,
  PatientDocument,
  PatientInput,
  PatientPaginator,
  PatientSearchResult,
} from "@/src/types/patient";

export async function getPatients(showArchived = false, page = 1) {
  return request<PatientPaginator>(`/patients?archived=${showArchived}&page=${page}`, { method: "GET" });
}

export async function searchPatients(term: string, showArchived = false) {
  return request<PatientSearchResult[]>(
    `/patients/search?term=${encodeURIComponent(term)}&archived=${showArchived}`,
    { method: "GET" },
  );
}

export async function getPatient(id: number) {
  return request<PatientDetailResponse>(`/patients/${id}`, { method: "GET" });
}

export async function createPatient(data: PatientInput) {
  return request<{ patient: Patient }>("/patients", { method: "POST", body: data });
}

export async function updatePatient(id: number, data: PatientInput) {
  return request<{ patient: Patient }>(`/patients/${id}`, { method: "PUT", body: data });
}

export async function archivePatient(id: number, archived: boolean) {
  return request<{ archived: boolean }>(`/patients/${id}/archive`, {
    method: "PATCH",
    body: { archived },
  });
}

// Note: unlike most other patient endpoints, these already wrap their
// payload in a `data` key server-side (PatientDocumentController), so the
// resource ends up at `response.data.data` here.
export async function getPatientDocuments(patientId: number) {
  return request<{ data: PatientDocument[] }>(`/patients/${patientId}/documents`, { method: "GET" });
}

export async function uploadPatientDocument(
  patientId: number,
  asset: { uri: string; name: string; type: string },
  documentType?: string,
) {
  const form = new FormData();
  form.append("file", asset as unknown as Blob);
  if (documentType) form.append("document_type", documentType);

  return request<{ data: PatientDocument }>(`/patients/${patientId}/documents`, {
    method: "POST",
    body: form,
    isFormData: true,
  });
}

export async function deletePatientDocument(patientId: number, documentId: number) {
  return request<{ message: string }>(`/patients/${patientId}/documents/${documentId}`, { method: "DELETE" });
}

// CertificateController::index wraps the list under `certificates`, not `data`.
export async function getCertificates(patientId: number) {
  return request<{ certificates: Certificate[] }>(`/certificates/patient/${patientId}`, { method: "GET" });
}
