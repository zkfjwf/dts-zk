import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SoftIconBadge } from "@/components/SoftIconBadge";
import { getCurrentUser } from "./mockApp";
import {
  ensureCurrentUserProfileInDb,
  getCurrentUserProfileFromDb,
  updateCurrentUserAvatarInDb,
  updateCurrentUserNicknameInDb,
  type UserProfileData,
} from "./userDb";

type ImagePickerModule = {
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
    canceled: boolean;
    assets?: { uri: string }[];
  }>;
};

let imagePickerModuleCache: ImagePickerModule | null | undefined;

function getImagePickerModule() {
  if (imagePickerModuleCache !== undefined) {
    return imagePickerModuleCache;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    imagePickerModuleCache = require("expo-image-picker") as ImagePickerModule;
  } catch {
    imagePickerModuleCache = null;
  }
  return imagePickerModuleCache;
}

function getFileExt(uri: string) {
  const clean = uri.split("?")[0].split("#")[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,8})$/);
  return match ? `.${match[1].toLowerCase()}` : ".jpg";
}

async function ensureDir(targetDir: string) {
  const info = await FileSystem.getInfoAsync(targetDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
  }
}

async function saveAvatarToLocal(uri: string) {
  if (!FileSystem.documentDirectory) {
    return uri;
  }

  const baseDir = FileSystem.documentDirectory.endsWith("/")
    ? FileSystem.documentDirectory
    : `${FileSystem.documentDirectory}/`;
  const targetDir = `${baseDir}travel-avatar`;
  const targetPath = `${targetDir}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}${getFileExt(uri)}`;

  await ensureDir(targetDir);
  await FileSystem.copyAsync({ from: uri, to: targetPath });
  return targetPath;
}

function Avatar({ uri, name }: { uri: string; name: string }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const fallbackText = name.trim().slice(-1) || "旅";

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
  const current = useMemo(() => getCurrentUser(), []);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [saving, setSaving] = useState(false);

  const avatarUri = profile?.avatarLocalUri || profile?.avatarRemoteUrl || "";
  const displayName = profile?.nickname || current.username;

  const loadProfile = useCallback(async () => {
    await ensureCurrentUserProfileInDb();
    const row = await getCurrentUserProfileFromDb();
    setProfile(row);
    setNicknameInput(row.nickname);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const onSaveNickname = async () => {
    const clean = nicknameInput.trim();
    if (!clean) {
      Alert.alert("提示", "昵称不能为空。");
      return;
    }

    setSaving(true);
    try {
      const next = await updateCurrentUserNicknameInDb(clean);
      setProfile(next);
      setNicknameInput(next.nickname);
      Alert.alert("已保存", "昵称已经更新。");
    } catch (error) {
      Alert.alert("保存失败", String(error));
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = async () => {
    const imagePicker = getImagePickerModule();
    if (!imagePicker) {
      Alert.alert(
        "相册不可用",
        "当前构建未包含图片选择模块，请重新构建开发客户端。",
      );
      return;
    }

    try {
      const result = await imagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: false,
        selectionLimit: 1,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setSaving(true);
      const localAvatarUri = await saveAvatarToLocal(result.assets[0].uri);
      const next = await updateCurrentUserAvatarInDb(localAvatarUri);
      setProfile(next);
      Alert.alert("已保存", "头像已经更新，旅行空间里的动态头像会同步刷新。");
    } catch (error) {
      Alert.alert("头像更新失败", String(error));
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>个人资料</Text>
              <Text style={styles.subtitle}>
                保持头像与昵称统一，你的动态会自动同步展示。
              </Text>
            </View>
            <Pressable style={styles.backButton} onPress={goBack}>
              <Ionicons name="chevron-back" size={18} color="#2E4463" />
              <Text style={styles.backButtonText}>返回</Text>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Avatar uri={avatarUri} name={displayName} />
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.helperText}>
              当前头像会同步到春日旅行空间的动态列表。
            </Text>
            <View style={styles.profileMetaRow}>
              <View style={styles.profileMetaCard}>
                <SoftIconBadge
                  name="person-outline"
                  tone="sky"
                  size={46}
                  iconSize={20}
                />
                <Text style={styles.profileMetaLabel}>旅行昵称</Text>
              </View>
              <View style={styles.profileMetaCard}>
                <SoftIconBadge
                  name="images-outline"
                  tone="violet"
                  size={46}
                  iconSize={20}
                />
                <Text style={styles.profileMetaLabel}>头像同步</Text>
              </View>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.sectionHeader}>
              <SoftIconBadge
                name="sparkles-outline"
                tone="aqua"
                size={48}
                iconSize={20}
              />
              <View style={styles.sectionHeaderTextWrap}>
                <Text style={styles.sectionTitle}>编辑资料</Text>
                <Text style={styles.sectionSubtitle}>
                  使用简洁的信息卡片，让个人主页更轻松。
                </Text>
              </View>
            </View>

            <Text style={styles.label}>昵称</Text>
            <TextInput
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder="输入你的旅行昵称"
              placeholderTextColor="#9AACC0"
              style={styles.input}
              maxLength={24}
            />

            <Text style={styles.label}>用户账号</Text>
            <View style={styles.valueCard}>
              <Text style={styles.valueText}>
                {profile?.userId || current.id}
              </Text>
            </View>

            <View style={styles.buttonGroup}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => void onPickAvatar()}
                disabled={saving}
              >
                <SoftIconBadge
                  name="camera-outline"
                  tone="peach"
                  size={40}
                  iconSize={18}
                />
                <Text style={styles.secondaryButtonText}>
                  {saving ? "处理中..." : "选择头像"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.primaryButton}
                onPress={() => void onSaveNickname()}
                disabled={saving}
              >
                <SoftIconBadge
                  name="checkmark-outline"
                  tone="mint"
                  size={40}
                  iconSize={18}
                />
                <Text style={styles.primaryButtonText}>
                  {saving ? "保存中..." : "保存资料"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F7FB" },
  keyboardWrap: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    color: "#1D2C40",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 10,
    color: "#6E8198",
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 250,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5ECF6",
    shadowColor: "#CCD8E8",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  backButtonText: {
    color: "#2E4463",
    fontSize: 14,
    fontWeight: "700",
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 22,
    alignItems: "center",
    shadowColor: "#C5D3E2",
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#DFE9F7",
  },
  avatarFallback: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#4D7CFE",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4D7CFE",
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  avatarFallbackText: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "800",
  },
  displayName: {
    marginTop: 16,
    color: "#1F3045",
    fontSize: 24,
    fontWeight: "800",
  },
  helperText: {
    marginTop: 8,
    color: "#71849D",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  profileMetaRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  profileMetaCard: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#F8FBFF",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF2F8",
    gap: 8,
  },
  profileMetaLabel: {
    color: "#5E728D",
    fontSize: 12,
    fontWeight: "600",
  },
  formCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#C5D3E2",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionHeaderTextWrap: {
    flex: 1,
  },
  sectionTitle: {
    color: "#203044",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSubtitle: {
    marginTop: 4,
    color: "#7387A0",
    fontSize: 13,
    lineHeight: 20,
  },
  label: {
    color: "#637790",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#E6EDF7",
    color: "#23364D",
    fontSize: 15,
  },
  valueCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#EAF0F8",
  },
  valueText: {
    color: "#24364D",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonGroup: {
    marginTop: 22,
    gap: 12,
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
    borderColor: "#E4EBF5",
  },
  secondaryButtonText: {
    color: "#2A3E57",
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 22,
    paddingVertical: 13,
    backgroundColor: "#4D7CFE",
    shadowColor: "#4D7CFE",
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
