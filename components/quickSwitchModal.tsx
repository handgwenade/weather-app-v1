import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Palette, Radius, Shadows } from "../constants/theme";
import { formatCityState, type AppLocation } from "../data/locationStore";

type QuickSwitchModalProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  currentLocationId: string | null;
  savedLocations: AppLocation[];
  onClose: () => void;
  onSelectLocation: (locationId: string) => void | Promise<void>;
  onManageLocations: () => void;
};

export default function QuickSwitchModal({
  visible,
  title,
  subtitle,
  currentLocationId,
  savedLocations,
  onClose,
  onSelectLocation,
  onManageLocations,
}: QuickSwitchModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalTopRow}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose}>
              <Ionicons
                name="close-outline"
                size={26}
                color={Palette.textOnDark}
              />
            </Pressable>
          </View>

          <Text style={styles.modalSubtext}>{subtitle}</Text>

          <View style={styles.modalList}>
            {savedLocations.map((location) => {
              const isCurrent = location.id === currentLocationId;

              return (
                <Pressable
                  key={location.id}
                  accessibilityRole={isCurrent ? undefined : "button"}
                  disabled={isCurrent}
                  onPress={() => void onSelectLocation(location.id)}
                  style={[
                    styles.modalLocationRow,
                    isCurrent ? styles.modalLocationRowActive : null,
                  ]}
                >
                  <View style={styles.modalLocationTextBlock}>
                    <Text style={styles.modalLocationTitle}>
                      {location.name}
                    </Text>
                    <Text style={styles.modalLocationText}>
                      {formatCityState(location)}
                    </Text>
                  </View>

                  {isCurrent ? (
                    <View style={styles.modalCurrentBadge}>
                      <Text style={styles.modalCurrentBadgeText}>Current</Text>
                    </View>
                  ) : (
                    <View style={styles.modalSelectButton}>
                      <Ionicons
                        name="chevron-forward-outline"
                        size={18}
                        color={Palette.textMuted}
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={styles.modalManageButton}
            onPress={onManageLocations}
          >
            <Ionicons
              name="location-outline"
              size={20}
              color={Palette.textOnDark}
            />
            <Text style={styles.modalManageButtonText}>Manage Locations</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 20, 46, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 390,
    borderRadius: Radius.xl,
    backgroundColor: Palette.midnight,
    borderWidth: 1,
    borderColor: "rgba(72, 199, 244, 0.18)",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    ...Shadows.soft,
  },
  modalTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  modalTitle: {
    flex: 1,
    color: Palette.textOnDark,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.75,
  },
  modalSubtext: {
    color: "rgba(255, 255, 255, 0.74)",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 18,
  },
  modalList: {
    gap: 10,
    marginBottom: 18,
  },
  modalLocationRow: {
    minHeight: 74,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalLocationRowActive: {
    borderColor: "rgba(72, 199, 244, 0.35)",
    backgroundColor: "rgba(72, 199, 244, 0.12)",
  },
  modalLocationTextBlock: {
    flex: 1,
  },
  modalLocationTitle: {
    color: Palette.textOnDark,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: -0.25,
    marginBottom: 2,
  },
  modalLocationText: {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: 14,
    lineHeight: 20,
  },
  modalCurrentBadge: {
    minHeight: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(72, 199, 244, 0.35)",
    backgroundColor: "rgba(72, 199, 244, 0.15)",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCurrentBadgeText: {
    color: Palette.textOnDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  modalSelectButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalManageButton: {
    minHeight: 52,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(72, 199, 244, 0.35)",
    backgroundColor: "rgba(72, 199, 244, 0.14)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modalManageButtonText: {
    color: Palette.textOnDark,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.25,
  },
});
