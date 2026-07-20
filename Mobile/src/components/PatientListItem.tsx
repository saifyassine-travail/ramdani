import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme/colors";
import { cardShadow } from "@/src/theme/ui";
import { computeAge } from "@/src/utils/date";

export interface PatientListItemData {
  id: number;
  first_name: string;
  last_name: string;
  gender?: string | null;
  cin?: string | null;
  guardian_cin?: string | null;
  phone?: string | null;
  birth_day?: string | null;
  age?: number | null;
  archived?: number | boolean;
}

export function PatientListItem({ patient, onPress }: { patient: PatientListItemData; onPress: () => void }) {
  const age = patient.age ?? computeAge(patient.birth_day);
  const isMinor = !patient.cin && !!patient.guardian_cin;
  const isMale = patient.gender === "Male";
  const genderColors = isMale ? colors.male : colors.female;
  const initials = `${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase();

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={[styles.avatar, { backgroundColor: genderColors.bg }]}>
        <Text style={[styles.avatarText, { color: genderColors.text }]}>{initials}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {patient.first_name} {patient.last_name}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Feather name="credit-card" size={10} color={colors.gray500} />
            <Text style={styles.metaChipText} numberOfLines={1}>
              {isMinor ? "Mineur" : patient.cin || "Sans CIN"}
            </Text>
          </View>
          {age !== null && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{age} ans</Text>
            </View>
          )}
        </View>
        {!!patient.phone && (
          <View style={styles.phoneRow}>
            <Feather name="phone" size={11} color={colors.gray400} />
            <Text style={styles.phoneText}>{patient.phone}</Text>
          </View>
        )}
      </View>

      <View style={styles.right}>
        {!!patient.archived && (
          <View style={styles.archivedBadge}>
            <Text style={styles.archivedBadgeText}>Archivé</Text>
          </View>
        )}
        <View style={styles.chevronCircle}>
          <Feather name="chevron-right" size={16} color={colors.primary} />
        </View>
      </View>
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    ...cardShadow,
  },
  cardPressed: { transform: [{ scale: 0.985 }], backgroundColor: colors.gray50 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: colors.gray900 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.gray100,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  metaChipText: { fontSize: 11, fontWeight: "600", color: colors.gray600 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  phoneText: { fontSize: 12, color: colors.gray400 },
  right: { alignItems: "flex-end", gap: 6 },
  archivedBadge: {
    backgroundColor: colors.dangerBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  archivedBadgeText: { fontSize: 10, fontWeight: "700", color: colors.dangerText },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.indigo50,
    alignItems: "center",
    justifyContent: "center",
  },
});
