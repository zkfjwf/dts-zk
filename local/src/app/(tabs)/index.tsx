import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SoftIconBadge } from "@/components/SoftIconBadge";
import {
  ensureCurrentUserProfileInDb,
  getCurrentUserProfileFromDb,
} from "./userDb";
import { createSpaceForCurrentUser, joinSpaceByCode } from "./mockApp";

type HeaderUser = {
  nickname: string;
  avatarUri: string;
};

const FEATURE_ITEMS = [
  {
    title: "动态记录",
    description: "图文发布与评论互动",
    icon: "chatbubble-ellipses-outline" as const,
    tone: "sky" as const,
  },
  {
    title: "轻松记账",
    description: "同行消费一目了然",
    icon: "wallet-outline" as const,
    tone: "peach" as const,
  },
  {
    title: "位置共享",
    description: "实时同步旅伴位置",
    icon: "navigate-outline" as const,
    tone: "mint" as const,
  },
];

function HeaderAvatar({
  avatarUri,
  nickname,
  onPress,
}: {
  avatarUri: string;
  nickname: string;
  onPress: () => void;
}) {
  const fallback = nickname.trim().slice(-1) || "旅";

  return (
    <Pressable style={styles.headerAvatarWrap} onPress={onPress}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
      ) : (
        <View style={styles.headerAvatarFallback}>
          <Text style={styles.headerAvatarFallbackText}>{fallback}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function SpaceLobbyPage() {
  const [spaceCodeInput, setSpaceCodeInput] = useState("");
  const [latestCreatedCode, setLatestCreatedCode] = useState("");
  const [headerUser, setHeaderUser] = useState<HeaderUser>({
    nickname: "旅行者",
    avatarUri: "",
  });

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await ensureCurrentUserProfileInDb();
        const profile = await getCurrentUserProfileFromDb();
        setHeaderUser({
          nickname: profile.nickname,
          avatarUri: profile.avatarLocalUri || profile.avatarRemoteUrl || "",
        });
      })();
    }, []),
  );

  const helperText = useMemo(() => {
    if (latestCreatedCode) {
      return `最近创建的空间口令：${latestCreatedCode}`;
    }
    return "创建空间后，这里会显示最近一次生成的口令。";
  }, [latestCreatedCode]);

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <SoftIconBadge name="airplane-outline" tone="sky" size={56} />
              <View style={styles.heroBadgeTextWrap}>
                <Text style={styles.heroEyebrow}>极简旅程空间</Text>
                <Text style={styles.heroBadgeTitle}>轻盈协作 · 共同出发</Text>
              </View>
            </View>
            <HeaderAvatar
              avatarUri={headerUser.avatarUri}
              nickname={headerUser.nickname}
              onPress={() => router.push("/profile")}
            />
          </View>

          <Text style={styles.title}>旅行空间大厅</Text>
          <Text style={styles.subtitle}>
            创建属于你们的旅行空间，把动态、记账和位置共享收进同一个极简界面里。
          </Text>

          <View style={styles.featureRow}>
            {FEATURE_ITEMS.map((item) => (
              <View key={item.title} style={styles.featureCard}>
                <SoftIconBadge name={item.icon} tone={item.tone} size={52} />
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureDescription}>
                  {item.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.commandCard}>
          <View style={styles.commandHeader}>
            <SoftIconBadge name="key-outline" tone="violet" size={50} />
            <View style={styles.commandHeaderTextWrap}>
              <Text style={styles.commandTitle}>输入空间口令</Text>
              <Text style={styles.commandSubtitle}>
                使用口令快速加入旅伴已经创建好的空间。
              </Text>
            </View>
          </View>

          <TextInput
            value={spaceCodeInput}
            onChangeText={(value) => setSpaceCodeInput(value.toUpperCase())}
            autoCapitalize="characters"
            placeholder="例如：01HV6M1S8QK2Y9F4N6R1W7T5V"
            placeholderTextColor="#97A9BC"
            maxLength={26}
            style={styles.input}
          />

          <View style={styles.buttonGroup}>
            <Pressable onPress={onCreateSpace} style={styles.primaryButton}>
              <SoftIconBadge
                name="add-outline"
                tone="aqua"
                size={38}
                iconSize={18}
              />
              <Text style={styles.primaryButtonText}>创建旅行空间</Text>
            </Pressable>

            <Pressable onPress={onJoinSpace} style={styles.secondaryButton}>
              <SoftIconBadge
                name="enter-outline"
                tone="peach"
                size={38}
                iconSize={18}
              />
              <Text style={styles.secondaryButtonText}>加入已有空间</Text>
            </Pressable>
          </View>

          <View style={styles.helperCard}>
            <Text style={styles.helperLabel}>空间提示</Text>
            <Text style={styles.helperText}>{helperText}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 18,
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#ADC0DD",
    shadowOpacity: 0.14,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  heroBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroBadgeTextWrap: {
    flex: 1,
  },
  heroEyebrow: {
    color: "#5A7EC8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  heroBadgeTitle: {
    marginTop: 4,
    color: "#4D617C",
    fontSize: 13,
  },
  title: {
    marginTop: 22,
    color: "#1E2B3C",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 12,
    color: "#667C97",
    fontSize: 14,
    lineHeight: 22,
  },
  featureRow: {
    marginTop: 22,
    flexDirection: "row",
    gap: 10,
  },
  featureCard: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: "#F9FBFF",
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDF2F8",
    gap: 8,
  },
  featureTitle: {
    color: "#233247",
    fontSize: 14,
    fontWeight: "700",
  },
  featureDescription: {
    color: "#7A8CA3",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  headerAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  headerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#DCE7F5",
  },
  headerAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#4D7CFE",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4D7CFE",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  headerAvatarFallbackText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 18,
  },
  commandCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#C1D0E2",
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  commandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  commandHeaderTextWrap: {
    flex: 1,
  },
  commandTitle: {
    color: "#203044",
    fontSize: 18,
    fontWeight: "800",
  },
  commandSubtitle: {
    marginTop: 4,
    color: "#70839A",
    fontSize: 13,
    lineHeight: 20,
  },
  input: {
    marginTop: 18,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: "#24364D",
    backgroundColor: "#F7FAFF",
    borderWidth: 1,
    borderColor: "#E6EDF7",
  },
  buttonGroup: {
    marginTop: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#4D7CFE",
    borderRadius: 22,
    paddingVertical: 13,
    shadowColor: "#4D7CFE",
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 22,
    paddingVertical: 13,
    backgroundColor: "#F7FAFF",
    borderWidth: 1,
    borderColor: "#E3EAF5",
  },
  secondaryButtonText: {
    color: "#2A3E57",
    fontWeight: "700",
    fontSize: 15,
  },
  helperCard: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  helperLabel: {
    color: "#5A7EC8",
    fontSize: 12,
    fontWeight: "700",
  },
  helperText: {
    marginTop: 6,
    color: "#6B809A",
    fontSize: 13,
    lineHeight: 20,
  },
});
