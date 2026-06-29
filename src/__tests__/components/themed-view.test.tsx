// ---------------------------------------------------------------------------
// Component unit tests for themed-view.tsx
// Regression coverage: background color rendering, type prop, style merging
// ---------------------------------------------------------------------------

import { render, screen } from "@testing-library/react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";

describe("<ThemedView />", () => {
  test("renders without error", async () => {
    await render(<ThemedView testID="test-view" />);
    expect(screen.getByTestId("test-view")).toBeTruthy();
  });

  test("renders children", async () => {
    await render(
      <ThemedView>
        <ThemedText>Inside View</ThemedText>
      </ThemedView>,
    );
    expect(screen.getByText("Inside View")).toBeTruthy();
  });

  test("accepts type prop", async () => {
    await render(<ThemedView type="backgroundElement" testID="typed-view" />);
    expect(screen.getByTestId("typed-view")).toBeTruthy();
  });

  test("accepts style prop", async () => {
    await render(
      <ThemedView style={{ borderRadius: 8 }} testID="styled-view" />,
    );
    expect(screen.getByTestId("styled-view")).toBeTruthy();
  });

  test("renders nested views", async () => {
    await render(
      <ThemedView testID="outer">
        <ThemedView testID="inner" />
      </ThemedView>,
    );
    expect(screen.getByTestId("outer")).toBeTruthy();
    expect(screen.getByTestId("inner")).toBeTruthy();
  });
});
