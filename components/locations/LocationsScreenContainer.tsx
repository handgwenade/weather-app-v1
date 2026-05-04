import LocationsScreenV2, {
  type LocationCard,
} from "@/components/locations/LocationsScreenV2";
import { Palette, Radius, Shadows } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  addSavedLocation,
  deleteSavedLocation,
  formatCityState,
  updateSavedLocation,
  useSavedLocations,
} from "../../data/locationStore";
import {
  searchLocations,
  type GeocodingResult,
} from "../../services/geocoding";

function buildLocationCards(
  savedLocations: ReturnType<typeof useSavedLocations>,
): LocationCard[] {
  return savedLocations.map((location) => ({
    id: location.id,
    title: location.name,
    subtitle: formatCityState(location),
    canDelete: true,
  }));
}

function getSearchSummary(
  searchQuery: string,
  selectedResult: GeocodingResult | null,
  resultsLength: number,
) {
  if (selectedResult) {
    return `Selected place: ${selectedResult.name}`;
  }

  if (!searchQuery.trim()) {
    return "Search for a place, then set the label you want to save.";
  }

  if (resultsLength === 0) {
    return "Search results will appear here.";
  }

  return "Choose the place you want to save.";
}

export default function LocationsScreenContainer() {
  const router = useRouter();
  const savedLocations = useSavedLocations();
  const cards = useMemo(
    () => buildLocationCards(savedLocations),
    [savedLocations],
  );

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<GeocodingResult | null>(
    null,
  );
  const [customLabel, setCustomLabel] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  function resetAddFlow() {
    setEditingLocationId(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedResult(null);
    setCustomLabel("");
    setSearching(false);
    setSaving(false);
    setSearchMessage(null);
  }

  function handlePressAdd() {
    resetAddFlow();
    setAddModalVisible(true);
  }

  function handlePressCard(locationId: string) {
    const location = savedLocations.find((item) => item.id === locationId);

    if (!location) {
      return;
    }

    setEditingLocationId(location.id);
    setSearchQuery(`${location.city}, ${location.state}`);
    setSearchResults([]);
    setSelectedResult({
      id: location.id,
      name: location.name,
      city: location.city,
      state: location.state,
      country: "US",
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setCustomLabel(location.name);
    setSearching(false);
    setSaving(false);
    setSearchMessage("Update the label or search for a replacement place.");
    setAddModalVisible(true);
  }

  function handleCloseAdd() {
    setAddModalVisible(false);
    resetAddFlow();
  }

  async function handleSearch() {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setSearchMessage("Enter a place to search.");
      setSearchResults([]);
      setSelectedResult(null);
      return;
    }

    setSearching(true);
    setSearchMessage(null);

    try {
      const results = await searchLocations(trimmedQuery);

      setSearchResults(results);
      setSelectedResult(null);

      if (results.length === 0) {
        setSearchMessage("No places matched that search.");
      }
    } catch (error: any) {
      setSearchResults([]);
      setSelectedResult(null);
      setSearchMessage(
        error?.message ?? "Location search is temporarily unavailable.",
      );
    } finally {
      setSearching(false);
    }
  }

  function handleSelectResult(result: GeocodingResult) {
    setSelectedResult(result);
    setCustomLabel(result.name);
    setSearchMessage(null);
  }

  async function handleSaveLocation() {
    if (!selectedResult) {
      setSearchMessage("Choose a place before saving.");
      return;
    }

    const trimmedLabel = customLabel.trim();

    if (!trimmedLabel) {
      setSearchMessage("Enter the label you want to save.");
      return;
    }

    setSaving(true);

    try {
      if (editingLocationId) {
        await updateSavedLocation(editingLocationId, {
          name: trimmedLabel,
          city: selectedResult.city,
          state: selectedResult.state,
          latitude: selectedResult.latitude,
          longitude: selectedResult.longitude,
        });
      } else {
        await addSavedLocation({
          name: trimmedLabel,
          city: selectedResult.city,
          state: selectedResult.state,
          latitude: selectedResult.latitude,
          longitude: selectedResult.longitude,
        });
      }

      handleCloseAdd();
    } catch (error: any) {
      Alert.alert(
        "Could not save location",
        error?.message ?? "Something went wrong while saving this location.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(locationId: string) {
    const location = savedLocations.find((item) => item.id === locationId);

    if (!location) {
      return;
    }

    Alert.alert(
      "Delete location?",
      `Remove ${location.name} from saved locations?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSavedLocation(location.id);
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
    <>
      <LocationsScreenV2
        cards={cards}
        onPressSettings={() => router.push("/settings")}
        onPressAdd={handlePressAdd}
        onPressCard={handlePressCard}
        onPressDelete={handleDelete}
      />

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        transparent
        visible={addModalVisible}
        onRequestClose={handleCloseAdd}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  {editingLocationId ? "Edit Location" : "Add Location"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editingLocationId
                    ? "Update the saved label or choose a different place to replace it."
                    : "Search for a place, then save it using your own label."}
                </Text>
              </View>

              <Pressable
                style={styles.modalCloseButton}
                onPress={handleCloseAdd}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sectionBlock}>
                <Text style={styles.fieldLabel}>Search place</Text>
                <View style={styles.searchRow}>
                  <TextInput
                    autoCapitalize="words"
                    autoCorrect={false}
                    onChangeText={setSearchQuery}
                    placeholder="City, address, or point of interest"
                    placeholderTextColor={Palette.textMuted}
                    style={styles.textInput}
                    value={searchQuery}
                  />

                  <Pressable
                    onPress={() => void handleSearch()}
                    style={styles.searchButton}
                  >
                    {searching ? (
                      <ActivityIndicator
                        color={Palette.textOnDark}
                        size="small"
                      />
                    ) : (
                      <Text style={styles.searchButtonText}>Search</Text>
                    )}
                  </Pressable>
                </View>

                <Text style={styles.helperText}>
                  {getSearchSummary(
                    searchQuery,
                    selectedResult,
                    searchResults.length,
                  )}
                </Text>

                {searchMessage ? (
                  <Text style={styles.statusMessage}>{searchMessage}</Text>
                ) : null}
              </View>

              {searchResults.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.fieldLabel}>Search results</Text>

                  <View style={styles.resultsList}>
                    {searchResults.map((result) => {
                      const selected = result.id === selectedResult?.id;

                      return (
                        <Pressable
                          key={result.id}
                          onPress={() => handleSelectResult(result)}
                          style={[
                            styles.resultCard,
                            selected ? styles.resultCardSelected : null,
                          ]}
                        >
                          <View style={styles.resultTextBlock}>
                            <Text style={styles.resultTitle}>
                              {result.name}
                            </Text>
                            <Text style={styles.resultSubtitle}>
                              {result.city}, {result.state}
                            </Text>
                          </View>

                          {selected ? (
                            <Text style={styles.resultSelectedText}>
                              Selected
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.sectionBlock}>
                <Text style={styles.fieldLabel}>Saved label</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  onChangeText={setCustomLabel}
                  placeholder="Enter the label you want to use"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.textInput}
                  value={customLabel}
                />
                <Text style={styles.helperText}>
                  This label is what the app will show in Home, Road,
                  Conditions, and Alerts.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={handleSaveLocation}
                style={[
                  styles.saveButton,
                  !selectedResult || !customLabel.trim() || saving
                    ? styles.saveButtonDisabled
                    : null,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={Palette.textOnDark} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingLocationId ? "Save changes" : "Save location"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 20, 46, 0.48)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "92%",
    backgroundColor: Palette.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    paddingTop: 18,
    overflow: "hidden",
    ...Shadows.card,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(221, 227, 243, 0.85)",
  },
  modalHeaderText: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    color: Palette.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 30,
    letterSpacing: -0.55,
  },
  modalSubtitle: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  modalCloseButton: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
    paddingHorizontal: 13,
  },
  modalCloseButtonText: {
    color: Palette.primary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 20,
  },
  sectionBlock: {
    gap: 10,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...Shadows.card,
  },
  fieldLabel: {
    color: Palette.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    color: Palette.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: Palette.backgroundCool,
  },
  searchButton: {
    minWidth: 92,
    minHeight: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    ...Shadows.soft,
  },
  searchButtonText: {
    color: Palette.textOnDark,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  helperText: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  statusMessage: {
    color: "#8A4B00",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  resultsList: {
    gap: 10,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: Palette.surface,
  },
  resultCardSelected: {
    borderColor: "rgba(86, 55, 255, 0.28)",
    backgroundColor: Palette.primarySoft,
  },
  resultTextBlock: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    color: Palette.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 22,
  },
  resultSubtitle: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  resultSelectedText: {
    color: Palette.primary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(221, 227, 243, 0.85)",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Palette.background,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.soft,
  },
  saveButtonDisabled: {
    backgroundColor: Palette.textMuted,
    borderColor: "rgba(148, 163, 184, 0.25)",
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: Palette.textOnDark,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 22,
  },
});
