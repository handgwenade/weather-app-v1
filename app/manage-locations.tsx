import LocationsScreenV2, {
  type LocationCard,
  type LocationCardTone,
} from "@/components/locations/LocationsScreenV2";
import { Stack, useRouter } from "expo-router";
import { Alert } from "react-native";
import {
  deleteSavedLocation,
  useSavedLocations,
} from "../data/locationStore";

function getLocationCategory(name: string): {
  label: string;
  tone: LocationCardTone;
  detailTags: string[];
} {
  const value = name.toLowerCase();

  if (value.includes("shop") || value.includes("nursery")) {
    return {
      label: "Shop",
      tone: "neutral",
      detailTags: [],
    };
  }

  if (value.includes("bridge")) {
    return {
      label: "Problem Area",
      tone: "highlight",
      detailTags: ["Trouble Spot", "Freeze-prone"],
    };
  }

  if (value.includes("pass") || value.includes("summit")) {
    return {
      label: "Problem Area",
      tone: "highlight",
      detailTags: ["Trouble Spot", "Wind Exposure"],
    };
  }

  if (value.includes("i-80") || value.includes("i-25") || value.includes("corridor")) {
    return {
      label: "Corridor",
      tone: "neutral",
      detailTags: ["Drift Zone", "Wind Exposure"],
    };
  }

  return {
    label: "Location",
    tone: "neutral",
    detailTags: [],
  };
}

function buildLocationCards(locationNames: string[]): LocationCard[] {
  return locationNames.map((name, index) => {
    const category = getLocationCategory(name);

    return {
      id: `${name}-${index}`,
      title: name,
      categoryLabel: category.label,
      categoryTone: category.tone,
      compact: index < 2,
      detailTags: index < 2 ? [] : category.detailTags,
      canDelete: index >= 2,
    };
  });
}

export default function ManageLocationsScreen() {
  const router = useRouter();
  const savedLocations = useSavedLocations();

  const cards = buildLocationCards(savedLocations.map((location) => location.name));

  function handlePressAdd() {
    Alert.alert(
      "Add location",
      "The add-location flow is not shown in this exact frame yet, so this pass keeps the screen aligned to the design.",
    );
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
      <Stack.Screen options={{ headerShown: false }} />

      <LocationsScreenV2
        cards={cards.map((card, index) => ({
          ...card,
          id: savedLocations[index]?.id ?? card.id,
        }))}
        onPressSettings={() => router.push("/settings")}
        onPressAdd={handlePressAdd}
        onPressDelete={handleDelete}
      />
    </>
  );
}
