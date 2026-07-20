import { request } from "@/src/api/client";

export interface CinExtractedFields {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  cin_number?: string;
  date_of_birth?: string;
  place_of_birth?: string;
  expiry_date?: string;
}

export interface CinExtractResult {
  data: CinExtractedFields;
  photo_base64?: string | null;
  validation?: Record<string, unknown>;
}

export async function extractCin(asset: { uri: string; name: string; type: string }) {
  const form = new FormData();
  form.append("file", asset as unknown as Blob);

  return request<CinExtractResult>("/extract-cin", {
    method: "POST",
    body: form,
    isFormData: true,
  });
}
