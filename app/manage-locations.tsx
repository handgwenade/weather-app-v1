import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  addSavedLocation,
  deleteSavedLocation,
  formatCityState,
  setDefaultLocation,
  setSelectedLocation,
  useDefaultLocation,
  useSavedLocations,
  useSelectedLocation,
} from "../data/locationStore";
import { searchLocations, type GeocodingResult } from "../services/geocoding";

type MiniCardProps = {
  title: string;
  children: React.ReactNode;
  style?: object;
  titleStyle?: object;
};

function MiniCard({ title, children, style, titleStyle }: MiniCardProps) {
  return (
    <View style={[styles.miniCard, style]}>
      <Text style={[styles.miniCardTitle, titleStyle]}>{title}</Text>
      {children}
    </View>
  );
}

export default function ManageLocationsScreen() {
  const router = useRouter();

  const selectedLocation = useSelectedLocation();
  const defaultLocation = useDefaultLocation();
  const savedLocations = useSavedLocations();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingResultId, setSavingResultId] = useState<string | null>(null);

  async function handleSearch() {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      Alert.alert("Enter a place", "Type a city, town, or place name first.");
      return;
    }

    try {
      setSearching(true);
      const results = await searchLocations(trimmedQuery);
      setSearchResults(results);
    } catch (error) {
      console.log("Location search failed:", error);
      Alert.alert("Search failed", "Could not search for locations right now.");
    } finally {
      setSearching(false);
    }
  }

  async function handleAddSearchResult(result: GeocodingResult) {
    try {
      setSavingResultId(result.id);

      const alreadySaved = savedLocations.find((location) => {
        return (
          location.name.toLowerCase() === result.name.toLowerCase() &&
          location.city.toLowerCase() === result.city.toLowerCase() &&
          location.state.toLowerCase() === result.state.toLowerCase() &&
          Math.abs(location.latitude - result.latitude) < 0.0001 &&
          Math.abs(location.longitude - result.longitude) < 0.0001
        );
      });

      if (alreadySaved) {
        await setSelectedLocation(alreadySaved);
        setSearchQuery("");
        setSearchResults([]);
        return;
      }

      const newLocation = await addSavedLocation({
        name: result.name,
        city: result.city,
        state: result.state || "NA",
        latitude: result.latitude,
        longitude: result.longitude,
      });

      await setSelectedLocation(newLocation);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      console.log("Failed to save searched location:", error);
      Alert.alert(
        "Could not save location",
        "Something went wrong while saving this location.",
      );
    } finally {
      setSavingResultId(null);
    }
  }

  function handleDeleteLocation(locationId: string, locationName: string) {
    Alert.alert(
      "Delete location?",
      `Remove ${locationName} from saved locations?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSavedLocation(locationId);
            } catch (error: any) {
              Alert.alert(
                "Cannot delete",
                error?.message ?? "Could not delete this location.",
              );
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <View style={styles.topRow}>
            <Pressable
              style={styles.circleButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back-outline" size={24} color="#ffffff" />
            </Pressable>

            <Text style={styles.appTitle}>Manage Locations</Text>

            <View style={styles.circleButtonPlaceholder} />
          </View>

          <Text style={styles.pageTitle}>Location Setup</Text>
          <Text style={styles.pageSubtext}>
            Choose which saved places your app uses, and add new ones when
            needed.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Add a Location</Text>
          <Text style={styles.infoCardText}>
            Search by city, town, road, or place name.
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a place"
              placeholderTextColor="#8FA4C4"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
              returnKeyType="search"
              onSubmitEditing={() => void handleSearch()}
            />

            <Pressable
              style={[
                styles.searchButton,
                searching && styles.primaryButtonDisabled,
              ]}
              onPress={() => void handleSearch()}
              disabled={searching}
            >
              <Ionicons name="search-outline" size={20} color="#EAF4FF" />
            </Pressable>
          </View>

          {searching && (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Searching locations...</Text>
            </View>
          )}

          {!searching && searchResults.length > 0 && (
            <View style={styles.resultsList}>
              {searchResults.map((result) => {
                const isSaving = savingResultId === result.id;
                const subtitle = result.state
                  ? `${result.city}, ${result.state}`
                  : result.country
                    ? `${result.city}, ${result.country}`
                    : result.city;

                return (
                  <View key={result.id} style={styles.resultCard}>
                    <View style={styles.resultTextBlock}>
                      <Text style={styles.resultTitle}>{result.name}</Text>
                      <Text style={styles.resultText}>{subtitle}</Text>
                    </View>

                    <Pressable
                      style={[
                        styles.primaryButtonSmall,
                        isSaving && styles.primaryButtonDisabled,
                      ]}
                      onPress={() => void handleAddSearchResult(result)}
                      disabled={isSaving}
                    >
                      <Text style={styles.primaryButtonSmallText}>
                        {isSaving ? "Saving..." : "Add"}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {!searching &&
            searchQuery.trim().length > 0 &&
            searchResults.length === 0 && (
              <Text style={styles.emptyStateText}>
                No matching places found.
              </Text>
            )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Saved Locations</Text>
          <Text style={styles.helperIntro}>
            Choose which saved place the app should use right now, and which one
            should stay as Home.
          </Text>

          {savedLocations.map((location) => {
            const isCurrent = location.id === selectedLocation.id;
            const isHome = location.id === defaultLocation.id;

            return (
              <View key={location.id} style={styles.locationCard}>
                <View style={styles.locationCardTop}>
                  <View style={styles.locationTextBlock}>
                    <Text style={styles.locationCardTitle}>
                      {location.name}
                    </Text>
                    <Text style={styles.locationCardText}>
                      {formatCityState(location)}
                    </Text>
                  </View>

                  <View style={styles.badgeColumn}>
                    {isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.badgeText}>Using Now</Text>
                      </View>
                    )}

                    {isHome && (
                      <View style={styles.homeBadge}>
                        <Text style={styles.badgeText}>Home</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.actionRow}>
                  {!isCurrent && (
                    <Pressable
                      style={[styles.actionButton, styles.appActionButton]}
                      onPress={() => void setSelectedLocation(location)}
                    >
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color="#EAF4FF"
                      />
                      <Text style={styles.actionButtonText}>Use Now</Text>
                    </Pressable>
                  )}

                  {!isHome && (
                    <Pressable
                      style={[styles.actionButton, styles.homeActionButton]}
                      onPress={() => void setDefaultLocation(location.id)}
                    >
                      <Ionicons name="home-outline" size={16} color="#E5EDF9" />
                      <Text style={styles.actionButtonText}>Set as Home</Text>
                    </Pressable>
                  )}

                  {savedLocations.length > 1 && (
                    <Pressable
                      style={[styles.actionButton, styles.deleteActionButton]}
                      onPress={() =>
                        handleDeleteLocation(location.id, location.name)
                      }
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#FFD7E0"
                      />
                      <Text style={styles.deleteActionText}>Delete</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Current Setup</Text>
          <Text style={styles.summaryText}>
            Home, Road, and Alerts use your selected current location. Home
            keeps a separate saved home base if you want one.
          </Text>
        </View>

        <View style={styles.twoColumnRow}>
          <MiniCard
            title="Current Location"
            style={styles.currentCard}
            titleStyle={styles.currentCardTitle}
          >
            <Text style={styles.miniCardText}>{selectedLocation.name}</Text>
            <Text style={styles.miniCardSubtext}>
              {formatCityState(selectedLocation)}
            </Text>
            <Text style={styles.miniCardMeta}>
              Used by Home, Road, and Alerts
            </Text>
          </MiniCard>

          <MiniCard
            title="Home Location"
            style={styles.homeSummaryCard}
            titleStyle={styles.homeSummaryCardTitle}
          >
            <Text style={styles.miniCardText}>{defaultLocation.name}</Text>
            <Text style={styles.miniCardSubtext}>
              {formatCityState(defaultLocation)}
            </Text>
            <Text style={styles.miniCardMeta}>Saved as your Home base</Text>
          </MiniCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A1630",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#0A1630",
  },
  container: {
    backgroundColor: "#0A1630",
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 22,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.28)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  circleButtonPlaceholder: {
    width: 52,
    height: 52,
  },
  appTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "500",
  },
  pageTitle: {
    color: "#ffffff",
    fontSize: 22,
    marginBottom: 10,
  },
  pageSubtext: {
    color: "#b8c6e0",
    fontSize: 16,
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  summaryTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 10,
  },
  summaryText: {
    color: "#E5EDF9",
    fontSize: 16,
    lineHeight: 24,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  miniCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 150,
  },
  miniCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  miniCardText: {
    color: "#E5EDF9",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 6,
  },
  miniCardSubtext: {
    color: "#E5EDF9",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  miniCardMeta: {
    color: "#9EB5D8",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  currentCard: {
    backgroundColor: "rgba(120, 146, 186, 0.12)",
    borderColor: "rgba(190, 210, 235, 0.18)",
  },
  currentCardTitle: {
    color: "#D8ECFF",
  },
  homeSummaryCard: {
    backgroundColor: "rgba(143, 214, 148, 0.12)",
    borderColor: "rgba(143, 214, 148, 0.24)",
  },
  homeSummaryCardTitle: {
    color: "#DDF7E0",
  },
  infoCard: {
    backgroundColor: "rgba(120, 146, 186, 0.12)",
    borderColor: "rgba(190, 210, 235, 0.18)",
    borderWidth: 1,
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  infoCardTitle: {
    color: "#D8ECFF",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 10,
  },
  infoCardText: {
    color: "#E5EDF9",
    fontSize: 16,
    marginBottom: 4,
  },
  helperIntro: {
    color: "#9EB5D8",
    fontSize: 14,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(190, 210, 235, 0.16)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 16,
  },
  searchButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(125, 181, 255, 0.22)",
    borderColor: "rgba(160, 205, 255, 0.34)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  loadingText: {
    color: "#C9D8EF",
    fontSize: 15,
  },
  resultsList: {
    marginTop: 10,
    gap: 12,
  },
  resultCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(190, 210, 235, 0.16)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  resultTextBlock: {
    marginBottom: 12,
  },
  resultTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
  },
  resultText: {
    color: "#C9D8EF",
    fontSize: 15,
    marginBottom: 4,
  },
  primaryButtonSmall: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(125, 181, 255, 0.22)",
    borderColor: "rgba(160, 205, 255, 0.34)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonSmallText: {
    color: "#EAF4FF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyStateText: {
    color: "#C9D8EF",
    fontSize: 15,
    marginTop: 10,
  },
  locationCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(190, 210, 235, 0.16)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },
  locationCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  locationTextBlock: {
    flex: 1,
  },
  locationCardTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  locationCardText: {
    color: "#C9D8EF",
    fontSize: 15,
    marginBottom: 4,
  },
  badgeColumn: {
    alignItems: "flex-end",
    gap: 8,
  },
  currentBadge: {
    backgroundColor: "rgba(110, 160, 220, 0.22)",
    borderColor: "rgba(160, 205, 255, 0.30)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  homeBadge: {
    backgroundColor: "rgba(143, 214, 148, 0.16)",
    borderColor: "rgba(143, 214, 148, 0.26)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: "#EAF4FF",
    fontSize: 12,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButtonText: {
    color: "#E5EDF9",
    fontSize: 14,
    fontWeight: "600",
  },
  appActionButton: {
    backgroundColor: "rgba(125, 181, 255, 0.22)",
    borderColor: "rgba(160, 205, 255, 0.34)",
  },
  homeActionButton: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderColor: "rgba(190, 210, 235, 0.18)",
  },
  deleteActionButton: {
    backgroundColor: "rgba(176, 74, 94, 0.14)",
    borderColor: "rgba(255, 120, 140, 0.24)",
  },
  deleteActionText: {
    color: "#FFD7E0",
    fontSize: 14,
    fontWeight: "600",
  },
});
