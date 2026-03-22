import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="network" options={{ title: "Test Network" }} />
      <Tabs.Screen name="db" options={{ title: "Test DB" }} />
    </Tabs>
  );
}
