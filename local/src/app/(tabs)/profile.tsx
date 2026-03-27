import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getCurrentUser } from "./mockApp";

function Avatar({ uri, name }: { uri: string; name: string }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const fallbackText = name?.trim()?.slice(-1) || "我";

  if (loadFailed || !uri) {
    return (
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarFallbackText}>{fallbackText}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.avatar}
      onError={() => setLoadFailed(true)}
    />
  );
}

export default function ProfilePage() {
  const user = useMemo(() => getCurrentUser(), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>个人信息</Text>

        <View style={styles.card}>
          <Avatar uri={user.avatarUrl} name={user.username} />
          <Text style={styles.label}>用户名</Text>
          <Text style={styles.value}>{user.username}</Text>
          <Text style={styles.label}>账号 ID</Text>
          <Text style={styles.value}>{user.id}</Text>
        </View>

        <Pressable onPress={() => router.replace("/")} style={styles.button}>
          <Text style={styles.buttonText}>返回旅行空间大厅</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EEF4FA" },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 28 },
  title: { fontSize: 30, fontWeight: "700", color: "#19263B" },
  card: {
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 16,
    alignItems: "center",
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#D9E5F4",
    marginBottom: 8,
  },
  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#4F7EDB",
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "700",
  },
  label: {
    color: "#5B6D86",
    fontSize: 13,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  value: {
    color: "#1F2B40",
    fontSize: 18,
    fontWeight: "600",
    alignSelf: "flex-start",
  },
  button: {
    marginTop: 20,
    borderRadius: 10,
    backgroundColor: "#0A69F5",
    alignItems: "center",
    paddingVertical: 11,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});
