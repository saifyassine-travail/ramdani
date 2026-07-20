import { Redirect } from "expo-router";

import { LoadingScreen } from "@/src/components/LoadingScreen";
import { useAuth } from "@/src/auth/AuthContext";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return <Redirect href={isAuthenticated ? "/(app)/patients" : "/(auth)/login"} />;
}
