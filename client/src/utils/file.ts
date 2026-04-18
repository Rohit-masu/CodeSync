import { FileSystemItem, Id } from "@/types/file"

const initialCode = `function sayHi() {
  console.log("👋 Hello world");
}

sayHi()`

// Helper to rebuild tree from flat array
export function buildFileStructureFromArray(nodes: any[]) {
  if (!nodes || nodes.length === 0) {
      return initialFileStructure
  }

  const nodeMap = new Map()
  // Map nodeId to id for frontend FileSystemItem compatibility
  nodes.forEach(n => nodeMap.set(n.nodeId, { ...n, id: n.nodeId, children: [] }))
  
  // Find the root node. In the DB, the root node might have parentId: null
  let root = Array.from(nodeMap.values()).find(n => n.parentId === null)
  
  // Fallback if no explicit root is found
  if (!root && nodeMap.has("root-id")) {
      root = nodeMap.get("root-id")
  }
  
  // If still no root, create a dummy root and attach top-level items
  if (!root) {
      root = {
          id: "root-id",
          name: "root",
          type: "directory",
          children: []
      }
      nodeMap.set("root-id", root)
  }

  nodes.forEach(n => {
    if (n.parentId && nodeMap.has(n.parentId)) {
      nodeMap.get(n.parentId).children.push(nodeMap.get(n.nodeId))
    } else if (n.nodeId !== root.id) {
      // If it has no parent and isn't the root itself, attach to root
      root.children.push(nodeMap.get(n.nodeId))
    }
  })
  
  return root
}

export const initialFileStructure: FileSystemItem = {
  name: "root",
  id: "root-id",
  type: "directory",
  children: [
    {
      id: "initial-file-id",
      type: "file",
      name: "index.js",
      content: initialCode,
    },
  ],
}

export const findParentDirectory = (
    directory: FileSystemItem,
    parentDirId: Id,
): FileSystemItem | null => {
    // Checking the current directory matches the parentDirName
    if (directory.id === parentDirId && directory.type === "directory") {
        return directory
    }

    // Recursively searching children if it's a directory
    if (directory.type === "directory" && directory.children) {
        for (const child of directory.children) {
            const found = findParentDirectory(child, parentDirId)
            if (found) {
                return found
            }
        }
    }

    // Return null if not found
    return null
}

export const isFileExist = (parentDir: FileSystemItem, name: string) => {
    if (!parentDir.children) return false
    return parentDir.children.some((file) => file.name === name)
}

export const getFileById = (
    fileStructure: FileSystemItem,
    fileId: Id,
): FileSystemItem | null => {
    const findFile = (directory: FileSystemItem): FileSystemItem | null => {
        if (directory.id === fileId) {
            return directory
        } else if (directory.children) {
            for (const child of directory.children) {
                const found = findFile(child)
                if (found) {
                    return found
                }
            }
        }
        return null
    }

    return findFile(fileStructure)
}

export const sortFileSystemItem = (item: FileSystemItem): FileSystemItem => {
    // Recursively sort children if it's a directory
    if (item.type === "directory" && item.children) {
        // Separate directories and files
        let directories = item.children.filter(
            (child) => child.type === "directory",
        )
        const files = item.children.filter((child) => child.type === "file")

        // Sort directories by name (A-Z)
        directories.sort((a, b) => a.name.localeCompare(b.name))

        // Recursively sort nested directories
        directories = directories.map((dir) => sortFileSystemItem(dir))

        // Sort files by name (A-Z)
        files.sort((a, b) => a.name.localeCompare(b.name))

        // Combine sorted directories and files
        item.children = [
            ...directories.filter((dir) => dir.name.startsWith(".")),
            ...directories.filter((dir) => !dir.name.startsWith(".")),
            ...files.filter((file) => file.name.startsWith(".")),
            ...files.filter((file) => !file.name.startsWith(".")),
        ]
    }

    return item
}
