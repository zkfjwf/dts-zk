import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import {
  getCurrentUser,
  getSpaceByCode,
  simulateOtherMembersLocation,
  type SpaceData,
} from "./mockApp";

type MapPoint = {
  id: string;
  userId: string;
  username: string;
  latitude: number;
  longitude: number;
  battery: number;
  isCurrentUser: boolean;
};

type MapEvent =
  | { type: "ready" }
  | { type: "warning"; message?: string }
  | { type: "error"; message?: string }
  | { type: "timeout"; message?: string };

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getBaiduAk() {
  return process.env.EXPO_PUBLIC_BAIDU_MAP_AK?.trim() ?? "";
}

function getBaiduMapPageOrigin() {
  return normalizeOrigin(
    process.env.EXPO_PUBLIC_BAIDU_MAP_WEB_ORIGIN ??
      process.env.EXPO_PUBLIC_API_URL ??
      "",
  );
}

function buildHostedMapUrl(origin: string, ak: string, points: MapPoint[]) {
  if (!origin || !ak || points.length === 0) {
    return "";
  }

  return `${origin}/baidu/live-map?ak=${encodeURIComponent(
    ak,
  )}&points=${encodeURIComponent(JSON.stringify(points))}`;
}

function buildMapKey(space: SpaceData | null) {
  if (!space) {
    return "none";
  }

  return `${space.id}:${space.locations
    .map(
      (item) =>
        `${item.id}:${item.latitude.toFixed(6)}:${item.longitude.toFixed(6)}:${item.battery}`,
    )
    .join("|")}`;
}

function isMainMapDocument(url: string) {
  return /\/baidu\/live-map(?:\?|$)/.test(url);
}

