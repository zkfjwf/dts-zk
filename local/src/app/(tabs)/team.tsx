import { Q } from "@nozbe/watermelondb";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
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
import { SoftIconBadge } from "@/components/SoftIconBadge";
import { database } from "@/model";
import Comment from "@/model/Comment";
import Photo from "@/model/Photo";
import Post from "@/model/Post";
import { createUlid, nowTimestamp } from "@/lib/ids";
import {
  isRemoteImageUri,
  saveImageToAlbum,
  saveImageToLocalDir,
} from "@/lib/imageStorage";
import {
  assignModelId,
  assignTimestamps,
  dateToTimestamp,
} from "@/lib/watermelon";
import { syncMockSpaceToDatabase } from "./dbSync";
import {
  disbandSpaceByCode,
  getCurrentUser,
  getSpaceByCode,
  leaveSpaceByCode,
  type SpaceData,
} from "./mockApp";
import {
  ensureCurrentUserProfileInDb,
  getCurrentUserProfileFromDb,
  type UserProfileData,
} from "./userDb";

type ImagePickerModule = {
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
    canceled: boolean;
    assets: { uri: string }[];
  }>;
};

type FeedComment = {
  id: string;
  commenterId: string;
  text: string;
  createdAt: number;
};

type FeedPost = {
  id: string;
  posterId: string;
  caption: string;
  imageUris: string[];
  createdAt: number;
  comments: FeedComment[];
};

let imagePickerModuleCache: ImagePickerModule | null | undefined;

// 懒加载图片选择模块，避免测试环境缺少原生模块时报错。
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

