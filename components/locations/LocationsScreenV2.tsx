import { Palette, Radius, Shadows } from "@/constants/theme";
import { useScrollToTopOnFocus } from "@/hooks/useScrollToTopOnFocus";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef } from "react";
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
  const scrollViewRef = useRef<ScrollView>(null);

  useScrollToTopOnFocus(scrollViewRef);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <Text style={styles.topTitle}>Locations</Text>

          <Pressable style={styles.settingsButton} onPress={onPressSettings}>
            <Ionicons
              name="settings-outline"
              size={22}
              color={Palette.primary}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Operational Locations</Text>

          <Pressable style={styles.addButton} onPress={onPressAdd}>
            <Ionicons name="add-outline" size={16} color={Palette.textOnDark} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        {cards.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyStateIconWrap}>
              <Ionicons
                name="location-outline"
                size={26}
                color={Palette.primary}
              />
            </View>
            <Text style={styles.emptyStateTitle}>No saved locations yet</Text>
            <Text style={styles.emptyStateBody}>
              Add a location to start monitoring places you care about.
            </Text>
            <Pressable style={styles.emptyStateButton} onPress={onPressAdd}>
              <Ionicons
                name="add-outline"
                size={16}
                color={Palette.textOnDark}
              />
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
                        color={Palette.textSecondary}
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
    backgroundColor: Palette.background,
  },
  topBar: {
    backgroundColor: Palette.background,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(221, 227, 243, 0.75)",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
  },
  topBarRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: {
    color: Palette.textPrimary,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: -0.52,
  },
  settingsButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
  },
  scrollView: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: Palette.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  addButton: {
    minWidth: 84,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.2)",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...Shadows.soft,
  },
  addButtonText: {
    color: Palette.textOnDark,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  emptyStateCard: {
    minHeight: 240,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.xl,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 28,
    alignItems: "center",
    ...Shadows.card,
  },
  emptyStateIconWrap: {
    width: 58,
    height: 58,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateTitle: {
    color: Palette.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: -0.52,
    textAlign: "center",
    marginTop: 18,
  },
  emptyStateBody: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 260,
  },
  emptyStateButton: {
    minWidth: 150,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.2)",
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 22,
    ...Shadows.soft,
  },
  emptyStateButtonText: {
    color: Palette.textOnDark,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  cardStack: {
    gap: 12,
  },
  card: {
    minHeight: 96,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.xl,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    ...Shadows.card,
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
    color: Palette.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  deleteButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    backgroundColor: Palette.backgroundCool,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
  },
  cardSubtitle: {
    color: Palette.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
});
