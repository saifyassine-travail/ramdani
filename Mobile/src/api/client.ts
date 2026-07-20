import { getToken } from "@/src/auth/tokenStorage";
import { resolveApiBaseUrl } from "@/src/utils/apiBaseUrl";

export const API_BASE_URL = resolveApiBaseUrl();

// Mirrors Frontend/lib/api.ts's ApiClient.request: on success, `data` is
// always the raw parsed JSON body verbatim (whatever shape the endpoint
// returns — a paginator, `{ patient }`, `{ certificates }`, etc.) — callers
// know the shape per-endpoint rather than the client guessing at it.
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  status?: number;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  isFormData?: boolean;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { body, isFormData, headers, ...rest } = options;

  try {
    const token = await getToken();
    const finalHeaders: Record<string, string> = {
      Accept: "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined),
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return {
        success: false,
        message: errorBody?.message ?? `HTTP ${response.status}: ${response.statusText}`,
        errors: errorBody?.errors,
        status: response.status,
      };
    }

    const data = await response.json();
    return { success: true, data: data as T };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof TypeError
          ? "Cannot connect to server. Check EXPO_PUBLIC_API_BASE_URL and that the backend is reachable."
          : error instanceof Error
            ? error.message
            : "Network error occurred",
    };
  }
}
