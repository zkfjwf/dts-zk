import { Stack } from "expo-router";

export default function TabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="team" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="bookkeeping" />
      <Stack.Screen name="settlement" />
      <Stack.Screen name="location" />
    </Stack>
  );
}