// 把时间戳格式化成动态列表里更紧凑的展示文案。
function formatTime(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 头像组件优先显示图片，失败时退回到昵称末位字。
function Avatar({ uri, name }: { uri?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const text = name.trim().slice(-1) || "旅";

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

// 动态配图会根据原图宽高比自适应展示尺寸。
function FeedImage({ uri }: { uri: string }) {
  const [aspectRatio, setAspectRatio] = useState(1);

  return (
    <Image
      source={{ uri }}
      style={[
        styles.postImage,
        aspectRatio >= 1 ? styles.postImageLandscape : styles.postImagePortrait,
        { aspectRatio },
      ]}
      resizeMode="contain"
      onLoad={({ nativeEvent }) => {
        const width = nativeEvent.source?.width ?? 0;
        const height = nativeEvent.source?.height ?? 0;
        if (width > 0 && height > 0) {
          setAspectRatio(width / height);
        }
      }}
    />
  );
}

export default function TeamPage() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const spaceCode = typeof code === "string" ? code : "";
  const currentUser = getCurrentUser();

  // space 保存当前行程空间在前端 mock 层里的完整快照。
  const [space, setSpace] = useState<SpaceData | null>(() =>
    spaceCode ? getSpaceByCode(spaceCode) : null,
  );
  // dbPosts 是由 posts、photos、comments 三张表拼出来的动态视图模型。
  const [dbPosts, setDbPosts] = useState<FeedPost[]>([]);
  // postText 存储待发布动态的文字内容，落库时会写成首条评论。
  const [postText, setPostText] = useState("");
  // selectedImageUris 维护当前动态草稿里已选择的全部图片。
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);
  // commentInputs 以 postId 为键保存每条动态各自的评论草稿。
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {},
  );
  // commentingPostId 用来判断当前哪条动态正在输入评论。
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // previewImageUri 不为空时会打开全屏图片预览弹窗。
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [savingPreview, setSavingPreview] = useState(false);
  // currentProfile 叠加了本地数据库里的最新用户资料，用来覆盖 mock 当前用户信息。
  const [currentProfile, setCurrentProfile] = useState<UserProfileData | null>(
    null,
  );

  // commentInputRefs 用来在评论提交后主动收起对应输入框。
  const commentInputRefs = useRef<Record<string, { blur?: () => void } | null>>(
    {},
  );

  // 从本地数据库读取动态、图片和评论，并拼装成页面需要的结构。
  const loadDbPosts = useCallback(async (spaceId: string) => {
    const postCollection = database.collections.get<Post>("posts");
    const photoCollection = database.collections.get<Photo>("photos");
    const commentCollection = database.collections.get<Comment>("comments");

    const [posts, photos, comments] = await Promise.all([
      postCollection.query(Q.sortBy("created_at", Q.desc)).fetch(),
      photoCollection.query(Q.where("space_id", spaceId)).fetch(),
      commentCollection.query(Q.sortBy("commented_at", Q.asc)).fetch(),
    ]);

    const activePostIds = new Set<string>();
    const photoMap = new Map<string, string[]>();
    photos.forEach((item) => {
      if (item.deletedAt || !item.postId) {
        return;
      }

      activePostIds.add(item.postId);
      const list = photoMap.get(item.postId) ?? [];
      list.push(item.remoteUrl || item.localUri);
      photoMap.set(item.postId, Array.from(new Set(list)));
    });

    const commentMap = new Map<string, FeedComment[]>();
    comments.forEach((item) => {
      if (item.deletedAt || !item.postId || !activePostIds.has(item.postId)) {
        return;
      }

      const list = commentMap.get(item.postId) ?? [];
      list.push({
        id: item.id,
        commenterId: item.commenterId || "",
        text: item.content || "",
        createdAt: dateToTimestamp(item.commentedAt),
      });
      commentMap.set(item.postId, list);
    });

    setDbPosts(
      posts
        .filter((item) => !item.deletedAt && activePostIds.has(item.id))
        .map((item) => {
          const postCreatedAt = dateToTimestamp(item.createdAt);
          const rawComments = [...(commentMap.get(item.id) ?? [])].sort(
            (left, right) => left.createdAt - right.createdAt,
          );
          const captionIndex = rawComments.findIndex(
            (comment) =>
              comment.commenterId === item.posterId &&
              // 文案会作为发帖人紧邻创建时间的第一条评论落库。
              Math.abs(comment.createdAt - postCreatedAt) <= 1_000,
          );

          return {
            id: item.id,
            posterId: item.posterId,
            caption: captionIndex >= 0 ? rawComments[captionIndex].text : "",
            imageUris: photoMap.get(item.id) ?? [],
            createdAt: postCreatedAt,
            comments: rawComments.filter((_, index) => index !== captionIndex),
          };
        }),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!spaceCode) {
        setSpace(null);
        setDbPosts([]);
        setCurrentProfile(null);
        return;
      }

      const nextSpace = getSpaceByCode(spaceCode);
      setSpace(nextSpace);
      if (!nextSpace) {
        setDbPosts([]);
        setCurrentProfile(null);
        return;
      }

      void (async () => {
        await ensureCurrentUserProfileInDb();
        const profile = await getCurrentUserProfileFromDb();
        setCurrentProfile(profile);
        await syncMockSpaceToDatabase(nextSpace);
        await loadDbPosts(nextSpace.id);
      })();
    }, [loadDbPosts, spaceCode]),
  );

  const users = useMemo(() => {
    const map = new Map<string, { nickname: string; avatarUrl: string }>();
    for (const user of space?.users ?? []) {
      if (user.deleted_at) {
        continue;
      }

      map.set(user.id, {
        nickname: user.nickname,
        avatarUrl: user.avatar_local_uri || user.avatar_remote_url || "",
      });
    }

    map.set(currentUser.id, {
      nickname: currentProfile?.nickname || currentUser.username,
      avatarUrl:
        currentProfile?.avatarLocalUri ||
        currentProfile?.avatarRemoteUrl ||
        currentUser.avatarUrl ||
        "",
    });

    return map;
  }, [
    currentProfile,
    currentUser.avatarUrl,
    currentUser.id,
    currentUser.username,
    space,
  ]);

  // 打开系统相册并把新选中的图片合并到当前草稿里。
  const pickImagesFromAlbum = async () => {
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
        allowsMultipleSelection: true,
        quality: 1,
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
      Alert.alert("相册异常", String(error));
    }
  };

  // 从当前草稿中移除一张已选图片。
  const removeSelectedImage = (uri: string) => {
    setSelectedImageUris((prev) => prev.filter((item) => item !== uri));
  };

  // 发布动态时会先写 post，再写图片，最后把文案写成首条评论。
  const onPublishPost = async () => {
    if (!space) {
      return;
    }

    const cleanText = postText.trim();
    const mergedInputUris = Array.from(new Set(selectedImageUris));

    if (mergedInputUris.length === 0) {
      Alert.alert(
        "发布失败",
        "根据当前数据结构，动态至少需要一张图片来归属到旅行空间。",
      );
      return;
    }

    const createdAt = nowTimestamp();
    const postId = createUlid();
    const preparedImages = await Promise.all(
      mergedInputUris.map(async (uri, index) => {
        const localPath = await saveImageToLocalDir(uri, "travel-post-images");
        return {
          id: createUlid(),
          localUri: localPath,
          remoteUrl: isRemoteImageUri(uri) ? uri : "",
          shotedAt: createdAt + index,
        };
      }),
    );

    await database.write(async () => {
      const postCollection = database.collections.get<Post>("posts");
      const photoCollection = database.collections.get<Photo>("photos");
      const commentCollection = database.collections.get<Comment>("comments");

      await postCollection.create((post) => {
        assignModelId(post, postId);
        post.posterId = currentUser.id;
        post.deletedAt = null;
        assignTimestamps(post, createdAt, createdAt);
      });

      for (const image of preparedImages) {
        await photoCollection.create((photo) => {
          assignModelId(photo, image.id);
          photo.spaceId = space.id;
          photo.postId = postId;
          photo.uploaderId = currentUser.id;
          photo.localUri = image.localUri;
          photo.remoteUrl = image.remoteUrl;
          photo.shotedAt = new Date(image.shotedAt);
          photo.deletedAt = null;
          assignTimestamps(photo, image.shotedAt, image.shotedAt);
        });
      }

      if (cleanText) {
        await commentCollection.create((item) => {
          assignModelId(item, createUlid());
          item.content = cleanText;
          item.commenterId = currentUser.id;
          item.postId = postId;
          item.commentedAt = new Date(createdAt);
          item.deletedAt = null;
          assignTimestamps(item, createdAt, createdAt);
        });
      }
    });

    await loadDbPosts(space.id);
    setPostText("");
    setSelectedImageUris([]);
  };

  // 发表评论后刷新当前动态列表。
  const onComment = async (postId: string) => {
    if (!space) {
      return;
    }

    const content = (commentInputs[postId] ?? "").trim();
    if (!content) {
      Alert.alert("评论失败", "请输入评论内容。");
      return;
    }

    commentInputRefs.current[postId]?.blur?.();
    Keyboard.dismiss();
    setCommentingPostId(null);

    const commentedAt = nowTimestamp();
    await database.write(async () => {
      const collection = database.collections.get<Comment>("comments");
      await collection.create((item) => {
        assignModelId(item, createUlid());
        item.content = content;
        item.commenterId = currentUser.id;
        item.postId = postId;
        item.commentedAt = new Date(commentedAt);
        item.deletedAt = null;
        assignTimestamps(item, commentedAt, commentedAt);
      });
    });

    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    await loadDbPosts(space.id);
  };

  // 把当前预览中的图片保存到系统相册。
  const onSavePreviewImage = async () => {
    if (!previewImageUri) {
      return;
    }

    setSavingPreview(true);
    try {
      await saveImageToAlbum(previewImageUri, "travel-saved-images");
      Alert.alert("保存成功", "图片已经保存到系统相册。");
    } catch (error) {
      Alert.alert("保存失败", String(error));
    } finally {
      setSavingPreview(false);
    }
  };

  // 退出当前行程空间。
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

  // 解散当前行程空间。
  const onDisband = () => {
    setMenuOpen(false);
    if (!spaceCode) {
      return;
    }

    const ok = disbandSpaceByCode(spaceCode);
    if (!ok) {
      Alert.alert("解散失败", "没有找到当前空间。");
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
            <Text style={styles.mainBtnText}>返回首页</Text>
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
              <SoftIconBadge
                name={menuOpen ? "close-outline" : "apps-outline"}
                tone={menuOpen ? "peach" : "sky"}
                size={48}
                iconSize={22}
              />
            </Pressable>
          </View>

          {menuOpen ? (
            <View style={styles.menuCard}>
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push({
                    pathname: "/bookkeeping",
                    params: { code: spaceCode },
                  });
                }}
              >
                <View style={styles.menuItemIconRow}>
                  <SoftIconBadge
                    name="wallet-outline"
                    tone="peach"
                    size={44}
                    iconSize={19}
                  />
                  <View style={styles.menuItemTextWrap}>
                    <Text style={styles.menuText}>旅行记账</Text>
                    <Text style={styles.menuItemSubText}>记录消费与结算</Text>
                  </View>
                </View>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push({
                    pathname: "/location",
                    params: { code: spaceCode },
                  });
                }}
              >
                <View style={styles.menuItemIconRow}>
                  <SoftIconBadge
                    name="navigate-outline"
                    tone="mint"
                    size={44}
                    iconSize={19}
                  />
                  <View style={styles.menuItemTextWrap}>
                    <Text style={styles.menuText}>位置共享</Text>
                    <Text style={styles.menuItemSubText}>查看旅伴实时位置</Text>
                  </View>
                </View>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={onLeave}>
                <View style={styles.menuItemIconRow}>
                  <SoftIconBadge
                    name="log-out-outline"
                    tone="aqua"
                    size={44}
                    iconSize={19}
                  />
                  <View style={styles.menuItemTextWrap}>
                    <Text style={styles.menuText}>退出空间</Text>
                    <Text style={styles.menuItemSubText}>离开当前同行空间</Text>
                  </View>
                </View>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={onDisband}>
                <View style={styles.menuItemIconRow}>
                  <SoftIconBadge
                    name="trash-outline"
                    tone="violet"
                    size={44}
                    iconSize={19}
                  />
                  <View style={styles.menuItemTextWrap}>
                    <Text style={styles.menuDangerText}>解散空间</Text>
                    <Text style={styles.menuItemSubText}>
                      谨慎操作，不可恢复
                    </Text>
                  </View>
                </View>
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
                <Text style={styles.commentHint}>还没有动态，先发第一条吧</Text>
              </View>
            ) : null}

            {dbPosts.map((post) => {
              const author = users.get(post.posterId);
              const authorName = author?.nickname || "成员";
              const authorAvatar = author?.avatarUrl;

              return (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <Avatar uri={authorAvatar} name={authorName} />
                    <View>
                      <Text style={styles.author}>{authorName}</Text>
                      <Text style={styles.meta}>
                        {formatTime(post.createdAt)}
                      </Text>
                    </View>
                  </View>

                  {post.caption ? (
                    <Text style={styles.postText}>{post.caption}</Text>
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
                          <FeedImage uri={uri} />
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
                            {users.get(comment.commenterId)?.nickname || "成员"}
                          </Text>
                          <Text style={styles.commentText}>{comment.text}</Text>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.commentRow}>
                    <TextInput
                      ref={(input) => {
                        commentInputRefs.current[post.id] = input;
                      }}
                      style={styles.commentInput}
                      placeholder="写下评论"
                      value={commentInputs[post.id] ?? ""}
                      onFocus={() => setCommentingPostId(post.id)}
                      onBlur={() =>
                        setCommentingPostId((current) =>
                          current === post.id ? null : current,
                        )
                      }
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

          {commentingPostId ? null : (
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                placeholder="分享这段旅程中的见闻..."
                value={postText}
                onChangeText={setPostText}
                multiline
                textAlignVertical="top"
              />

              <Pressable
                style={styles.pickImageBtn}
                onPress={() => void pickImagesFromAlbum()}
              >
                <Text style={styles.pickImageBtnText}>选择图片</Text>
              </Pressable>

              <Text style={styles.selectedHint}>
                当前数据库设计会把文字作为动态说明评论保存，发布时至少需要一张图片。
              </Text>

              {selectedImageUris.length > 0 ? (
                <>
                  <Text style={styles.selectedHint}>点击预览，长按可删除</Text>
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
                        <Image
                          source={{ uri }}
                          style={styles.selectedImage}
                          resizeMode="contain"
                        />
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
          )}
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
              resizeMode="contain"
            />
          ) : null}
          <Pressable
            style={styles.previewSaveBtn}
            disabled={savingPreview}
            onPress={() => void onSavePreviewImage()}
          >
            <Text style={styles.previewSaveBtnText}>
              {savingPreview ? "保存中..." : "保存到系统相册"}
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
    borderRadius: 24,
  },
  menuTriggerText: { color: "#fff", fontSize: 26, marginTop: -2 },
  menuCard: {
    marginTop: 12,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 10,
    shadowColor: "#C5D3E2",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    gap: 8,
  },
  menuItem: {
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  menuItemIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemTextWrap: {
    flex: 1,
  },
  menuText: { color: "#21314A", fontSize: 15, fontWeight: "700" },
  menuItemSubText: { color: "#7488A0", fontSize: 12, marginTop: 4 },
  menuDangerText: { color: "#BE3535", fontSize: 15, fontWeight: "800" },
  feed: { flex: 1, marginTop: 12 },
  feedContent: { gap: 10, paddingBottom: 12 },
  postCard: { borderRadius: 12, backgroundColor: "#fff", padding: 12 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  author: { color: "#1E2E45", fontSize: 15, fontWeight: "700" },
  meta: { color: "#667D9A", fontSize: 12, marginTop: 2 },
  postText: { marginTop: 8, color: "#1F2D44", fontSize: 14, lineHeight: 20 },
  postImage: {
    borderRadius: 10,
    marginTop: 8,
    marginRight: 8,
    backgroundColor: "#E8EEF7",
  },
  postImageLandscape: { width: 240 },
  postImagePortrait: { height: 260 },
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
