import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  getCurrentUser,
  getSpaceByCode,
  simulateOtherMembersLocation,
  type SpaceData,
} from "./mockApp";

type LocationItem = SpaceData["locations"][number];

function buildMapHtml(
  ak: string,
  center: LocationItem,
  locations: LocationItem[],
  currentUserId: string,
) {
  const payload = JSON.stringify(
    locations.map((item) => ({
      id: item.id,
      userId: item.user_id,
      name: item.username,
      lat: item.latitude,
      lng: item.longitude,
    })),
  );

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body, #map { margin:0; width:100%; height:100%; background:#f2f6fc; }
      .tag { position:absolute; left:10px; top:10px; z-index:2; background:rgba(255,255,255,.92); border-radius:8px; padding:6px 8px; font-size:12px; color:#20324d; }
    </style>
    <script src="https://api.map.baidu.com/api?v=3.0&ak=${ak}"></script>
  </head>
  <body>
    <div id="map"></div>
    <div class="tag">团队实时位置</div>
    <script>
      (function () {
        var pointsData = ${payload};
        var map = new BMap.Map("map");
        var centerPoint = new BMap.Point(${center.longitude}, ${center.latitude});
        map.centerAndZoom(centerPoint, 13);
        map.enableScrollWheelZoom(true);
        map.enablePinchToZoom();
        map.enableKeyboard();

        var points = [];
        for (var i = 0; i < pointsData.length; i++) {
          var p = pointsData[i];
          var point = new BMap.Point(p.lng, p.lat);
          points.push(point);

          var marker = new BMap.Marker(point);
          if (p.userId === "${currentUserId}") {
            marker.setAnimation(BMAP_ANIMATION_BOUNCE);
          }
          map.addOverlay(marker);

          var title = p.name + (p.userId === "${currentUserId}" ? "（我）" : "");
          var label = new BMap.Label(title, {
            position: point,
            offset: new BMap.Size(14, -20),
          });
          label.setStyle({
            border: "1px solid #8fb0e6",
            borderRadius: "8px",
            padding: "2px 6px",
            color: "#1f2d44",
            backgroundColor: "#ffffff",
            fontSize: "12px",
            lineHeight: "18px",
          });
          map.addOverlay(label);
        }

        if (points.length > 1) {
          map.setViewport(points, { margins: [40, 30, 40, 30] });
        }
      })();
    </script>
  </body>
</html>`;
}

export default function LocationPage() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const spaceCode = typeof code === "string" ? code : "";
  const me = getCurrentUser();
  const baiduAk = process.env.EXPO_PUBLIC_BAIDU_MAP_AK?.trim() ?? "";

  const [space, setSpace] = useState<SpaceData | null>(() =>
    spaceCode ? getSpaceByCode(spaceCode) : null,
  );

  useFocusEffect(
    useCallback(() => {
      if (!spaceCode) {
        setSpace(null);
        return;
      }
      setSpace(getSpaceByCode(spaceCode));
    }, [spaceCode]),
  );

  const onRefresh = () => {
    if (!spaceCode) {
      return;
    }
    const result = simulateOtherMembersLocation(spaceCode);
    if (result.ok) {
      setSpace(result.space);
    }
  };

  const centerMember = useMemo(() => {
    if (!space || space.locations.length === 0) {
      return null;
    }
    return (
      space.locations.find((item) => item.user_id === me.id) ??
      space.locations[0]
    );
  }, [space, me.id]);

  const html = useMemo(() => {
    if (!space || !centerMember || !baiduAk) {
      return "";
    }
    return buildMapHtml(baiduAk, centerMember, space.locations, me.id);
  }, [space, centerMember, baiduAk, me.id]);

  const webKey = useMemo(() => {
    if (!space) {
      return "none";
    }
    return `${space.id}:${space.locations
      .map(
        (item) =>
          `${item.id}-${item.latitude.toFixed(6)}-${item.longitude.toFixed(6)}`,
      )
      .join("|")}`;
  }, [space]);

  if (!space) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>位置页面不可用</Text>
          <Pressable
            style={styles.exitButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.exitButtonText}>退出</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>团队真实地图（百度）</Text>
          <Pressable
            style={styles.exitButton}
            onPress={() =>
              router.replace({ pathname: "/team", params: { code: spaceCode } })
            }
          >
            <Text style={styles.exitButtonText}>返回</Text>
          </Pressable>
        </View>

        {!baiduAk ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>缺少 AK</Text>
            <Text style={styles.noticeText}>
              请在 .env 中配置 EXPO_PUBLIC_BAIDU_MAP_AK 后重启应用。
            </Text>
          </View>
        ) : null}

        <View style={styles.mapCard}>
          {html ? (
            <WebView
              key={webKey}
              source={{ html }}
              style={styles.map}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              setBuiltInZoomControls={false}
            />
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackText}>地图暂不可用</Text>
            </View>
          )}
        </View>

        <ScrollView style={styles.listArea}>
          {space.locations.map((member) => (
            <View key={member.id} style={styles.memberCard}>
              <Text style={styles.memberName}>
                {member.username}
                {member.user_id === me.id ? "（我）" : ""}
              </Text>
              <Text style={styles.coordText}>
                纬度 {member.latitude.toFixed(6)}，经度{" "}
                {member.longitude.toFixed(6)}
              </Text>
            </View>
          ))}
        </ScrollView>

        <Pressable style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshBtnText}>刷新位置</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EAF1FA" },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#1A2940", flex: 1 },
  noticeCard: {
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 10,
  },
  noticeTitle: { color: "#1F2D44", fontWeight: "700", fontSize: 14 },
  noticeText: { marginTop: 6, color: "#5A708D", fontSize: 13, lineHeight: 18 },
  mapCard: {
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginBottom: 10,
    overflow: "hidden",
  },
  map: {
    width: "100%",
    height: 300,
    borderRadius: 10,
    backgroundColor: "#EDF3FB",
  },
  mapFallback: {
    height: 300,
    borderRadius: 10,
    backgroundColor: "#EDF3FB",
    alignItems: "center",
    justifyContent: "center",
  },
  mapFallbackText: { color: "#5A708D", fontSize: 14, fontWeight: "600" },
  listArea: { flex: 1 },
  memberCard: {
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 10,
  },
  memberName: { color: "#1F2D44", fontSize: 15, fontWeight: "700" },
  coordText: { marginTop: 6, color: "#5A708D", fontSize: 13 },
  refreshBtn: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: "#0A69F5",
    alignItems: "center",
    paddingVertical: 11,
  },
  refreshBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  exitButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#8EADE0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginLeft: 10,
  },
  exitButtonText: { color: "#2A549D", fontWeight: "700", fontSize: 13 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyTitle: {
    color: "#1D2B42",
    fontWeight: "700",
    fontSize: 22,
    marginBottom: 10,
  },
});