export default function LocationPage() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const spaceCode = typeof code === "string" ? code : "";
  const currentUser = getCurrentUser();
  const baiduAk = getBaiduAk();
  const baiduMapPageOrigin = getBaiduMapPageOrigin();

  const [space, setSpace] = useState<SpaceData | null>(() =>
    spaceCode ? getSpaceByCode(spaceCode) : null,
  );
  const [mapStatus, setMapStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [mapErrorText, setMapErrorText] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!spaceCode) {
        setSpace(null);
        return;
      }

      setSpace(getSpaceByCode(spaceCode));
    }, [spaceCode]),
  );

  const mapPoints = useMemo<MapPoint[]>(() => {
    if (!space) {
      return [];
    }

    return space.locations.map((item) => ({
      id: item.id,
      userId: item.user_id,
      username: item.username,
      latitude: item.latitude,
      longitude: item.longitude,
      battery: item.battery,
      isCurrentUser: item.user_id === currentUser.id,
    }));
  }, [currentUser.id, space]);

  const mapKey = useMemo(() => buildMapKey(space), [space]);

  const hostedMapUrl = useMemo(
    () => buildHostedMapUrl(baiduMapPageOrigin, baiduAk, mapPoints),
    [baiduAk, baiduMapPageOrigin, mapPoints],
  );

  useEffect(() => {
    if (!hostedMapUrl) {
      setMapStatus("idle");
      setMapErrorText("");
      return;
    }

    setMapStatus("loading");
    setMapErrorText("");
  }, [hostedMapUrl, mapKey]);

  const onRefresh = useCallback(() => {
    if (!spaceCode) {
      return;
    }

    const result = simulateOtherMembersLocation(spaceCode);
    if (!result.ok) {
      return;
    }

    setSpace(result.space);
    setMapStatus("loading");
    setMapErrorText("");
  }, [spaceCode]);

  const onMapMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as MapEvent;

      if (payload.type === "ready") {
        setMapStatus("ready");
        setMapErrorText("");
        return;
      }

      if (payload.type === "error" || payload.type === "timeout") {
        setMapStatus("error");
        setMapErrorText(payload.message ?? "实时地图加载失败，请稍后重试。");
      }
    } catch {
      setMapStatus("error");
      setMapErrorText("实时地图返回了无法识别的数据。");
    }
  }, []);

  if (!space) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>位置共享暂不可用</Text>
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.backButtonText}>返回首页</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>行程位置共享</Text>
          <Pressable
            style={styles.backButton}
            onPress={() =>
              router.replace({ pathname: "/team", params: { code: spaceCode } })
            }
          >
            <Text style={styles.backButtonText}>返回</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!baiduAk ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>缺少百度地图密钥</Text>
              <Text style={styles.noticeText}>
                请先在 `.env` 中配置 `EXPO_PUBLIC_BAIDU_MAP_AK`。
              </Text>
            </View>
          ) : null}

          {baiduAk && !baiduMapPageOrigin ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>缺少地图页面地址</Text>
              <Text style={styles.noticeText}>
                请在 `.env` 中配置 `EXPO_PUBLIC_BAIDU_MAP_WEB_ORIGIN` 或
                `EXPO_PUBLIC_API_URL`。
              </Text>
            </View>
          ) : null}

          <View style={styles.mapCard}>
            <View style={styles.mapCardHeader}>
              <Text style={styles.mapTitle}>实时地图</Text>
              <Text style={styles.mapHint}>可拖动、缩放查看成员位置</Text>
            </View>

            <View style={styles.mapViewport}>
              {hostedMapUrl ? (
                <WebView
                  key={mapKey}
                  source={{ uri: hostedMapUrl }}
                  style={styles.map}
                  originWhitelist={["*"]}
                  javaScriptEnabled
                  domStorageEnabled
                  mixedContentMode="always"
                  setSupportMultipleWindows={false}
                  scrollEnabled={false}
                  onLoadStart={() => {
                    setMapStatus("loading");
                    setMapErrorText("");
                  }}
                  onMessage={onMapMessage}
                  onHttpError={(event) => {
                    const failedUrl = event.nativeEvent.url ?? "";
                    if (!isMainMapDocument(failedUrl)) {
                      return;
                    }
                    setMapStatus("error");
                    setMapErrorText(
                      `地图页面返回了 HTTP ${event.nativeEvent.statusCode}，请确认当前服务地址可从手机访问。`,
                    );
                  }}
                  onError={(event) => {
                    const failedUrl = event.nativeEvent.url ?? "";
                    if (failedUrl && !isMainMapDocument(failedUrl)) {
                      return;
                    }
                    setMapStatus("error");
                    setMapErrorText(
                      event.nativeEvent.description ||
                        "实时地图页面在 WebView 中加载失败。",
                    );
                  }}
                />
              ) : (
                <View style={styles.mapFallback}>
                  <Text style={styles.mapFallbackTitle}>实时地图暂不可用</Text>
                  <Text style={styles.mapFallbackText}>
                    请检查百度地图密钥和当前服务地址配置。
                  </Text>
                </View>
              )}

              {hostedMapUrl && mapStatus === "loading" ? (
                <View style={styles.loadingMask}>
                  <ActivityIndicator size="small" color="#0A69F5" />
                  <Text style={styles.loadingText}>正在加载实时地图...</Text>
                </View>
              ) : null}
            </View>

            {mapStatus === "error" && mapErrorText ? (
              <Text style={styles.errorText}>{mapErrorText}</Text>
            ) : null}
          </View>

          <View style={styles.memberHeader}>
            <Text style={styles.memberTitle}>同行成员</Text>
            <Text style={styles.memberCount}>
              共 {space.locations.length} 人
            </Text>
          </View>

          {space.locations.map((member) => {
            const isCurrentUser = member.user_id === currentUser.id;

            return (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberCardHeader}>
                  <Text style={styles.memberName}>
                    {member.username}
                    {isCurrentUser ? "（我）" : ""}
                  </Text>
                  <View
                    style={isCurrentUser ? styles.selfTag : styles.memberTag}
                  >
                    <Text
                      style={
                        isCurrentUser
                          ? styles.selfTagText
                          : styles.memberTagText
                      }
                    >
                      {isCurrentUser ? "当前设备" : "同行成员"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.memberInfo}>
                  电量 {member.battery}% | 纬度 {member.latitude.toFixed(6)} |
                  经度 {member.longitude.toFixed(6)}
                </Text>
              </View>
            );
          })}

          <Pressable style={styles.refreshButton} onPress={onRefresh}>
            <Text style={styles.refreshButtonText}>刷新位置</Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EAF1FA" },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#1A2940" },
  backButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#8EADE0",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  backButtonText: { color: "#2A549D", fontWeight: "700", fontSize: 13 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 18 },
  noticeCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 12,
  },
  noticeTitle: { color: "#1F2D44", fontWeight: "700", fontSize: 14 },
  noticeText: { marginTop: 6, color: "#5A708D", fontSize: 13, lineHeight: 18 },
  mapCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  mapCardHeader: { marginBottom: 12 },
  mapTitle: { color: "#1A2940", fontSize: 18, fontWeight: "800" },
  mapHint: { marginTop: 6, color: "#6B7E96", fontSize: 13 },
  mapViewport: {
    height: 430,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#EDF3FB",
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EDF3FB",
  },
  mapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  mapFallbackTitle: {
    color: "#1F2D44",
    fontSize: 16,
    fontWeight: "700",
  },
  mapFallbackText: {
    marginTop: 8,
    color: "#60738C",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  loadingMask: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.66)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    color: "#2A4F95",
    fontSize: 13,
    fontWeight: "600",
  },
  errorText: {
    marginTop: 10,
    color: "#6B7E96",
    fontSize: 12,
    lineHeight: 18,
  },
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  memberTitle: { color: "#1A2940", fontSize: 16, fontWeight: "800" },
  memberCount: { color: "#6B7E96", fontSize: 12, fontWeight: "600" },
  memberCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  memberCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  memberName: { color: "#1F2D44", fontSize: 15, fontWeight: "700" },
  memberInfo: {
    marginTop: 8,
    color: "#5A708D",
    fontSize: 13,
    lineHeight: 19,
  },
  memberTag: {
    borderRadius: 999,
    backgroundColor: "#F1F6FC",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  memberTagText: { color: "#60738C", fontSize: 12, fontWeight: "700" },
  selfTag: {
    borderRadius: 999,
    backgroundColor: "#E7F3FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selfTagText: { color: "#0A69F5", fontSize: 12, fontWeight: "700" },
  refreshButton: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: "#0A69F5",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    shadowColor: "#0A69F5",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: "#1D2B42",
    fontWeight: "700",
    fontSize: 22,
    marginBottom: 14,
  },
});
