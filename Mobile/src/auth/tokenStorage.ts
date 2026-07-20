import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

// expo-secure-store (Keychain/Keystore) has no web implementation. The web
// target only exists for quick browser-based dev without a device/emulator —
// real builds run on iOS/Android, where SecureStore is used and the token
// never touches localStorage.
const isWeb = Platform.OS === "web";

function getItem(key: string): Promise<string | null> {
  if (isWeb) return Promise.resolve(window.localStorage.getItem(key));
  return SecureStore.getItemAsync(key);
}

function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    window.localStorage.setItem(key, value);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(key, value);
}

function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    window.localStorage.removeItem(key);
    return Promise.resolve();
  }
  return SecureStore.deleteItemAsync(key);
}

export const getToken = () => getItem(TOKEN_KEY);
export const saveToken = (token: string) => setItem(TOKEN_KEY, token);
export const clearToken = () => deleteItem(TOKEN_KEY);

export async function getPersistedUser<T>(): Promise<T | null> {
  const raw = await getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const saveUser = (user: unknown) => setItem(USER_KEY, JSON.stringify(user));
export const clearUser = () => deleteItem(USER_KEY);
