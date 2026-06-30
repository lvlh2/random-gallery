// ---------------------------------------------------------------------------
// Unit tests for folders.ts
// Regression coverage: folder CRUD operations, AsyncStorage persistence,
// edge cases for corrupted/empty storage
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getFolders,
  saveFolders,
  addFolder,
  removeFolder,
  toggleFolder,
} from "@/services/folders";
import type { FolderImport } from "@/services/folders";

// Access the mocked store from jest.setup.ts
const store: Map<string, string> = (AsyncStorage as any).__store;

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

// ---- Helper ----

function makeFolder(overrides: Partial<FolderImport> = {}): FolderImport {
  return {
    id: overrides.id ?? "test-id",
    uri: overrides.uri ?? "content://test/folder",
    name: overrides.name ?? "Test Folder",
    enabled: overrides.enabled ?? true,
  };
}

// ---- getFolders ----

describe("getFolders", () => {
  test("returns empty array when nothing is stored", async () => {
    const folders = await getFolders();
    expect(folders).toEqual([]);
  });

  test("returns parsed folders from storage", async () => {
    const data: FolderImport[] = [
      makeFolder({ id: "f1", name: "DCIM" }),
      makeFolder({ id: "f2", name: "Camera", enabled: false }),
    ];
    store.set("@random-gallery/folders", JSON.stringify(data));

    const folders = await getFolders();
    expect(folders).toHaveLength(2);
    expect(folders[0].name).toBe("DCIM");
    expect(folders[1].enabled).toBe(false);
  });

  test("returns empty array when JSON is malformed", async () => {
    store.set("@random-gallery/folders", "{broken json!!");
    const folders = await getFolders();
    expect(folders).toEqual([]);
  });

  test("returns empty array when stored value is not an array", async () => {
    store.set("@random-gallery/folders", JSON.stringify({ not: "an array" }));
    const folders = await getFolders();
    expect(folders).toEqual([]);
  });

  test("returns empty array when stored value is a string", async () => {
    store.set("@random-gallery/folders", '"just a string"');
    const folders = await getFolders();
    expect(folders).toEqual([]);
  });
});

// ---- saveFolders ----

describe("saveFolders", () => {
  test("persists folders to AsyncStorage", async () => {
    const data = [makeFolder({ id: "f1" })];
    await saveFolders(data);

    const stored = store.get("@random-gallery/folders");
    expect(stored).toBeDefined();
    expect(JSON.parse(stored!)).toEqual(data);
  });

  test("overwrites existing folders", async () => {
    store.set(
      "@random-gallery/folders",
      JSON.stringify([makeFolder({ id: "old" })]),
    );
    await saveFolders([makeFolder({ id: "new" })]);

    const stored = JSON.parse(store.get("@random-gallery/folders")!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("new");
  });

  test("saves empty array", async () => {
    await saveFolders([]);
    expect(JSON.parse(store.get("@random-gallery/folders")!)).toEqual([]);
  });
});

// ---- addFolder ----

describe("addFolder", () => {
  test("adds a new enabled folder and returns the updated list", async () => {
    const result = await addFolder("content://new", "New Folder");
    expect(result).toHaveLength(1);
    expect(result[0].uri).toBe("content://new");
    expect(result[0].name).toBe("New Folder");
    expect(result[0].enabled).toBe(true);
    expect(result[0].id).toBeTruthy();
  });

  test("appends to existing folders", async () => {
    store.set(
      "@random-gallery/folders",
      JSON.stringify([makeFolder({ id: "f1", name: "First" })]),
    );

    const result = await addFolder("content://second", "Second");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("First");
    expect(result[1].name).toBe("Second");
  });

  test("persists the new folder to storage", async () => {
    await addFolder("content://test", "Test");
    const stored = await getFolders();
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Test");
  });

  test("generates unique IDs for each folder", async () => {
    const r1 = await addFolder("u1", "A");
    const r2 = await addFolder("u2", "B");
    expect(r1[0].id).not.toBe(r2[1].id);
  });
});

// ---- removeFolder ----

describe("removeFolder", () => {
  test("removes the folder with matching ID", async () => {
    store.set(
      "@random-gallery/folders",
      JSON.stringify([
        makeFolder({ id: "keep", name: "Keep" }),
        makeFolder({ id: "delete", name: "Delete Me" }),
      ]),
    );

    const result = await removeFolder("delete");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("keep");
  });

  test("no-ops when ID does not exist", async () => {
    store.set(
      "@random-gallery/folders",
      JSON.stringify([makeFolder({ id: "f1" })]),
    );

    const result = await removeFolder("nonexistent");
    expect(result).toHaveLength(1);
  });

  test("persists the removal", async () => {
    store.set(
      "@random-gallery/folders",
      JSON.stringify([makeFolder({ id: "f1" })]),
    );
    await removeFolder("f1");

    const stored = await getFolders();
    expect(stored).toEqual([]);
  });

  test("handles removal from empty list", async () => {
    const result = await removeFolder("any");
    expect(result).toEqual([]);
  });
});

// ---- toggleFolder ----

describe("toggleFolder", () => {
  test("toggles enabled from true to false", async () => {
    store.set(
      "@random-gallery/folders",
      JSON.stringify([makeFolder({ id: "f1", enabled: true })]),
    );

    const result = await toggleFolder("f1");
    expect(result[0].enabled).toBe(false);
  });

  test("toggles enabled from false to true", async () => {
    store.set(
      "@random-gallery/folders",
      JSON.stringify([makeFolder({ id: "f1", enabled: false })]),
    );

    const result = await toggleFolder("f1");
    expect(result[0].enabled).toBe(true);
  });

  test("does not affect other folders", async () => {
    store.set(
      "@random-gallery/folders",
      JSON.stringify([
        makeFolder({ id: "f1", enabled: true }),
        makeFolder({ id: "f2", enabled: false }),
      ]),
    );

    const result = await toggleFolder("f1");
    expect(result[0].enabled).toBe(false);
    expect(result[1].enabled).toBe(false); // unchanged
  });

  test("no-ops when ID does not exist", async () => {
    store.set(
      "@random-gallery/folders",
      JSON.stringify([makeFolder({ id: "f1" })]),
    );

    const result = await toggleFolder("nonexistent");
    expect(result).toHaveLength(1);
    expect(result[0].enabled).toBe(true); // unchanged
  });

  test("does not mutate the original object", async () => {
    const original = makeFolder({ id: "f1", enabled: true });
    store.set("@random-gallery/folders", JSON.stringify([original]));

    const result = await toggleFolder("f1");
    // Original stored object should remain unchanged
    expect(original.enabled).toBe(true);
    // Result should be a new object
    expect(result[0]).not.toBe(original);
  });
});
