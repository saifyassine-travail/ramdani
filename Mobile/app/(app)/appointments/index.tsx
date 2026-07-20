import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as appointmentsApi from "@/src/api/appointments";
import { AppointmentListItem } from "@/src/components/AppointmentListItem";
import { MonthCalendar } from "@/src/components/MonthCalendar";
import { colors } from "@/src/theme/colors";
import { brandGradient, cardShadow } from "@/src/theme/ui";
import type { Appointment, MonthlyCounts } from "@/src/types/appointment";
import { toIsoDate } from "@/src/utils/date";

export default function AppointmentsScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [monthlyCounts, setMonthlyCounts] = useState<MonthlyCounts>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDay = useCallback(async (dateIso: string) => {
    setError(null);
    const response = await appointmentsApi.getAppointmentsByDate(dateIso);
    if (response.success && response.data) {
      setAppointments(response.data.appointments ?? []);
    } else {
      setError(response.message ?? "Impossible de charger les rendez-vous");
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadDay(selectedDate);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate]),
  );

  async function handleMonthChange(year: number, month: number) {
    const yearMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
    const response = await appointmentsApi.getMonthlyCounts(yearMonth);
    if (response.success && response.data) {
      setMonthlyCounts(response.data);
    }
  }

  function onRefresh() {
    setIsRefreshing(true);
    loadDay(selectedDate);
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[...brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <SafeAreaView edges={["top", "left", "right"]}>
          <View style={styles.heroRow}>
            <Text style={styles.title}>Rendez-vous</Text>
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
              onPress={() => router.push("/(app)/appointments/new")}
            >
              <Feather name="plus" size={16} color={colors.primaryDark} />
              <Text style={styles.addButtonText}>Nouveau RV</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        data={appointments}
        keyExtractor={(item) => String(item.ID_RV)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.calendarCard}>
              <MonthCalendar
                selectedDate={selectedDate}
                counts={monthlyCounts}
                onSelectDate={setSelectedDate}
                onMonthChange={handleMonthChange}
              />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color={colors.dangerText} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {isLoading && <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />}
          </>
        }
        renderItem={({ item }) =>
          isLoading ? null : (
            <AppointmentListItem appointment={item} onPress={() => router.push(`/(app)/appointments/${item.ID_RV}`)} />
          )
        }
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Feather name="calendar" size={26} color={colors.primary} />
              </View>
              <Text style={styles.empty}>Aucun rendez-vous ce jour</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.appBg },
  hero: {
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingBottom: 18,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: 0.3 },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addButtonPressed: { backgroundColor: colors.indigo100 },
  addButtonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 14 },
  listContent: { paddingBottom: 24 },
  calendarCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 14,
    paddingVertical: 6,
    ...cardShadow,
  },
  loader: { marginVertical: 24 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
  },
  errorText: { color: colors.dangerText, fontSize: 13, flexShrink: 1 },
  emptyContainer: { alignItems: "center", marginTop: 24, gap: 10 },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.indigo100,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { textAlign: "center", color: colors.gray500, fontWeight: "500" },
});
