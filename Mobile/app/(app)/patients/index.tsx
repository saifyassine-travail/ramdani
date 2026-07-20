import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as patientsApi from "@/src/api/patients";
import { PatientListItem, type PatientListItemData } from "@/src/components/PatientListItem";
import { useAuth } from "@/src/auth/AuthContext";
import { colors } from "@/src/theme/colors";
import { brandGradient } from "@/src/theme/ui";
import type { Patient, PatientSearchResult } from "@/src/types/patient";
import { confirmAlert } from "@/src/utils/alert";

function fromPatient(p: Patient): PatientListItemData {
  return {
    id: p.ID_patient,
    first_name: p.first_name,
    last_name: p.last_name,
    gender: p.gender,
    cin: p.CIN,
    guardian_cin: p.guardian_cin,
    phone: p.phone_num,
    birth_day: p.birth_day,
    archived: p.archived,
  };
}

function fromSearchResult(p: PatientSearchResult): PatientListItemData {
  return {
    id: p.ID_patient,
    first_name: p.first_name,
    last_name: p.last_name,
    gender: p.gender,
    cin: p.cin,
    phone: p.phone,
    birth_day: p.birth_day,
    age: p.age,
    archived: p.archived,
  };
}

export default function PatientListScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [patients, setPatients] = useState<PatientListItemData[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const loadList = useCallback(async (targetPage: number, append: boolean) => {
    if (append) setIsLoadingMore(true);
    setError(null);

    const response = await patientsApi.getPatients(false, targetPage);
    if (response.success && response.data) {
      const mapped = response.data.data.map(fromPatient);
      setPatients((prev) => (append ? [...prev, ...mapped] : mapped));
      setPage(response.data.current_page);
      setLastPage(response.data.last_page);
    } else {
      setError(response.message ?? "Impossible de charger les patients");
    }

    setIsLoading(false);
    setIsRefreshing(false);
    setIsLoadingMore(false);
  }, []);

  const runSearch = useCallback(async (term: string) => {
    setIsLoading(true);
    setError(null);

    const response = await patientsApi.searchPatients(term, false);
    if (response.success && response.data) {
      setPatients(response.data.map(fromSearchResult));
    } else {
      setError(response.message ?? "Échec de la recherche");
    }
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (debouncedQuery) {
        runSearch(debouncedQuery);
      } else {
        loadList(1, false);
      }
    }, [debouncedQuery, loadList, runSearch]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    if (debouncedQuery) {
      runSearch(debouncedQuery);
      setIsRefreshing(false);
    } else {
      loadList(1, false);
    }
  };

  const onEndReached = () => {
    if (!debouncedQuery && !isLoadingMore && page < lastPage) {
      loadList(page + 1, true);
    }
  };

  const handleLogout = () => {
    confirmAlert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", "Déconnexion", () => logout(), true);
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[...brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <SafeAreaView edges={["top", "left", "right"]}>
          <View style={styles.heroRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Patients</Text>
              {!!user?.name && <Text style={styles.userName}>{user.name}</Text>}
            </View>
            <View style={styles.headerActions}>
              <Pressable
                style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
                onPress={() => router.push("/(app)/patients/new")}
              >
                <Feather name="plus" size={16} color={colors.primaryDark} />
                <Text style={styles.addButtonText}>Ajouter</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
                onPress={handleLogout}
                hitSlop={8}
              >
                <Feather name="log-out" size={17} color={colors.white} />
              </Pressable>
            </View>
          </View>

          <View style={styles.searchWrapper}>
            <Feather name="search" size={16} color={colors.gray400} style={styles.searchIcon} />
            <TextInput
              style={styles.search}
              placeholder="Rechercher un patient..."
              placeholderTextColor={colors.gray400}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {error && (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={14} color={colors.dangerText} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <PatientListItem patient={item} onPress={() => router.push(`/(app)/patients/${item.id}`)} />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Feather name="users" size={26} color={colors.primary} />
              </View>
              <Text style={styles.empty}>Aucun patient trouvé</Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.appBg },
  hero: {
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingBottom: 18,
    marginBottom: 4,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  headerLeft: { flexShrink: 1 },
  title: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: 0.3 },
  userName: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  logoutButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonPressed: { backgroundColor: "rgba(255,255,255,0.15)" },
  searchWrapper: { marginHorizontal: 18, marginTop: 16, position: "relative", justifyContent: "center" },
  searchIcon: { position: "absolute", left: 14, zIndex: 1 },
  search: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingLeft: 38,
    paddingRight: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.gray900,
  },
  listContent: { paddingTop: 14, paddingBottom: 24 },
  loader: { marginTop: 40 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
  },
  errorText: { color: colors.dangerText, fontSize: 13, flexShrink: 1 },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 10 },
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
