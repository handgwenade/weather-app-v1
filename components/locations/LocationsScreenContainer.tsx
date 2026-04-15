import LocationsScreenV2, {
  type LocationCard,
} from "@/components/locations/LocationsScreenV2";
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
  useSavedLocations,
} from "../../data/locationStore";
import {
  searchLocations,
  type GeocodingResult,
} from "../../services/geocoding";

function buildLocationCards(savedLocations: ReturnType<typeof useSavedLocations>): LocationCard[] {
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
  const cards = useMemo(() => buildLocationCards(savedLocations), [savedLocations]);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<GeocodingResult | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  function resetAddFlow() {
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
      setSearchMessage(error?.message ?? "Location search is temporarily unavailable.");
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
      await addSavedLocation({
        name: trimmedLabel,
        city: selectedResult.city,
        state: selectedResult.state,
        latitude: selectedResult.latitude,
        longitude: selectedResult.longitude,
      });

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
                <Text style={styles.modalTitle}>Add Location</Text>
                <Text style={styles.modalSubtitle}>
                  Search for a place, then save it using your own label.
                </Text>
              </View>

              <Pressable style={styles.modalCloseButton} onPress={handleCloseAdd}>
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
                    placeholderTextColor="#8A94A6"
                    style={styles.textInput}
                    value={searchQuery}
                  />

                  <Pressable
                    onPress={() => void handleSearch()}
                    style={styles.searchButton}
                  >
                    {searching ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.searchButtonText}>Search</Text>
                    )}
                  </Pressable>
                </View>

                <Text style={styles.helperText}>
                  {getSearchSummary(searchQuery, selectedResult, searchResults.length)}
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
                            <Text style={styles.resultTitle}>{result.name}</Text>
                            <Text style={styles.resultSubtitle}>
                              {result.city}, {result.state}
                            </Text>
                          </View>

                          {selected ? (
                            <Text style={styles.resultSelectedText}>Selected</Text>
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
                  placeholderTextColor="#8A94A6"
                  style={styles.textInput}
                  value={customLabel}
                />
                <Text style={styles.helperText}>
                  This label is what the app will show in Home, Road, Conditions, and Alerts.
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
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save location</Text>
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
    backgroundColor: "rgba(15, 23, 43, 0.34)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalHeaderText: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    color: "#0F172B",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    letterSpacing: -0.44,
  },
  modalSubtitle: {
    color: "#556274",
    fontSize: 14,
    lineHeight: 20,
  },
  modalCloseButton: {
    minHeight: 32,
    justifyContent: "center",
  },
  modalCloseButtonText: {
    color: "#2E6FC7",
    fontSize: 14,
    fontWeight: "600",
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
  },
  fieldLabel: {
    color: "#0F172B",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#CAD5E2",
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#0F172B",
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: "#FFFFFF",
  },
  searchButton: {
    minWidth: 92,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#2E6FC7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  helperText: {
    color: "#66768B",
    fontSize: 13,
    lineHeight: 18,
  },
  statusMessage: {
    color: "#B45309",
    fontSize: 13,
    lineHeight: 18,
  },
  resultsList: {
    gap: 10,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: "#D5DEE8",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  resultCardSelected: {
    borderColor: "#2E6FC7",
    backgroundColor: "#EEF6FF",
  },
  resultTextBlock: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    color: "#0F172B",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  resultSubtitle: {
    color: "#556274",
    fontSize: 13,
    lineHeight: 18,
  },
  resultSelectedText: {
    color: "#2E6FC7",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#2E6FC7",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#9CB8E0",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
});
