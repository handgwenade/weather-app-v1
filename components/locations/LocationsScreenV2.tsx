import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type LocationCard = {
  id: string;
  title: string;
  subtitle: string;
  canDelete: boolean;
};

type LocationsScreenV2Props = {
  cards: LocationCard[];
  onPressSettings: () => void;
  onPressAdd: () => void;
  onPressCard: (locationId: string) => void;
  onPressDelete: (locationId: string) => void;
};

export default function LocationsScreenV2({
  cards,
  onPressSettings,
  onPressAdd,
  onPressCard,
  onPressDelete,
}: LocationsScreenV2Props) {
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

        {cards.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyStateIconWrap}>
              <Ionicons name="location-outline" size={24} color="#2E6FC7" />
            </View>
            <Text style={styles.emptyStateTitle}>No saved locations yet</Text>
            <Text style={styles.emptyStateBody}>
              Add a location to start monitoring places you care about.
            </Text>
            <Pressable style={styles.emptyStateButton} onPress={onPressAdd}>
              <Ionicons name="add-outline" size={16} color="#FFFFFF" />
              <Text style={styles.emptyStateButtonText}>Add location</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cardStack}>
            {cards.map((card) => (
              <Pressable
                key={card.id}
                accessibilityRole="button"
                onPress={() => onPressCard(card.id)}
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTextBlock}>
                    <Text style={styles.cardTitle}>{card.title}</Text>
                    <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                  </View>

                  {card.canDelete ? (
                    <Pressable
                      accessibilityRole="button"
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
              </Pressable>
            ))}
          </View>
        )}
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
  emptyStateCard: {
    minHeight: 220,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D4D4D4",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 28,
    alignItems: "center",
  },
  emptyStateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EAF4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateTitle: {
    color: "#1B1B1B",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 28,
    letterSpacing: -0.44,
    textAlign: "center",
    marginTop: 18,
  },
  emptyStateBody: {
    color: "#556274",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 260,
  },
  emptyStateButton: {
    minWidth: 142,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#2E6FC7",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 20,
  },
  emptyStateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  cardStack: {
    gap: 12,
  },
  card: {
    minHeight: 90,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D4D4D4",
    borderRadius: 16,
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 15,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTextBlock: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
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
  cardSubtitle: {
    color: "#556274",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
});
