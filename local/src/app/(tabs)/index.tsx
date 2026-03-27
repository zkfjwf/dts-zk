import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createSpaceForCurrentUser, joinSpaceByCode } from "./mockApp";

export default function SpaceLobbyPage() {
  const [spaceCodeInput, setSpaceCodeInput] = useState("");
  const [latestCreatedCode, setLatestCreatedCode] = useState("");

  const goSpacePage = (code: string) => {
    router.push({ pathname: "/team", params: { code } });
  };

  const onCreateSpace = () => {
    const space = createSpaceForCurrentUser();
    setLatestCreatedCode(space.code);
    setSpaceCodeInput(space.code);
    Alert.alert("创建成功", `已生成空间口令：${space.code}`);
    goSpacePage(space.code);
  };

  const onJoinSpace = () => {
    const result = joinSpaceByCode(spaceCodeInput);
    if (!result.ok) {
      Alert.alert("加入失败", result.message);
      return;
    }
    goSpacePage(result.space.code);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>旅行空间大厅</Text>
        <Text style={styles.subtitle}>创建旅行空间或输入口令加入</Text>

        <View style={styles.card}>
          <Text style={styles.label}>空间口令（ULID）</Text>
          <TextInput
            value={spaceCodeInput}
            onChangeText={(value) => setSpaceCodeInput(value.toUpperCase())}
            autoCapitalize="characters"
            placeholder="示例：01HV6M1S8QK2Y9F4N6R1W7T5V"
            placeholderTextColor="#8FA2B8"
            maxLength={26}
            style={styles.input}
          />

          <Pressable onPress={onCreateSpace} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>创建旅行空间</Text>
          </Pressable>

          <Pressable onPress={onJoinSpace} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>加入旅行空间</Text>
          </Pressable>

          <Text style={styles.helperText}>
            {latestCreatedCode
              ? `最近创建口令：${latestCreatedCode}`
              : "当前还没有创建新的旅行空间"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EEF4FA" },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 28 },
  title: { fontSize: 30, fontWeight: "700", color: "#19263B" },
  subtitle: { marginTop: 12, color: "#566982", fontSize: 14 },
  card: {
    marginTop: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  label: {
    color: "#25324A",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D2DDEB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1F2B40",
    backgroundColor: "#F8FBFF",
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: "#0A69F5",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  secondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#89A9DD",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryButtonText: { color: "#274F9A", fontWeight: "600", fontSize: 15 },
  helperText: { marginTop: 12, color: "#5A6D86", fontSize: 12 },
});
