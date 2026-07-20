import { useEffect, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme/colors";
import { DAY_NAMES, getMonthGrid, MONTH_NAMES, parseIsoDate, toIsoDate } from "@/src/utils/date";
import type { MonthlyCounts } from "@/src/types/appointment";

interface MonthCalendarProps {
  selectedDate: string;
  counts: MonthlyCounts;
  onSelectDate: (iso: string) => void;
  onMonthChange: (year: number, month: number) => void;
}

function densityColor(count: number): string {
  if (count === 0) return colors.densityNone;
  if (count <= 5) return colors.densityLow;
  if (count <= 15) return colors.densityMedium;
  if (count <= 25) return colors.densityHigh;
  return colors.densityVeryHigh;
}

export function MonthCalendar({ selectedDate, counts, onSelectDate, onMonthChange }: MonthCalendarProps) {
  const [viewDate, setViewDate] = useState(() => parseIsoDate(selectedDate) ?? new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayIso = toIsoDate(new Date());
  const cells = getMonthGrid(year, month);

  useEffect(() => {
    onMonthChange(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  function changeMonth(delta: number) {
    setViewDate(new Date(year, month + delta, 1));
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.navButton} onPress={() => changeMonth(-1)} hitSlop={8}>
          <Feather name="chevron-left" size={20} color={colors.gray600} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <Pressable style={styles.navButton} onPress={() => changeMonth(1)} hitSlop={8}>
          <Feather name="chevron-right" size={20} color={colors.gray600} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {DAY_NAMES.map((d, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) return <View key={`empty-${index}`} style={styles.cell} />;

          const iso = toIsoDate(new Date(year, month, day));
          const isSelected = iso === selectedDate;
          const isToday = iso === todayIso;
          const count = counts[iso] ?? 0;

          return (
            <Pressable key={iso} style={styles.cell} onPress={() => onSelectDate(iso)}>
              <View
                style={[
                  styles.dayCircle,
                  isSelected && styles.dayCircleSelected,
                  isToday && !isSelected && styles.dayCircleToday,
                ]}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
              </View>
              <View style={[styles.dot, { backgroundColor: densityColor(count) }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  navButton: { padding: 6, borderRadius: 8 },
  headerTitle: { fontSize: 15, fontWeight: "700", color: colors.gray900 },
  weekdayRow: { flexDirection: "row", marginTop: 4 },
  weekdayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.gray400 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayCircleSelected: { backgroundColor: colors.primary },
  dayCircleToday: { borderWidth: 1, borderColor: colors.primary },
  dayText: { fontSize: 13, color: colors.gray800 },
  dayTextSelected: { color: colors.white, fontWeight: "700" },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },
});
