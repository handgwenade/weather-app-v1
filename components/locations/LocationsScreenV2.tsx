import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type LocationCardTone = "neutral" | "highlight";

export type LocationCard = {
  id: string;
  title: string;
  categoryLabel: string;
  categoryTone: LocationCardTone;
  compact?: boolean;
  detailTags: string[];
  canDelete: boolean;
};

type LocationsScreenV2Props = {
  cards: LocationCard[];
  onPressSettings: () => void;
  onPressAdd: () => void;
  onPressDelete: (locationId: string) => void;
};

function getCategoryStyles(tone: LocationCardTone) {
  if (tone === "highlight") {
    return {
      backgroundColor: "#FFF7ED",
      textColor: "#CA3500",
      iconColor: "#F97316",
    };
  }

  return {
    backgroundColor: "#F5F5F5",
    textColor: "#59595B",
    iconColor: "#6B7280",
  };
}

export default function LocationsScreenV2({
  cards,
  onPressSettings,
  onPressAdd,
  onPressDelete,
}: LocationsScreenV2Props) {
  const compactCards = cards.filter((card) => card.compact);
  const fullCards = cards.filter((card) => !card.compact);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <Text style={styles.topTitle}>Locations</Text>

          <Pressable style={styles.settingsButton} onPress={onPressSettings}>
            <Ionicons name="settings-outline" size={24} color="#2F5DA8" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Operational Locations</Text>

          <Pressable style={styles.addButton} onPress={onPressAdd}>
            <Ionicons name="add-outline" size={16} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        {compactCards.length > 0 ? (
          <View style={styles.compactRow}>
            {compactCards.map((card) => {
              const categoryStyles = getCategoryStyles(card.categoryTone);

              return (
                <View key={card.id} style={styles.compactCard}>
                  <Text style={styles.cardTitle}>{card.title}</Text>

                  <View
                    style={[
                      styles.categoryChip,
                      { backgroundColor: categoryStyles.backgroundColor },
                    ]}
                  >
                    <Ionicons
                      name={
                        card.categoryTone === "highlight"
                          ? "alert-circle-outline"
                          : "location-outline"
                      }
                      size={14}
                      color={categoryStyles.iconColor}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: categoryStyles.textColor },
                      ]}
                    >
                      {card.categoryLabel}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.fullCardStack}>
          {fullCards.map((card) => {
            const categoryStyles = getCategoryStyles(card.categoryTone);

            return (
              <View key={card.id} style={styles.fullCard}>
                <View style={styles.fullCardHeader}>
                  <Text style={styles.cardTitle}>{card.title}</Text>

                  {card.canDelete ? (
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => onPressDelete(card.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#525252"
                      />
                    </Pressable>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.categoryChip,
                    { backgroundColor: categoryStyles.backgroundColor },
                  ]}
                >
                  <Ionicons
                    name={
                      card.categoryTone === "highlight"
                        ? "alert-circle-outline"
                        : "location-outline"
                    }
                    size={14}
                    color={categoryStyles.iconColor}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: categoryStyles.textColor },
                    ]}
                  >
                    {card.categoryLabel}
                  </Text>
                </View>

                {card.detailTags.length > 0 ? (
                  <View style={styles.tagsRow}>
                    {card.detailTags.map((tag) => (
                      <View key={tag} style={styles.detailTag}>
                        <Text style={styles.detailTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FCFF",
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#CAD5E2",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  topBarRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: {
    color: "#0F172B",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 28,
    letterSpacing: -0.44,
  },
  settingsButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#F9FCFF",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#1B1B1B",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 28,
    letterSpacing: -0.44,
  },
  addButton: {
    minWidth: 82,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#2E6FC7",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  compactRow: {
    flexDirection: "row",
    gap: 12,
  },
  compactCard: {
    flex: 1,
    minHeight: 91,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D4D4D4",
    borderRadius: 16,
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 15,
  },
  fullCardStack: {
    gap: 12,
  },
  fullCard: {
    minHeight: 129,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D4D4D4",
    borderRadius: 16,
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 15,
  },
  fullCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: "#1B1B1B",
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChip: {
    alignSelf: "flex-start",
    minHeight: 24,
    borderRadius: 28,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  detailTag: {
    minHeight: 24,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  detailTagText: {
    color: "#59595B",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
});
