import { Q } from "@nozbe/watermelondb";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { database } from "@/model";
import Photo from "@/model/Photo";
import Post from "@/model/Post";
import {
  addCommentToPost,
  disbandSpaceByCode,
  getCurrentUser,
  getSpaceByCode,
  leaveSpaceByCode,
  type SpaceData,
} from "./mockApp";

type ImagePickerModule = typeof import("expo-image-picker");

type FeedPost = {
  id: string;
  uploaderId: string;
  uploaderName: string;
  text: string;
  imageUris: string[];
  createdAt: number;
  comments: { id: string; author: string; text: string }[];
  source: "mock" | "db";
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

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Avatar({ uri, name }: { uri?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const text = name.trim().slice(-1) || "U";

  if (!uri || failed) {
    return (
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarFallbackText}>{text}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.avatar}
      onError={() => setFailed(true)}
    />
  );
}

export default function TeamPage() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const spaceCode = typeof code === "string" ? code : "";
  const currentUser = getCurrentUser();

  const [space, setSpace] = useState<SpaceData | null>(() =>
    spaceCode ? getSpaceByCode(spaceCode) : null,
  );
  const [dbPosts, setDbPosts] = useState<FeedPost[]>([]);
  const [postText, setPostText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {},
  );
  const [menuOpen, setMenuOpen] = useState(false);

  const loadDbPosts = useCallback(async (spaceId: string) => {
    const postCollection = database.collections.get<Post>("posts");
    const photoCollection = database.collections.get<Photo>("photos");

    const posts = await postCollection
      .query(Q.where("space_id", spaceId), Q.sortBy("created_at", Q.desc))
      .fetch();

    const photos = await photoCollection
      .query(Q.where("space_id", spaceId))
      .fetch();
    const photoMap = new Map<string, string[]>();

    photos.forEach((item) => {
      if (!item.postId) {
        return;
      }
      const list = photoMap.get(item.postId) ?? [];
      list.push(item.remoteUrl || item.localPath);
      photoMap.set(item.postId, list);
    });

    setDbPosts(
      posts.map((item) => ({
        id: item.id,
        uploaderId: item.uploaderId,
        uploaderName: item.uploaderName || "Member",
        text: item.textContent || "",
        imageUris: photoMap.get(item.id) ?? [],
        createdAt:
          item.createdAt instanceof Date
            ? item.createdAt.getTime()
            : Date.now(),
        comments: [],
        source: "db",
      })),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!spaceCode) {
        setSpace(null);
        setDbPosts([]);
        return;
      }

      const nextSpace = getSpaceByCode(spaceCode);
      setSpace(nextSpace);
      if (nextSpace) {
        void loadDbPosts(nextSpace.id);
      } else {
        setDbPosts([]);
      }
    }, [spaceCode, loadDbPosts]),
  );

  const users = useMemo(() => {
    const map = new Map<string, { nickname: string; avatarUrl: string }>();
    for (const user of space?.users ?? []) {
      map.set(user.id, user);
    }
    return map;
  }, [space]);

  const feedPosts = useMemo(() => {
    const mockPosts: FeedPost[] = (space?.posts ?? []).map((post) => ({
      id: post.id,
      uploaderId: post.uploader_id,
      uploaderName: post.uploader_name,
      text: post.text,
      imageUris: post.image_uris,
      createdAt: post.created_at,
      comments: post.comments.map((comment) => ({
        id: comment.id,
        author: comment.author,
        text: comment.text,
      })),
      source: "mock",
    }));

    return [...dbPosts, ...mockPosts].sort((a, b) => b.createdAt - a.createdAt);
  }, [dbPosts, space]);

  const pickImagesFromAlbum = async () => {
    const imagePicker = getImagePickerModule();
    if (!imagePicker) {
      Alert.alert(
        "Album unavailable",
        "This build does not include image-picker native module. Rebuild Dev Client or use image URLs.",
      );
      return;
    }

    try {
      const permission =
        await imagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission denied", "Please allow media access first.");
        return;
      }

      const result = await imagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 6,
      });

      if (result.canceled) {
        return;
      }

      const uris = result.assets
        .map((asset: { uri: string }) => asset.uri)
        .filter(Boolean);
      const merged = [...selectedImageUris, ...uris];
      const unique = Array.from(new Set(merged));
      setSelectedImageUris(unique);
    } catch (error) {
      Alert.alert("Album error", `Open album failed: ${String(error)}`);
    }
  };

  const removeSelectedImage = (uri: string) => {
    setSelectedImageUris((prev) => prev.filter((item) => item !== uri));
  };

  const onPublishPost = async () => {
    if (!space) {
      return;
    }

    const cleanText = postText.trim();
    const urlImages = imageUrl
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    const imageUris = Array.from(new Set([...urlImages, ...selectedImageUris]));

    if (!cleanText && imageUris.length === 0) {
      Alert.alert(
        "Publish failed",
        "Please enter text or select at least one image.",
      );
      return;
    }

    await database.write(async () => {
      const postCollection = database.collections.get<Post>("posts");
      const photoCollection = database.collections.get<Photo>("photos");

      let createdPostId = "";
      await postCollection.create((post) => {
        post.spaceId = space.id;
        post.uploaderId = currentUser.id;
        post.uploaderName = currentUser.username;
        post.textContent = cleanText;
        createdPostId = post.id;
      });

      for (const uri of imageUris) {
        await photoCollection.create((photo) => {
          photo.spaceId = space.id;
          photo.postId = createdPostId;
          photo.uploaderId = currentUser.id;
          photo.localPath = uri;
          photo.remoteUrl = uri;
        });
      }
    });

    await loadDbPosts(space.id);
    setPostText("");
    setImageUrl("");
    setSelectedImageUris([]);
  };

  const onComment = (postId: string) => {
    if (!spaceCode) {
      return;
    }

    const result = addCommentToPost(
      spaceCode,
      postId,
      commentInputs[postId] ?? "",
    );
    if (!result.ok) {
      Alert.alert("Comment failed", result.message);
      return;
    }

    setSpace(result.space);
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
  };

  const onLeave = () => {
    setMenuOpen(false);
    if (!spaceCode) {
      return;
    }

    const result = leaveSpaceByCode(spaceCode);
    if (!result.ok) {
      Alert.alert("Leave failed", result.message);
      return;
    }

    Alert.alert("Left", result.message);
    router.replace("/");
  };

  const onDisband = () => {
    setMenuOpen(false);
    if (!spaceCode) {
      return;
    }

    const ok = disbandSpaceByCode(spaceCode);
    if (!ok) {
      Alert.alert("Disband failed", "Space does not exist.");
      return;
    }

    router.replace("/");
  };

  if (!space) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <Text style={styles.emptyTitle}>Space not found</Text>
          <Pressable style={styles.mainBtn} onPress={() => router.replace("/")}>
            <Text style={styles.mainBtnText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{space.name}</Text>
              <Text style={styles.subTitle}>Code: {space.code}</Text>
            </View>
            <Pressable
              style={styles.menuTrigger}
              onPress={() => setMenuOpen((v) => !v)}
            >
              <Text style={styles.menuTriggerText}>+</Text>
            </Pressable>
          </View>

          {menuOpen ? (
            <View style={styles.menuCard}>
              <Pressable
                style={styles.menuItem}
                onPress={() =>
                  router.push({
                    pathname: "/bookkeeping",
                    params: { code: spaceCode },
                  })
                }
              >
                <Text style={styles.menuText}>Bookkeeping</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() =>
                  router.push({
                    pathname: "/location",
                    params: { code: spaceCode },
                  })
                }
              >
                <Text style={styles.menuText}>Location</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={onLeave}>
                <Text style={styles.menuText}>Leave</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={onDisband}>
                <Text style={styles.menuDangerText}>Disband</Text>
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            style={styles.feed}
            contentContainerStyle={styles.feedContent}
            keyboardShouldPersistTaps="handled"
          >
            {feedPosts.map((post) => {
              const author = users.get(post.uploaderId);

              return (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <Avatar uri={author?.avatarUrl} name={post.uploaderName} />
                    <View>
                      <Text style={styles.author}>{post.uploaderName}</Text>
                      <Text style={styles.meta}>
                        {formatTime(post.createdAt)}
                      </Text>
                    </View>
                  </View>

                  {post.text ? (
                    <Text style={styles.postText}>{post.text}</Text>
                  ) : null}

                  {post.imageUris.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {post.imageUris.map((uri, idx) => (
                        <Image
                          key={`${post.id}-${idx}-${uri}`}
                          source={{ uri }}
                          style={styles.postImage}
                        />
                      ))}
                    </ScrollView>
                  ) : null}

                  {post.source === "mock" ? (
                    <>
                      <View style={styles.commentList}>
                        {post.comments.length === 0 ? (
                          <Text style={styles.commentHint}>No comments</Text>
                        ) : (
                          post.comments.map((comment) => (
                            <View key={comment.id} style={styles.commentItem}>
                              <Text style={styles.commentAuthor}>
                                {comment.author}
                              </Text>
                              <Text style={styles.commentText}>
                                {comment.text}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>

                      <View style={styles.commentRow}>
                        <TextInput
                          style={styles.commentInput}
                          placeholder="Write comment"
                          value={commentInputs[post.id] ?? ""}
                          onChangeText={(text) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [post.id]: text,
                            }))
                          }
                          multiline
                          textAlignVertical="top"
                        />
                        <Pressable
                          style={styles.commentBtn}
                          onPress={() => onComment(post.id)}
                        >
                          <Text style={styles.commentBtnText}>Send</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.commentHint}>
                      DB posts do not support comments yet.
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Post text"
              value={postText}
              onChangeText={setPostText}
              multiline
              textAlignVertical="top"
            />
            <TextInput
              style={styles.input}
              placeholder="Image URLs (comma or newline separated)"
              value={imageUrl}
              onChangeText={setImageUrl}
              multiline
              textAlignVertical="top"
            />

            <Pressable
              style={styles.pickImageBtn}
              onPress={() => void pickImagesFromAlbum()}
            >
              <Text style={styles.pickImageBtnText}>
                Pick images from album
              </Text>
            </Pressable>

            {selectedImageUris.length > 0 ? (
              <ScrollView
                horizontal
                style={styles.selectedImageRow}
                showsHorizontalScrollIndicator={false}
              >
                {selectedImageUris.map((uri, idx) => (
                  <Pressable
                    key={`${idx}-${uri}`}
                    onPress={() => removeSelectedImage(uri)}
                  >
                    <Image source={{ uri }} style={styles.selectedImage} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <Pressable
              style={styles.mainBtn}
              onPress={() => void onPublishPost()}
            >
              <Text style={styles.mainBtnText}>Publish</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EAF1FA" },
  keyboardWrap: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  emptyTitle: { fontSize: 22, color: "#1D2B42", fontWeight: "700" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 26, fontWeight: "700", color: "#1A2940" },
  subTitle: { fontSize: 13, color: "#5D728F", marginTop: 2 },
  menuTrigger: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0A69F5",
    justifyContent: "center",
    alignItems: "center",
  },
  menuTriggerText: { color: "#fff", fontSize: 26, marginTop: -2 },
  menuCard: {
    position: "absolute",
    right: 16,
    top: 66,
    width: 180,
    zIndex: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3FA",
  },
  menuText: { color: "#21314A", fontSize: 14, fontWeight: "600" },
  menuDangerText: { color: "#BE3535", fontSize: 14, fontWeight: "700" },
  feed: { flex: 1, marginTop: 12 },
  feedContent: { gap: 10, paddingBottom: 12 },
  postCard: { borderRadius: 12, backgroundColor: "#fff", padding: 12 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  author: { color: "#1E2E45", fontSize: 15, fontWeight: "700" },
  meta: { color: "#667D9A", fontSize: 12, marginTop: 2 },
  postText: { marginTop: 8, color: "#1F2D44", fontSize: 14, lineHeight: 20 },
  postImage: {
    width: 220,
    height: 150,
    borderRadius: 10,
    marginTop: 8,
    marginRight: 8,
    backgroundColor: "#E8EEF7",
  },
  commentList: { marginTop: 8, gap: 6 },
  commentItem: {
    borderRadius: 8,
    backgroundColor: "#F2F7FF",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  commentHint: { marginTop: 8, color: "#7489A3", fontSize: 12 },
  commentAuthor: { color: "#2A4F95", fontWeight: "700", fontSize: 12 },
  commentText: { marginTop: 2, color: "#25334B", fontSize: 12 },
  commentRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D2DDEB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F8FBFF",
    minHeight: 40,
    maxHeight: 90,
  },
  commentBtn: {
    borderRadius: 10,
    backgroundColor: "#1F75FF",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  commentBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  composer: { borderRadius: 12, backgroundColor: "#fff", padding: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#D2DDEB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: "#F8FBFF",
    minHeight: 60,
    maxHeight: 120,
  },
  pickImageBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#89A9DD",
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 8,
  },
  pickImageBtnText: { color: "#274F9A", fontWeight: "600", fontSize: 14 },
  selectedImageRow: { marginBottom: 8 },
  selectedImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#E8EEF7",
  },
  mainBtn: {
    borderRadius: 10,
    backgroundColor: "#0A69F5",
    alignItems: "center",
    paddingVertical: 11,
  },
  mainBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D9E5F4",
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4F7EDB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { color: "#fff", fontWeight: "700" },
});
