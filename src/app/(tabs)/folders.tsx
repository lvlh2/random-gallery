import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { Colors } from "@/constants/theme";
import * as FolderService from "@/services/folders";
import type { FolderImport } from "@/services/folders";
import { invalidateCache } from "@/services/media-loader";

// SAF is Android-only.
let StorageAccessFramework: any = null;
if (Platform.OS === "android") {
  const SAF = require("expo-file-system/legacy");
  StorageAccessFramework = SAF.StorageAccessFramework;
}

export default function FoldersScreen() {
  const [folders, setFolders] = useState<FolderImport[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      FolderService.getFolders()
        .then(setFolders)
        .finally(() => setLoading(false));
    }, []),
  );

  async function handleImport() {
    if (!StorageAccessFramework) {
      Alert.alert("Not Supported", "Folder import requires Android.");
      return;
    }
    try {
      const result =
        await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (result.granted) {
        const uri = result.directoryUri;
        // Extract folder name: e.g. "primary:DCIM/Camera" → "Camera"
        const rawLast = uri.split("/").pop() || "";
        const decoded = decodeURIComponent(rawLast);
        const name = decoded.split(/[/:]/).filter(Boolean).pop() || "Folder";
        const updated = await FolderService.addFolder(uri, name);
        invalidateCache();
        setFolders(updated);
      }
    } catch (error: any) {
      Alert.alert("Error", `Could not import folder: ${error.message}`);
    }
  }

  async function handleToggle(id: string) {
    const updated = await FolderService.toggleFolder(id);
    invalidateCache();
    setFolders(updated);
  }

  function handleRemove(folder: FolderImport) {
    Alert.alert(
      "Remove Folder",
      `Stop importing "${folder.name}"?\nSource files will NOT be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const updated = await FolderService.removeFolder(folder.id);
            invalidateCache();
            setFolders(updated);
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Folders</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Import folders to include their images in the random gallery.
        </ThemedText>
      </ThemedView>

      {/* Folder list */}
      {folders.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText themeColor="textSecondary" style={styles.emptyTitle}>
            No folders imported yet
          </ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            Tap the button below to pick a folder.
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {folders.map((folder) => (
            <ThemedView
              key={folder.id}
              type="backgroundElement"
              style={styles.folderItem}
            >
              <Pressable
                onPress={() => handleToggle(folder.id)}
                style={styles.checkboxRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    folder.enabled && styles.checkboxChecked,
                  ]}
                >
                  {folder.enabled && (
                    <ThemedText style={styles.checkmark}>✓</ThemedText>
                  )}
                </View>
                <ThemedText style={styles.folderName} numberOfLines={1}>
                  {folder.name}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => handleRemove(folder)}
                style={styles.removeButton}
              >
                <ThemedText themeColor="textSecondary" type="small">
                  Remove
                </ThemedText>
              </Pressable>
            </ThemedView>
          ))}
        </ScrollView>
      )}

      {/* Tips */}
      <ThemedView style={styles.tipBox}>
        <ThemedText themeColor="textSecondary" type="small">
          💡 Tip: Swipe up on an image to delete it.
        </ThemedText>
      </ThemedView>

      {/* Import button */}
      <View style={styles.bottomBar}>
        <Pressable onPress={handleImport} style={styles.importButton}>
          <ThemedText style={styles.importButtonText}>Import Folder</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  center: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  emptyTitle: { fontSize: 16 },
  folderItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  checkboxRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.dark.textSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.text,
    borderColor: Colors.dark.text,
  },
  checkmark: {
    fontSize: 14,
    color: Colors.dark.background,
    fontWeight: "bold",
  },
  folderName: { flex: 1 },
  removeButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  tipBox: {
    marginHorizontal: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: Colors.dark.backgroundElement,
    opacity: 0.7,
  },
  bottomBar: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.two,
    paddingTop: Spacing.two,
  },
  importButton: {
    backgroundColor: Colors.dark.text,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: "center",
  },
  importButtonText: {
    color: Colors.dark.background,
    fontWeight: "600",
    fontSize: 16,
  },
});
