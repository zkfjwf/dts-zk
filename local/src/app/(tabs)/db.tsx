import React, { useEffect, useState } from "react";
import { View, Text, Button, FlatList, StyleSheet } from "react-native";
import { database } from "@/model";
import Expense from "@/model/Expense";

export default function DatabaseTestScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    const expensesCollection = database.collections.get<Expense>("expenses");
    const subscription = expensesCollection
      .query()
      .observe()
      .subscribe((data) => {
        setExpenses(data);
      });
    return () => subscription.unsubscribe();
  }, []);

  const handleAddMockExpense = async () => {
    try {
      await database.write(async () => {
        const expensesCollection =
          database.collections.get<Expense>("expenses");
        await expensesCollection.create((expense) => {
          // @ts-ignore
          expense._raw.space_id = "test_space_999";
          expense.payerId = "user_teacher";
          expense.amount = Math.floor(Math.random() * 5000) + 1000;
          expense.description = "离线测试：AA制午餐";
        });
      });
    } catch (error) {
      console.error("写入失败:", error);
    }
  };

  const handleClearAll = async () => {
    try {
      await database.write(async () => {
        const expensesCollection =
          database.collections.get<Expense>("expenses");
        const allRecords = await expensesCollection.query().fetch();
        const deleteOperations = allRecords.map((record) =>
          record.prepareMarkAsDeleted(),
        );
        await database.batch(...deleteOperations);
      });
    } catch (error) {
      console.error("清空失败:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WatermelonDB 离线测试室</Text>
      <Text style={styles.subtitle}>当前记录数: {expenses.length}</Text>

      <View style={styles.btnGroup}>
        <Button title="记一笔账" onPress={handleAddMockExpense} />
        <Button title="清空全部" color="red" onPress={handleClearAll} />
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text>{item.description}</Text>
            <Text style={styles.amount}>
              ￥{(item.amount / 100).toFixed(2)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f9f9f9" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 10,
  },
  subtitle: { textAlign: "center", marginBottom: 20 },
  btnGroup: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  item: {
    padding: 15,
    backgroundColor: "white",
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  amount: { fontWeight: "bold", color: "#e74c3c" },
});
