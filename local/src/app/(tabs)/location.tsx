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
import MapView, { Marker, UrlTile, type Region } from "react-native-maps";
import {
  getCurrentUser,
  getSpaceByCode,
  simulateOtherMembersLocation,
  type SpaceData,
} from "./mockApp";

type LocationItem = SpaceData["locations"][number];

function buildMapRegion(center: LocationItem): Region {
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
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

  const region = useMemo(
    () => (centerMember ? buildMapRegion(centerMember) : null),
    [centerMember],
  );

  const tileUrl = useMemo(() => {
    if (!baiduAk) {
      return "";
    }
    return `https://api.map.baidu.com/customimage/tile?x={x}&y={y}&z={z}&scale=2&ak=${baiduAk}&customid=normal`;
  }, [baiduAk]);

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
          <Text style={styles.title}>团队地图</Text>
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
            <Text style={styles.noticeTitle}>提示</Text>
            <Text style={styles.noticeText}>
              未配置百度 AK，将使用默认地图底图。可在 .env 设置
              EXPO_PUBLIC_BAIDU_MAP_AK。
            </Text>
          </View>
        ) : null}

        <View style={styles.mapCard}>
          {region ? (
            <MapView style={styles.map} initialRegion={region} region={region}>
              {tileUrl ? <UrlTile urlTemplate={tileUrl} zIndex={-1} /> : null}
              {space.locations.map((member) => (
                <Marker
                  key={member.id}
                  coordinate={{
                    latitude: member.latitude,
                    longitude: member.longitude,
                  }}
                  title={member.username}
                  description={member.user_id === me.id ? "我" : "队友"}
                  pinColor={member.user_id === me.id ? "#0A69F5" : "#F5760A"}
                />
              ))}
            </MapView>
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackText}>暂无可显示的位置数据</Text>
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
    height: 280,
    borderRadius: 10,
  },
  mapFallback: {
    height: 280,
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
