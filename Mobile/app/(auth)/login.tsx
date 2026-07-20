import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/src/theme/colors";
import { useAuth } from "@/src/auth/AuthContext";

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ defaultValues: { email: "", password: "" } });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    const result = await login(values.email.trim(), values.password);
    setIsSubmitting(false);
    if (!result.success) {
      setServerError(result.message ?? "Échec de la connexion");
    }
  };

  return (
    <LinearGradient colors={["#eff6ff", "#e0e7ff"]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          <View style={styles.card}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.logo}>
              <Feather name="activity" size={28} color={colors.white} />
            </LinearGradient>
            <Text style={styles.title}>MediAssist</Text>
            <Text style={styles.subtitle}>Connectez-vous pour accéder à vos patients</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <Controller
                control={control}
                name="email"
                rules={{ required: "L'email est requis" }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="votre@email.com"
                    placeholderTextColor={colors.gray400}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isSubmitting}
                  />
                )}
              />
              {errors.email && <Text style={styles.fieldError}>{errors.email.message}</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <Controller
                control={control}
                name="password"
                rules={{ required: "Le mot de passe est requis" }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.gray400}
                    secureTextEntry
                    autoComplete="password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isSubmitting}
                  />
                )}
              />
              {errors.password && <Text style={styles.fieldError}>{errors.password.message}</Text>}
            </View>

            {serverError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{serverError}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Se connecter</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 26,
    shadowColor: "#312e81",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  title: { fontSize: 25, fontWeight: "800", textAlign: "center", color: colors.gray900, letterSpacing: 0.3 },
  subtitle: { fontSize: 13, textAlign: "center", color: colors.gray500, marginTop: 4, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: colors.gray700, marginBottom: 6 },
  input: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.gray900,
  },
  fieldError: { color: colors.danger, fontSize: 13, marginTop: 4 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorBoxText: { color: colors.dangerText, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
});
