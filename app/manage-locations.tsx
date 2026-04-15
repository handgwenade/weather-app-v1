import LocationsScreenContainer from "@/components/locations/LocationsScreenContainer";
import { Stack } from "expo-router";

export default function ManageLocationsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LocationsScreenContainer />
    </>
  );
}
