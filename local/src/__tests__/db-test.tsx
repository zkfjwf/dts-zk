import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import DatabaseTestScreen from "@/app/(tabs)/db";
import { database } from "@/model";

jest.mock("@/model", () => {
  const mockSubscribe = jest.fn((callback) => {
    callback([
      {
        id: "1",
        description: "离线测试：AA制午餐",
        amount: 4500,
        payerId: "user_a",
        spaceId: "demo_space_001",
        prepareMarkAsDeleted: jest.fn(),
      },
    ]);
    return { unsubscribe: jest.fn() };
  });

  return {
    database: {
      collections: {
        get: jest.fn(() => ({
          query: jest.fn(() => ({
            observe: jest.fn(() => ({
              subscribe: mockSubscribe,
            })),
            fetch: jest.fn().mockResolvedValue([]),
          })),
          create: jest.fn(),
        })),
      },
      write: jest.fn(async (action) => {
        await action();
      }),
      batch: jest.fn(),
    },
  };
});

describe("DatabaseTestScreen", () => {
  it("renders db title and mock expense", () => {
    const { getByText } = render(<DatabaseTestScreen />);

    expect(getByText("WatermelonDB 离线测试")).toBeTruthy();
    expect(getByText("¥ 45.00")).toBeTruthy();
    expect(getByText("离线测试：AA制午餐")).toBeTruthy();
  });

  it("calls database.write when add button is pressed", async () => {
    const { getByText } = render(<DatabaseTestScreen />);
    fireEvent.press(getByText("记一笔账"));

    await waitFor(() => {
      expect(database.write).toHaveBeenCalled();
    });
  });

  it("calls database.batch when clear button is pressed", async () => {
    const { getByText } = render(<DatabaseTestScreen />);
    fireEvent.press(getByText("清空全部"));

    await waitFor(() => {
      expect(database.write).toHaveBeenCalled();
      expect(database.batch).toHaveBeenCalled();
    });
  });
});
