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
import { database } from "@/model";
import Expense from "@/model/Expense";
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
        payerName: item.payerName || item.payerId || "未知",
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

  const settlements = useMemo(() => {
    if (!space) {
      return [];
    }

    const mockExpenses: LedgerExpense[] = (space.expenses ?? []).map(
      (item) => ({
        amountYuan: item.amount,
        payerName: item.payer_name,
      }),
    );

    return calcSettlements(space.members, [...dbExpenses, ...mockExpenses]);
  }, [space, dbExpenses]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>平摊结算结果</Text>
          <Pressable
            style={styles.backBtn}
            onPress={() =>
              router.replace({
                pathname: "/bookkeeping",
                params: { code: spaceCode },
              })
            }
          >
            <Text style={styles.backBtnText}>返回记账</Text>
          </Pressable>
        </View>

        <ScrollView>
          {settlements.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>当前无需转账，账目已平衡。</Text>
            </View>
          ) : (
            settlements.map((item, idx) => (
              <View key={`${item.from}-${item.to}-${idx}`} style={styles.card}>
                <Text style={styles.mainText}>
                  {item.from} 需要支付给 {item.to}
                </Text>
                <Text style={styles.amountText}>
                  {item.amount.toFixed(2)} 元
                </Text>
              </View>
            ))
          )}
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
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#1A2940" },
  backBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#8EADE0",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backBtnText: { color: "#2A549D", fontWeight: "700", fontSize: 13 },
  card: {
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 10,
  },
  mainText: { fontSize: 15, color: "#1F2D44", fontWeight: "600" },
  amountText: {
    marginTop: 6,
    color: "#0A69F5",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: { color: "#5A708D", fontSize: 14 },
});
