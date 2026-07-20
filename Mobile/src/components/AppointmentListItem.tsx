import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme/colors";
import { cardShadow } from "@/src/theme/ui";
import { statusColorFor, typeLabel, type Appointment } from "@/src/types/appointment";

function formatTime(appointmentDate: string): string {
  const parsed = new Date(appointmentDate.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

export function AppointmentListItem({ appointment, onPress }: { appointment: Appointment; onPress: () => void }) {
  const statusColor = statusColorFor(appointment.status);
  const patient = appointment.patient;
  const isControl = appointment.type === "Control";

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={[styles.statusBar, { backgroundColor: statusColor.border }]} />

      <View style={styles.timeBlock}>
        <Text style={styles.time}>{formatTime(appointment.appointment_date)}</Text>
        <View style={[styles.typeBadge, isControl ? styles.typeBadgeControl : styles.typeBadgeConsult]}>
          <Text style={[styles.typeBadgeText, isControl ? styles.typeTextControl : styles.typeTextConsult]}>
            {typeLabel(appointment.type)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {patient ? `${patient.first_name} ${patient.last_name}` : "Patient inconnu"}
        </Text>
        {!!patient?.phone_num && (
          <View style={styles.metaRow}>
            <Feather name="phone" size={11} color={colors.gray400} />
            <Text style={styles.meta}>{patient.phone_num}</Text>
          </View>
        )}
        <View style={[styles.statusPill, { backgroundColor: statusColor.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor.border }]} />
          <Text style={[styles.statusText, { color: statusColor.text }]} numberOfLines={1}>
            {appointment.status}
          </Text>
        </View>
      </View>

      <Feather name="chevron-right" size={18} color={colors.gray300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 0,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: "hidden",
    ...cardShadow,
  },
  cardPressed: { transform: [{ scale: 0.985 }], backgroundColor: colors.gray50 },
  statusBar: { width: 5, alignSelf: "stretch", borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  timeBlock: { alignItems: "center", width: 66, gap: 5 },
  time: { fontSize: 16, fontWeight: "800", color: colors.gray900 },
  typeBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeConsult: { backgroundColor: colors.indigo100 },
  typeBadgeControl: { backgroundColor: "#ccfbf1" },
  typeBadgeText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  typeTextConsult: { color: colors.indigo700 },
  typeTextControl: { color: colors.accentDark },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.gray200 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: "700", color: colors.gray900 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 12, color: colors.gray500 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
});
