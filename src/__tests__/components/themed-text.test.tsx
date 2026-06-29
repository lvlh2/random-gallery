// ---------------------------------------------------------------------------
// Component unit tests for themed-text.tsx
// Regression coverage: text types, theme color props, base rendering
// ---------------------------------------------------------------------------

import { render, screen } from "@testing-library/react-native";
import { ThemedText } from "@/components/themed-text";

describe("<ThemedText />", () => {
  // ---- Basic rendering ----

  test("renders text content", async () => {
    await render(<ThemedText>Hello World</ThemedText>);
    expect(screen.getByText("Hello World")).toBeTruthy();
  });

  test("renders with default type (no crash)", async () => {
    await render(<ThemedText>Default</ThemedText>);
    expect(screen.getByText("Default")).toBeTruthy();
  });

  // ---- Type variants ----

  test.each([
    "default" as const,
    "title" as const,
    "small" as const,
    "smallBold" as const,
    "subtitle" as const,
    "link" as const,
    "linkPrimary" as const,
    "code" as const,
  ])("renders with type='%s' without error", async (type) => {
    await render(<ThemedText type={type}>Text with {type}</ThemedText>);
    expect(screen.getByText(`Text with ${type}`)).toBeTruthy();
  });

  // ---- themeColor prop ----

  test("accepts themeColor prop without error", async () => {
    await render(<ThemedText themeColor="text">Colored</ThemedText>);
    expect(screen.getByText("Colored")).toBeTruthy();
  });

  // ---- Style merging ----

  test("passes additional style props", async () => {
    await render(
      <ThemedText style={{ fontSize: 42, fontWeight: "900" }}>
        Styled
      </ThemedText>,
    );
    expect(screen.getByText("Styled")).toBeTruthy();
  });

  // ---- Edge cases ----

  test("renders empty string without crash", async () => {
    await render(<ThemedText></ThemedText>);
    // Empty Text renders without throwing — test passes if no error
  });

  test("renders numeric children", async () => {
    await render(<ThemedText>{42}</ThemedText>);
    expect(screen.getByText("42")).toBeTruthy();
  });

  test("renders nested text", async () => {
    await render(
      <ThemedText>
        Hello <ThemedText type="smallBold">Bold</ThemedText> World
      </ThemedText>,
    );
    expect(screen.getByText("Bold")).toBeTruthy();
  });
});
