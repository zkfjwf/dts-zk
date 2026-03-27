import { Q } from "@nozbe/watermelondb";
import * as FileSystem from "expo-file-system/legacy";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import PostComment from "@/model/PostComment";
import { syncMockSpaceToDatabase } from "./dbSync";
import {
  disbandSpaceByCode,
  getCurrentUser,
  getSpaceByCode,
  leaveSpaceByCode,
  type SpaceData,
} from "./mockApp";

type ImagePickerModule = {
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
    canceled: boolean;
    assets: { uri: string }[];
  }>;
};

type FeedPost = {
  id: string;
  uploaderId: string;
  uploaderName: string;
  text: string;
  imageUris: string[];
  createdAt: number;
  comments: { id: string; author: string; text: string; createdAt: number }[];
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

function isRemoteUri(uri: string) {
  return /^https?:\/\//i.test(uri);
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

async function saveImageToLocalDir(uri: string, folderName: string) {
  if (!FileSystem.documentDirectory) {
    return uri;
  }

  const baseDir = FileSystem.documentDirectory.endsWith("/")
    ? FileSystem.documentDirectory
    : `${FileSystem.documentDirectory}/`;
  const targetDir = `${baseDir}${folderName}`;
  const targetPath = `${targetDir}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}${getFileExt(uri)}`;

  try {
    await ensureDir(targetDir);
    if (isRemoteUri(uri) && FileSystem.downloadAsync) {
      const downloaded = await FileSystem.downloadAsync(uri, targetPath);
      return downloaded.uri || targetPath;
    }
    await FileSystem.copyAsync({ from: uri, to: targetPath });
    return targetPath;
  } catch {
    return uri;
  }
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
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {},
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [savingPreview, setSavingPreview] = useState(false);

  const loadDbPosts = useCallback(async (spaceId: string) => {
    const postCollection = database.collections.get<Post>("posts");
    const photoCollection = database.collections.get<Photo>("photos");
    const commentCollection =
      database.collections.get<PostComment>("post_comments");

    const [posts, photos, comments] = await Promise.all([
      postCollection
        .query(Q.where("space_id", spaceId), Q.sortBy("created_at", Q.desc))
        .fetch(),
      photoCollection.query(Q.where("space_id", spaceId)).fetch(),
      commentCollection
        .query(Q.where("space_id", spaceId), Q.sortBy("created_at", Q.asc))
        .fetch(),
    ]);

    const photoMap = new Map<string, string[]>();
    photos.forEach((item) => {
      if (!item.postId) {
        return;
      }
      const list = photoMap.get(item.postId) ?? [];
      list.push(item.remoteUrl || item.localPath);
      photoMap.set(item.postId, Array.from(new Set(list)));
    });

    const commentMap = new Map<
      string,
      { id: string; author: string; text: string; createdAt: number }[]
    >();
    comments.forEach((item) => {
      if (!item.postId) {
        return;
      }
      const list = commentMap.get(item.postId) ?? [];
      list.push({
        id: item.id,
        author: item.authorName || "成员",
        text: item.textContent || "",
        createdAt:
          item.createdAt instanceof Date
            ? item.createdAt.getTime()
            : Date.now(),
      });
      commentMap.set(item.postId, list);
    });

    setDbPosts(
      posts.map((item) => ({
        id: item.id,
        uploaderId: item.uploaderId,
        uploaderName: item.uploaderName || "成员",
        text: item.textContent || "",
        imageUris: photoMap.get(item.id) ?? [],
        createdAt:
          item.createdAt instanceof Date
            ? item.createdAt.getTime()
            : Date.now(),
        comments: commentMap.get(item.id) ?? [],
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
      if (!nextSpace) {
        setDbPosts([]);
        return;
      }

      void (async () => {
        await syncMockSpaceToDatabase(nextSpace);
        await loadDbPosts(nextSpace.id);
      })();
    }, [spaceCode, loadDbPosts]),
  );

  const users = useMemo(() => {
    const map = new Map<string, { nickname: string; avatarUrl: string }>();
    for (const user of space?.users ?? []) {
      map.set(user.id, user);
    }
    return map;
  }, [space]);

  const pickImagesFromAlbum = async () => {
    const imagePicker = getImagePickerModule();
    if (!imagePicker) {
      Alert.alert(
        "相册不可用",
        "当前安装包未包含 image-picker 原生模块，请重建开发包。",
      );
      return;
    }

    try {
      const permission =
        await imagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("权限不足", "请先授权访问相册。");
        return;
      }

      const result = await imagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 9,
      });

      if (result.canceled) {
        return;
      }

      const uris = result.assets
        .map((asset: { uri: string }) => asset.uri)
        .filter(Boolean);
      setSelectedImageUris((prev) => Array.from(new Set([...prev, ...uris])));
    } catch (error) {
      Alert.alert("相册异常", `打开失败：${String(error)}`);
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
    const mergedInputUris = Array.from(new Set(selectedImageUris));

    if (!cleanText && mergedInputUris.length === 0) {
      Alert.alert("发布失败", "请填写文字或至少上传一张图片。");
      return;
    }

    const preparedImages = await Promise.all(
      mergedInputUris.map(async (uri) => {
        const localPath = await saveImageToLocalDir(uri, "travel-post-images");
        return {
          localPath,
          remoteUrl: isRemoteUri(uri) ? uri : "",
        };
      }),
    );

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

      for (const image of preparedImages) {
        await photoCollection.create((photo) => {
          photo.spaceId = space.id;
          photo.postId = createdPostId;
          photo.uploaderId = currentUser.id;
          photo.localPath = image.localPath;
          photo.remoteUrl = image.remoteUrl;
        });
      }
    });

    await loadDbPosts(space.id);
    setPostText("");
    setSelectedImageUris([]);
  };

  const onComment = async (postId: string) => {
    if (!space) {
      return;
    }
    const content = (commentInputs[postId] ?? "").trim();
    if (!content) {
      Alert.alert("评论失败", "请输入评论内容。");
      return;
    }

    await database.write(async () => {
      const collection = database.collections.get<PostComment>("post_comments");
      await collection.create((item) => {
        item.spaceId = space.id;
        item.postId = postId;
        item.authorId = currentUser.id;
        item.authorName = currentUser.username;
        item.textContent = content;
      });
    });

    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    await loadDbPosts(space.id);
  };

  const onSavePreviewImage = async () => {
    if (!previewImageUri) {
      return;
    }
    setSavingPreview(true);
    const localPath = await saveImageToLocalDir(
      previewImageUri,
      "travel-saved-images",
    );
    setSavingPreview(false);
    Alert.alert("保存成功", `已保存到本地：${localPath}`);
  };

  const onLeave = () => {
    setMenuOpen(false);
    if (!spaceCode) {
      return;
    }

    const result = leaveSpaceByCode(spaceCode);
    if (!result.ok) {
      Alert.alert("退出失败", result.message);
      return;
    }
    router.replace("/");
  };

  const onDisband = () => {
    setMenuOpen(false);
    if (!spaceCode) {
      return;
    }
    const ok = disbandSpaceByCode(spaceCode);
    if (!ok) {
      Alert.alert("解散失败", "空间不存在。");
      return;
    }
    router.replace("/");
  };

  if (!space) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <Text style={styles.emptyTitle}>空间不存在</Text>
          <Pressable style={styles.mainBtn} onPress={() => router.replace("/")}>
            <Text style={styles.mainBtnText}>返回</Text>
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
              <Text style={styles.subTitle}>空间口令：{space.code}</Text>
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
                <Text style={styles.menuText}>记账</Text>
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
                <Text style={styles.menuText}>位置</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={onLeave}>
                <Text style={styles.menuText}>退出空间</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={onDisband}>
                <Text style={styles.menuDangerText}>解散空间</Text>
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            style={styles.feed}
            contentContainerStyle={styles.feedContent}
            keyboardShouldPersistTaps="handled"
          >
            {dbPosts.length === 0 ? (
              <View style={styles.postCard}>
                <Text style={styles.commentHint}>暂时还没有动态</Text>
              </View>
            ) : null}

            {dbPosts.map((post) => {
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
                        <Pressable
                          key={`${post.id}-${idx}-${uri}`}
                          onPress={() => setPreviewImageUri(uri)}
                        >
                          <Image source={{ uri }} style={styles.postImage} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}

                  <View style={styles.commentList}>
                    {post.comments.length === 0 ? (
                      <Text style={styles.commentHint}>暂无评论</Text>
                    ) : (
                      post.comments.map((comment) => (
                        <View key={comment.id} style={styles.commentItem}>
                          <Text style={styles.commentAuthor}>
                            {comment.author}
                          </Text>
                          <Text style={styles.commentText}>{comment.text}</Text>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.commentRow}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="写评论"
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
                      onPress={() => void onComment(post.id)}
                    >
                      <Text style={styles.commentBtnText}>发送</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="动态文字（可不填）"
              value={postText}
              onChangeText={setPostText}
              multiline
              textAlignVertical="top"
            />

            <Pressable
              style={styles.pickImageBtn}
              onPress={() => void pickImagesFromAlbum()}
            >
              <Text style={styles.pickImageBtnText}>从相册选择图片</Text>
            </Pressable>

            {selectedImageUris.length > 0 ? (
              <>
                <Text style={styles.selectedHint}>点击查看，长按删除</Text>
                <ScrollView
                  horizontal
                  style={styles.selectedImageRow}
                  showsHorizontalScrollIndicator={false}
                >
                  {selectedImageUris.map((uri, idx) => (
                    <Pressable
                      key={`${idx}-${uri}`}
                      onPress={() => setPreviewImageUri(uri)}
                      onLongPress={() => removeSelectedImage(uri)}
                    >
                      <Image source={{ uri }} style={styles.selectedImage} />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Pressable
              style={styles.mainBtn}
              onPress={() => void onPublishPost()}
            >
              <Text style={styles.mainBtnText}>发布动态</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={!!previewImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUri(null)}
      >
        <View style={styles.previewMask}>
          <Pressable
            style={styles.previewClose}
            onPress={() => setPreviewImageUri(null)}
          >
            <Text style={styles.previewCloseText}>关闭</Text>
          </Pressable>
          {previewImageUri ? (
            <Image
              source={{ uri: previewImageUri }}
              style={styles.previewImg}
            />
          ) : null}
          <Pressable
            style={styles.previewSaveBtn}
            disabled={savingPreview}
            onPress={() => void onSavePreviewImage()}
          >
            <Text style={styles.previewSaveBtnText}>
              {savingPreview ? "保存中..." : "保存到本地"}
            </Text>
          </Pressable>
        </View>
      </Modal>
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
  selectedHint: { color: "#5A708D", fontSize: 12, marginBottom: 6 },
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
  previewMask: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  previewImg: {
    width: "100%",
    height: "65%",
    borderRadius: 12,
    backgroundColor: "#222",
  },
  previewClose: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  previewCloseText: { color: "#fff", fontWeight: "700" },
  previewSaveBtn: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: "#0A69F5",
    alignItems: "center",
    paddingVertical: 11,
    width: "100%",
  },
  previewSaveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
