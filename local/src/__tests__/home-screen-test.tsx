import { render } from "@testing-library/react-native";

import HomeScreen from "@/app/(tabs)/index";

describe("<HomeScreen />", () => {
  test("renders lobby title", () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText("旅行空间大厅")).toBeTruthy();
  });
});
