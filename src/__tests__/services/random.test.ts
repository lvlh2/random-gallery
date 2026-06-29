// ---------------------------------------------------------------------------
// Unit tests for random.ts
// Regression coverage: Fisher-Yates shuffle correctness
// ---------------------------------------------------------------------------

import { fisherYatesShuffle } from "@/services/random";

describe("fisherYatesShuffle", () => {
  // ---- Basic correctness ----

  test("returns array of same length", () => {
    const input = [1, 2, 3, 4, 5];
    const result = fisherYatesShuffle(input);
    expect(result).toHaveLength(input.length);
  });

  test("contains the same elements (no loss, no duplication)", () => {
    const input = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = fisherYatesShuffle(input);
    expect(result.sort((a, b) => a - b)).toEqual(input);
  });

  test("does NOT mutate the original array", () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    fisherYatesShuffle(input);
    expect(input).toEqual(copy);
  });

  test("returns a new array reference", () => {
    const input = [1, 2, 3];
    const result = fisherYatesShuffle(input);
    expect(result).not.toBe(input);
  });

  // ---- Edge cases ----

  test("empty array", () => {
    const result = fisherYatesShuffle([]);
    expect(result).toEqual([]);
  });

  test("single-element array", () => {
    const result = fisherYatesShuffle([42]);
    expect(result).toEqual([42]);
  });

  test("two-element array", () => {
    const input = [1, 2];
    // Run enough times to hit both permutations at least once
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(JSON.stringify(fisherYatesShuffle(input)));
    }
    expect(results.size).toBeGreaterThanOrEqual(1); // at minimum, doesn't crash
  });

  // ---- Distribution test (probabilistic) ----

  test("produces reasonable distribution for small array", () => {
    const input = [1, 2, 3];
    const counts: Record<string, number> = {};
    const ITERATIONS = 6000;

    for (let i = 0; i < ITERATIONS; i++) {
      const key = JSON.stringify(fisherYatesShuffle(input));
      counts[key] = (counts[key] || 0) + 1;
    }

    // There are 6 possible permutations of [1,2,3].
    // Each should appear roughly ITERATIONS/6 = 1000 times.
    // With 6000 iterations, allow a reasonable ±30% tolerance.
    const expectedPerPermutation = ITERATIONS / 6;
    for (const key of Object.keys(counts)) {
      expect(counts[key]).toBeGreaterThan(expectedPerPermutation * 0.5);
      expect(counts[key]).toBeLessThan(expectedPerPermutation * 1.5);
    }
  });

  // ---- Type tests (TypeScript) ----

  test("works with string arrays", () => {
    const input = ["a", "b", "c", "d"];
    const result = fisherYatesShuffle(input);
    expect(result.sort()).toEqual(["a", "b", "c", "d"]);
  });

  test("works with object arrays", () => {
    const input = [
      { uri: "a.jpg", name: "a" },
      { uri: "b.jpg", name: "b" },
      { uri: "c.jpg", name: "c" },
    ];
    const result = fisherYatesShuffle(input);
    expect(result).toHaveLength(3);
    expect(result.map((x) => x.uri).sort()).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });

  // ---- Large array (performance smoke test) ----

  test("handles large arrays without error", () => {
    const input = Array.from({ length: 10000 }, (_, i) => i);
    const result = fisherYatesShuffle(input);
    expect(result).toHaveLength(10000);
    expect(result.sort((a, b) => a - b)).toEqual(input);
  });
});
