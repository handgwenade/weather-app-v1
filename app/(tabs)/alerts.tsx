import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  // ... other styles ...
  hourlyList: {
    gap: 0,
  },
  hourlyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  hourlyTime: {
    width: 52,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#0F172B",
  },
  hourlyMain: {
    flex: 1,
    gap: 2,
  },
  hourlyTemp: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: "#0F172B",
  },
  hourlyCondition: {
    fontSize: 13,
    lineHeight: 18,
    color: "#556274",
  },
  hourlyMeta: {
    alignItems: "flex-end",
    gap: 2,
  },
  hourlyMetaText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#556274",
  },
  hourlyDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  // ... other styles ...
});
