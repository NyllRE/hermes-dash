import type { TreeItem } from "@nuxt/ui";

function iconForPath(path: string): string {
  const ext = path.split(".").pop();
  return `i-vscode-icons-file-type-${ext}`;
}

interface FileTreeNode {
  label: string;
  icon?: string;
  defaultExpanded?: boolean;
  children: FileTreeNode[];
}

function buildFileTree(paths: string[], folder: string): TreeItem[] {
  const folderDepth = folder.split("/").length - 1;
  const root: FileTreeNode = {
    label: folder.split("/").pop() || folder,
    defaultExpanded: true,
    children: [],
  };

  for (const filePath of paths) {
    const parts = filePath.split("/").slice(folderDepth + 1);
    let current = root.children;
    for (const [i, part] of parts.entries()) {
      const isFile = i === parts.length - 1;
      const existing = current.find((n) => n.label === part);
      if (existing) {
        current = existing.children;
      } else if (isFile) {
        current.push({ label: part, icon: iconForPath(filePath), children: [] });
      } else {
        const dir: FileTreeNode = { label: part + "/", children: [] };
        current.push(dir);
        current = dir.children;
      }
    }
  }

  return [root];
}

function normalizeSearchResult(
  result: Record<string, unknown>,
  folder: string,
): TreeItem[] {
  if (result.matches && Array.isArray(result.matches)) {
    const folderDepth = folder.split("/").length - 1;
    const cleanedFolderName = folder.split("/").pop() || folder;
    const children = result.matches.map((file) => ({
      label: file.path
        .split("/")
        .slice(folderDepth + 1)
        .join("/"),
      icon: iconForPath(file.path),
      ...file,
    }));
    return [
      {
        label: cleanedFolderName,
        defaultExpanded: true,
        children,
      },
    ];
  }

  if (result.files && Array.isArray(result.files)) {
    return buildFileTree(result.files, folder);
  }

  return [];
}

export function useSearchResult(
  result: Ref<Record<string, unknown> | null>,
  folder: Ref<string>,
) {
  const searchTreeItems = computed(() => {
    const r = result.value;
    const f = folder.value;
    if (!r || !f) return [];
    return normalizeSearchResult(r, f);
  });

  return { searchTreeItems, normalizeSearchResult, buildFileTree };
}
