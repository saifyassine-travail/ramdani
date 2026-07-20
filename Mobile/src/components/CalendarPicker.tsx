import { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme/colors";
import { DAY_NAMES, getMonthGrid, MONTH_NAMES, parseIsoDate, toIsoDate } from "@/src/utils/date";

interface CalendarPickerProps {
  visible: boolean;
  value?: string | null;
  minimumDate?: Date;
  maximumDate?: Date;
  onSelect: (isoDate: string) => void;
  onClose: () => void;
}

export function CalendarPicker({ visible, value, minimumDate, maximumDate, onSelect, onClose }: CalendarPickerProps) {
  const selected = parseIsoDate(value);
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayIso = toIsoDate(new Date());
  const cells = getMonthGrid(year, month);

  function changeMonth(delta: number) {
    setViewDate(new Date(year, month + delta, 1));
  }

  function isDisabled(day: number) {
    const iso = toIsoDate(new Date(year, month, day));
    if (maximumDate && iso > toIsoDate(maximumDate)) return true;
    if (minimumDate && iso < toIsoDate(minimumDate)) return true;
    return false;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
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
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              const disabled = isDisabled(day);

              return (
                <Pressable
                  key={iso}
                  style={styles.cell}
                  disabled={disabled}
                  onPress={() => onSelect(iso)}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isSelected && styles.dayCircleSelected,
                      isToday && !isSelected && styles.dayCircleToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  navButton: { padding: 6, borderRadius: 8 },
  headerTitle: { fontSize: 15, fontWeight: "700", color: colors.gray900 },
  weekdayRow: { flexDirection: "row", marginTop: 4 },
  weekdayLabel: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600", color: colors.gray400 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dayCircleSelected: { backgroundColor: colors.primary },
  dayCircleToday: { borderWidth: 1, borderColor: colors.primary },
  dayText: { fontSize: 13, color: colors.gray800 },
  dayTextSelected: { color: colors.white, fontWeight: "700" },
  dayTextDisabled: { color: colors.gray300 },
  closeButton: { marginTop: 12, alignSelf: "center", paddingVertical: 8, paddingHorizontal: 16 },
  closeButtonText: { color: colors.gray500, fontWeight: "600", fontSize: 13 },
});
