import { Q } from "@nozbe/watermelondb";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { database } from "@/model";
import Expense from "@/model/Expense";
import { getCurrentUser, getSpaceByCode, type SpaceData } from "./mockApp";

type LedgerExpense = {
  id: string;
  amountYuan: number;
  description: string;
  payerName: string;
  createdAt: number;
};

export default function BookkeepingPage() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const spaceCode = typeof code === "string" ? code : "";

  const currentUser = getCurrentUser();
  const [space, setSpace] = useState<SpaceData | null>(() =>
    spaceCode ? getSpaceByCode(spaceCode) : null,
  );
  const [dbExpenses, setDbExpenses] = useState<LedgerExpense[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const loadDbExpenses = useCallback(async (spaceId: string) => {
    const collection = database.collections.get<Expense>("expenses");
    const records = await collection
      .query(Q.where("space_id", spaceId), Q.sortBy("created_at", Q.desc))
      .fetch();

    setDbExpenses(
      records.map((item) => ({
        id: item.id,
        amountYuan: item.amount / 100,
        description: item.description,
        payerName: item.payerName || item.payerId || "未知",
        createdAt:
          item.createdAt instanceof Date
            ? item.createdAt.getTime()
            : Date.now(),
      })),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!spaceCode) {
        setSpace(null);
        setDbExpenses([]);
        return;
      }

      const nextSpace = getSpaceByCode(spaceCode);
      setSpace(nextSpace);
      if (nextSpace) {
        void loadDbExpenses(nextSpace.id);
      } else {
        setDbExpenses([]);
      }
    }, [spaceCode, loadDbExpenses]),
  );

  const allExpenses = useMemo(() => {
    const mockExpenses: LedgerExpense[] = (space?.expenses ?? []).map(
      (item) => ({
        id: `mock-${item.id}`,
        amountYuan: item.amount,
        description: item.description,
        payerName: item.payer_name,
        createdAt: item.created_at,
      }),
    );

    return [...dbExpenses, ...mockExpenses].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }, [dbExpenses, space]);

  const summary = useMemo(() => {
    const total = allExpenses.reduce((acc, item) => acc + item.amountYuan, 0);
    const avg = space?.members.length ? total / space.members.length : 0;
    return { total, avg };
  }, [allExpenses, space]);

  const onAddBill = async () => {
    if (!space) {
      return;
    }

    const cleanTitle = title.trim();
    const parsed = Number(amount);
    if (!cleanTitle) {
      Alert.alert("添加失败", "请输入项目名称。");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert("添加失败", "金额必须大于 0。");
      return;
    }

    const amountInCent = Math.round(parsed * 100);
    await database.write(async () => {
      const collection = database.collections.get<Expense>("expenses");
      await collection.create((expense) => {
        expense.spaceId = space.id;
        expense.payerId = currentUser.id;
        expense.payerName = currentUser.username;
        expense.amount = amountInCent;
        expense.description = cleanTitle;
      });
    });

    await loadDbExpenses(space.id);
    setTitle("");
    setAmount("");
  };

  const onSettle = () => {
    if (!space) {
      return;
    }
    router.push({ pathname: "/settlement", params: { code: spaceCode } });
  };

  if (!space) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>记账页不可用</Text>
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
          <Text style={styles.title}>旅行空间记账</Text>
          <Pressable
            style={styles.exitButton}
            onPress={() =>
              router.replace({ pathname: "/team", params: { code: spaceCode } })
            }
          >
            <Text style={styles.exitButtonText}>返回</Text>
          </Pressable>
        </View>

        <Text style={styles.summary}>
          总金额：{summary.total.toFixed(2)} 元 · 平摊每人：
          {summary.avg.toFixed(2)} 元
        </Text>
        <Text style={styles.summary}>默认付款人：{currentUser.username}</Text>

        <View style={styles.addCard}>
          <Text style={styles.cardTitle}>添加账单</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="项目名称"
            placeholderTextColor="#8FA2B8"
            style={styles.input}
          />
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="金额"
            keyboardType="decimal-pad"
            placeholderTextColor="#8FA2B8"
            style={styles.input}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => void onAddBill()}
          >
            <Text style={styles.primaryButtonText}>添加账单</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onSettle}>
            <Text style={styles.secondaryButtonText}>平摊结算</Text>
          </Pressable>
        </View>

        <Text style={styles.cardTitle}>历史账单</Text>
        <ScrollView style={styles.listArea}>
          {allExpenses.map((item) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.listTitle}>{item.description}</Text>
              <Text style={styles.listMeta}>
                {item.amountYuan.toFixed(2)} 元 · 支付人：{item.payerName}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EAF1FA" },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#1A2940" },
  summary: { marginTop: 8, color: "#5A708D", fontSize: 13 },
  addCard: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  cardTitle: {
    color: "#21314A",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D2DDEB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#1F2B40",
    fontSize: 14,
    backgroundColor: "#F8FBFF",
    marginBottom: 8,
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: "#0A69F5",
    alignItems: "center",
    paddingVertical: 11,
    marginTop: 4,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  secondaryButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#88A9DE",
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryButtonText: { color: "#2A549D", fontWeight: "700", fontSize: 14 },
  listArea: { marginTop: 4, marginBottom: 8 },
  listItem: {
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginBottom: 8,
  },
  listTitle: { color: "#1F2D44", fontSize: 14, fontWeight: "600" },
  listMeta: { marginTop: 4, color: "#637A97", fontSize: 12 },
  exitButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#8EADE0",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  exitButtonText: { color: "#2A549D", fontWeight: "700", fontSize: 13 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    color: "#1D2B42",
    fontWeight: "700",
    fontSize: 22,
    marginBottom: 10,
  },
});
