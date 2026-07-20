import { request } from "@/src/api/client";

export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  permissions?: string | string[];
  created_at?: string;
  updated_at?: string;
}

interface LoginPayload {
  user: User;
  token: string;
}

export async function login(email: string, password: string, deviceName: string) {
  return request<LoginPayload>("/login", {
    method: "POST",
    body: { email, password, device_name: deviceName },
  });
}

export async function logout() {
  return request<{ message: string }>("/logout", { method: "POST" });
}

export async function getUser() {
  return request<User>("/user", { method: "GET" });
}
