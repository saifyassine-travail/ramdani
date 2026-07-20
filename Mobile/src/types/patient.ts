export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

// Shape returned by GET /patients/{id}, and the "patient" field of
// POST/PUT /patients responses. Also the shape of each item in the
// GET /patients paginator's `data` array.
export interface Patient {
  ID_patient: number;
  first_name: string;
  last_name: string;
  birth_day?: string | null;
  gender?: "Male" | "Female" | null;
  CIN?: string | null;
  guardian_cin?: string | null;
  guardian_relation?: "father" | "mother" | null;
  phone_num?: string | null;
  email?: string | null;
  mutuelle?: string | null;
  allergies?: string | null;
  chronic_conditions?: string | null;
  notes?: string | null;
  archived: number | boolean;
  DDR?: string | null;
  blood_type?: BloodType | null;
  photo_base64?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Fields accepted by POST /patients and PUT /patients/{id}.
export interface PatientInput {
  first_name: string;
  last_name: string;
  birth_day: string;
  gender: "Male" | "Female";
  CIN?: string | null;
  guardian_cin?: string | null;
  guardian_relation?: "father" | "mother" | null;
  phone_num: string;
  email?: string | null;
  mutuelle?: string | null;
  allergies?: string | null;
  chronic_conditions?: string | null;
  notes?: string | null;
  blood_type?: BloodType | null;
  photo_base64?: string | null;
}

// Laravel's raw paginator shape, returned as-is by GET /patients.
export interface PatientPaginator {
  current_page: number;
  data: Patient[];
  last_page: number;
  per_page: number;
  total: number;
  [key: string]: unknown;
}

// Flat, aliased shape returned by GET /patients/search?term=... — distinct
// from `Patient`, do not conflate the two.
export interface PatientSearchResult {
  id: number;
  ID_patient: number;
  first_name: string;
  last_name: string;
  cin: string | null;
  CIN: string | null;
  phone: string | null;
  phone_num: string | null;
  email: string | null;
  gender: string | null;
  mutuelle: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  notes: string | null;
  age: number | null;
  last_visit: string | null;
  next_visit: string | null;
  archived: number | boolean;
  birth_day: string | null;
  blood_type: BloodType | null;
}

export interface AppointmentHistoryItem {
  ID_RV: number;
  appointment_date: string;
  type?: string;
  status?: string;
  diagnostic?: string | null;
  payement?: number | null;
  credit?: number | null;
}

export interface PatientDetailResponse {
  patient: Patient;
  appointmentsHistory: AppointmentHistoryItem[];
  lastAppointment: AppointmentHistoryItem | null;
  nextAppointment: AppointmentHistoryItem | null;
}

export interface PatientDocument {
  id: number;
  ID_patient: number;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

export interface Certificate {
  ID_CM: number;
  start_date: string;
  end_date: string;
  content?: string | null;
  ID_patient: number;
}
