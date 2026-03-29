import * as FileSystem from "expo-file-system/legacy";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
  const fallbackText = name.trim().slice(-1) || "U";

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
      Alert.alert("Notice", "Nickname cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const next = await updateCurrentUserNicknameInDb(clean);
      setProfile(next);
      setNicknameInput(next.nickname);
      Alert.alert("Saved", "Nickname updated.");
    } catch (error) {
      Alert.alert("Save failed", String(error));
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = async () => {
    const imagePicker = getImagePickerModule();
    if (!imagePicker) {
      Alert.alert(
        "Album unavailable",
        "This build does not include the image-picker native module.",
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
      Alert.alert("Saved", "Avatar updated.");
    } catch (error) {
      Alert.alert("Avatar update failed", String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Pressable
              style={styles.backButton}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/");
                }
              }}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Avatar uri={avatarUri} name={displayName} />

            <Pressable
              style={styles.pickAvatarButton}
              onPress={() => void onPickAvatar()}
              disabled={saving}
            >
              <Text style={styles.pickAvatarButtonText}>
                {saving ? "Working..." : "Choose avatar"}
              </Text>
            </Pressable>

            <Text style={styles.label}>Nickname</Text>
            <TextInput
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder="Enter nickname"
              placeholderTextColor="#8FA2B8"
              style={styles.input}
              maxLength={24}
            />

            <Text style={styles.label}>ULID account</Text>
            <Text style={styles.value}>{profile?.userId || current.id}</Text>

            <Pressable
              style={styles.button}
              onPress={() => void onSaveNickname()}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? "Saving..." : "Save nickname"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EEF4FA" },
  keyboardWrap: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 28 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 30, fontWeight: "700", color: "#19263B" },
  backButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#89A9DD",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backButtonText: { color: "#274F9A", fontWeight: "700", fontSize: 13 },
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
  pickAvatarButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#89A9DD",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
    width: "100%",
  },
  pickAvatarButtonText: { color: "#274F9A", fontWeight: "600", fontSize: 14 },
  label: {
    color: "#5B6D86",
    fontSize: 13,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  value: {
    color: "#1F2B40",
    fontSize: 16,
    fontWeight: "600",
    alignSelf: "flex-start",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#D2DDEB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1F2B40",
    backgroundColor: "#F8FBFF",
  },
  button: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: "#0A69F5",
    alignItems: "center",
    paddingVertical: 12,
    width: "100%",
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});
