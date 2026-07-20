import { Redirect, Stack } from "expo-router";

import { LoadingScreen } from "@/src/components/LoadingScreen";
import { useAuth } from "@/src/auth/AuthContext";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Redirect href="/(app)/patients" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
