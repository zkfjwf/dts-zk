import { Q } from "@nozbe/watermelondb";
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
import { SoftIconBadge } from "@/components/SoftIconBadge";
import { database } from "@/model";
import Expense from "@/model/Expense";
import { syncMockSpaceToDatabase } from "./dbSync";
import { getSpaceByCode, type SpaceData } from "./mockApp";

type LedgerExpense = {
  amountYuan: number;
  payerName: string;
};

type Settlement = {
  from: string;
  to: string;
  amount: number;
};

function calcSettlements(
  members: string[],
  expenses: LedgerExpense[],
): Settlement[] {
  if (members.length === 0) {
    return [];
  }

  const paid: Record<string, number> = {};
  members.forEach((name) => {
    paid[name] = 0;
  });

  const total = expenses.reduce((acc, item) => acc + item.amountYuan, 0);
  expenses.forEach((expense) => {
    paid[expense.payerName] =
      (paid[expense.payerName] ?? 0) + expense.amountYuan;
  });

  const share = total / members.length;
  const creditors: { user: string; amount: number }[] = [];
  const debtors: { user: string; amount: number }[] = [];

  members.forEach((name) => {
    const net = Number(((paid[name] ?? 0) - share).toFixed(2));
    if (net > 0) {
      creditors.push({ user: name, amount: net });
    } else if (net < 0) {
      debtors.push({ user: name, amount: Math.abs(net) });
    }
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const result: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debt = debtors[i];
    const credit = creditors[j];
    const amount = Number(Math.min(debt.amount, credit.amount).toFixed(2));

    if (amount > 0) {
      result.push({ from: debt.user, to: credit.user, amount });
    }

    debt.amount = Number((debt.amount - amount).toFixed(2));
    credit.amount = Number((credit.amount - amount).toFixed(2));

    if (debt.amount <= 0.009) {
      i += 1;
    }
    if (credit.amount <= 0.009) {
      j += 1;
    }
  }

  return result;
}

export default function SettlementPage() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const spaceCode = typeof code === "string" ? code : "";

  const [space, setSpace] = useState<SpaceData | null>(() =>
    spaceCode ? getSpaceByCode(spaceCode) : null,
  );
  const [dbExpenses, setDbExpenses] = useState<LedgerExpense[]>([]);

  const loadDbExpenses = useCallback(async (spaceId: string) => {
    const collection = database.collections.get<Expense>("expenses");
    const records = await collection
      .query(Q.where("space_id", spaceId), Q.sortBy("created_at", Q.desc))
      .fetch();

    setDbExpenses(
      records.map((item) => ({
        amountYuan: item.amount / 100,
        payerName: item.payerName || item.payerId || "未知成员",
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
        void (async () => {
          await syncMockSpaceToDatabase(nextSpace);
          await loadDbExpenses(nextSpace.id);
        })();
      } else {
        setDbExpenses([]);
      }
    }, [spaceCode, loadDbExpenses]),
  );

  const settlements = useMemo(() => {
    if (!space) {
      return [];
    }

    return calcSettlements(space.members, dbExpenses);
  }, [space, dbExpenses]);

  const totalTransfer = useMemo(
    () => settlements.reduce((sum, item) => sum + item.amount, 0),
    [settlements],
  );

  const memberCount = space?.members.length ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>平摊结算</Text>
            <Text style={styles.subtitle}>
              用最少的转账次数完成这次旅程的费用结清。
            </Text>
          </View>
          <Pressable
            style={styles.backButton}
            onPress={() =>
              router.replace({
                pathname: "/bookkeeping",
                params: { code: spaceCode },
              })
            }
          >
            <Text style={styles.backButtonText}>返回记账</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <SoftIconBadge
              name="swap-horizontal-outline"
              tone="mint"
              size={54}
            />
            <View style={styles.summaryHeaderTextWrap}>
              <Text style={styles.summaryTitle}>结算概览</Text>
              <Text style={styles.summarySubtitle}>
                {space?.name || "旅行空间"} · {memberCount} 位成员
              </Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>需要转账</Text>
              <Text style={styles.summaryValue}>{settlements.length} 笔</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>待结金额</Text>
              <Text style={styles.summaryValue}>
                {totalTransfer.toFixed(2)} 元
              </Text>
            </View>
          </View>
        </View>

        {settlements.length === 0 ? (
          <View style={styles.emptyCard}>
            <SoftIconBadge
              name="checkmark-done-outline"
              tone="aqua"
              size={54}
            />
            <Text style={styles.emptyTitle}>当前无需转账</Text>
            <Text style={styles.emptyText}>
              账目已经平衡，大家可以轻松继续旅程。
            </Text>
          </View>
        ) : (
          settlements.map((item, idx) => (
            <View key={`${item.from}-${item.to}-${idx}`} style={styles.card}>
              <View style={styles.cardTop}>
                <SoftIconBadge
                  name="card-outline"
                  tone="peach"
                  size={48}
                  iconSize={20}
                />
                <View style={styles.cardTextWrap}>
                  <Text style={styles.mainText}>
                    {item.from} 需要支付给 {item.to}
                  </Text>
                  <Text style={styles.subText}>
                    建议当面确认或备注旅程结算。
                  </Text>
                </View>
              </View>
              <Text style={styles.amountText}>{item.amount.toFixed(2)} 元</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F7FB" },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
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
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5ECF6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#CDD8E7",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  backButtonText: {
    color: "#2E4463",
    fontSize: 14,
    fontWeight: "700",
  },
  summaryCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#C5D3E2",
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryHeaderTextWrap: { flex: 1 },
  summaryTitle: {
    color: "#203044",
    fontSize: 18,
    fontWeight: "800",
  },
  summarySubtitle: {
    marginTop: 4,
    color: "#7588A0",
    fontSize: 13,
  },
  summaryGrid: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#EEF2F8",
  },
  summaryLabel: {
    color: "#6C8098",
    fontSize: 13,
    fontWeight: "600",
  },
  summaryValue: {
    marginTop: 8,
    color: "#22364E",
    fontSize: 20,
    fontWeight: "800",
  },
  emptyCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingVertical: 30,
    alignItems: "center",
    shadowColor: "#C5D3E2",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  emptyTitle: {
    marginTop: 16,
    color: "#203146",
    fontSize: 22,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 8,
    color: "#7488A0",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  card: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#C5D3E2",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  cardTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  cardTextWrap: {
    flex: 1,
  },
  mainText: {
    color: "#22364E",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 24,
  },
  subText: {
    marginTop: 6,
    color: "#788AA0",
    fontSize: 13,
    lineHeight: 20,
  },
  amountText: {
    marginTop: 18,
    color: "#4D7CFE",
    fontSize: 24,
    fontWeight: "800",
  },
});
