import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
              <Ionicons name="close-outline" size={24} color="#ffffff" />
            </Pressable>
          </View>

          <Text style={styles.modalSubtext}>{subtitle}</Text>

          <View style={styles.modalList}>
            {savedLocations.map((location) => {
              const isCurrent = location.id === currentLocationId;

              return (
                <View
                  key={location.id}
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
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void onSelectLocation(location.id)}
                      style={styles.modalSelectButton}
                    >
                      <Ionicons
                        name="chevron-forward-outline"
                        size={18}
                        color="#8fa3c2"
                      />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          <Pressable
            style={styles.modalManageButton}
            onPress={onManageLocations}
          >
            <Ionicons name="location-outline" size={18} color="#EAF4FF" />
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
    backgroundColor: "rgba(5, 10, 20, 0.68)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#10203F",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(190, 210, 235, 0.16)",
  },
  modalTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "600",
  },
  modalSubtext: {
    color: "#b8c6e0",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 16,
  },
  modalList: {
    gap: 10,
    marginBottom: 16,
  },
  modalLocationRow: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(190, 210, 235, 0.16)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalLocationRowActive: {
    backgroundColor: "rgba(125, 181, 255, 0.14)",
    borderColor: "rgba(160, 205, 255, 0.28)",
  },
  modalLocationTextBlock: {
    flex: 1,
  },
  modalLocationTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  modalLocationText: {
    color: "#C9D8EF",
    fontSize: 14,
  },
  modalCurrentBadge: {
    backgroundColor: "rgba(110, 160, 220, 0.22)",
    borderColor: "rgba(160, 205, 255, 0.30)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalCurrentBadgeText: {
    color: "#EAF4FF",
    fontSize: 12,
    fontWeight: "600",
  },
  modalSelectButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalManageButton: {
    backgroundColor: "rgba(125, 181, 255, 0.22)",
    borderColor: "rgba(160, 205, 255, 0.34)",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modalManageButtonText: {
    color: "#EAF4FF",
    fontSize: 16,
    fontWeight: "600",
  },
});
