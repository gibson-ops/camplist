import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface PackingItem {
  id: string;
  listId: string;
  name: string;
  checked: boolean;
  tags: string[];
  groupId?: string; // Optional reference to an ItemGroup
  consumable: boolean; // True if item needs restocking (perishable/expendable)
  createdAt: number;
  updatedAt: number;
}

export interface PackingList {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ListGroupRef {
  id: string;
  listId: string;
  groupId: string;
  checked: boolean; // Track if the entire group is checked
  createdAt: number;
  updatedAt: number;
}

export interface ItemGroup {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  lastVerified?: number; // Timestamp of last verification
  createdAt: number;
  updatedAt: number;
}

interface CampListDB extends DBSchema {
  lists: {
    key: string;
    value: PackingList;
    indexes: { "by-date": number };
  };
  items: {
    key: string;
    value: PackingItem;
    indexes: { "by-list": string; "by-date": number; "by-group": string };
  };
  groups: {
    key: string;
    value: ItemGroup;
    indexes: { "by-date": number };
  };
  listGroupRefs: {
    key: string;
    value: ListGroupRef;
    indexes: { "by-list": string; "by-group": string };
  };
}

const DB_NAME = "camplist-db";
const DB_VERSION = 4;

let dbInstance: IDBPDatabase<CampListDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<CampListDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<CampListDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      // Create lists store
      if (!db.objectStoreNames.contains("lists")) {
        const listStore = db.createObjectStore("lists", { keyPath: "id" });
        listStore.createIndex("by-date", "createdAt");
      }

      // Create items store
      if (!db.objectStoreNames.contains("items")) {
        const itemStore = db.createObjectStore("items", { keyPath: "id" });
        itemStore.createIndex("by-list", "listId");
        itemStore.createIndex("by-date", "createdAt");
        itemStore.createIndex("by-group", "groupId");
      }

      // Create groups store
      if (!db.objectStoreNames.contains("groups")) {
        const groupStore = db.createObjectStore("groups", { keyPath: "id" });
        groupStore.createIndex("by-date", "createdAt");
      }

      // Migration to v2: Add tags field
      if (oldVersion < 2 && oldVersion > 0) {
        const listStore = transaction.objectStore("lists");
        const itemStore = transaction.objectStore("items");

        listStore.getAllKeys().then(async (keys) => {
          for (const key of keys) {
            const list = await listStore.get(key);
            if (list && !list.tags) {
              list.tags = [];
              await listStore.put(list);
            }
          }
        });

        itemStore.getAllKeys().then(async (keys) => {
          for (const key of keys) {
            const item = await itemStore.get(key);
            if (item && !item.tags) {
              item.tags = [];
              await itemStore.put(item);
            }
          }
        });
      }

      // Migration to v3: Add groupId and consumable fields, create groups store
      if (oldVersion < 3 && oldVersion > 0) {
        const itemStore = transaction.objectStore("items");

        // Add by-group index if it doesn't exist
        if (!itemStore.indexNames.contains("by-group")) {
          itemStore.createIndex("by-group", "groupId");
        }

        // Migrate existing items to add consumable flag
        itemStore.getAllKeys().then(async (keys) => {
          for (const key of keys) {
            const item = await itemStore.get(key);
            if (item && item.consumable === undefined) {
              item.consumable = false;
              await itemStore.put(item);
            }
          }
        });
      }

      // Migration to v4: Add listGroupRefs store for tracking groups added to lists
      if (oldVersion < 4 && oldVersion > 0) {
        if (!db.objectStoreNames.contains("listGroupRefs")) {
          const refStore = db.createObjectStore("listGroupRefs", {
            keyPath: "id",
          });
          refStore.createIndex("by-list", "listId");
          refStore.createIndex("by-group", "groupId");
        }
      }

      // Create listGroupRefs store for fresh installs
      if (!db.objectStoreNames.contains("listGroupRefs")) {
        const refStore = db.createObjectStore("listGroupRefs", {
          keyPath: "id",
        });
        refStore.createIndex("by-list", "listId");
        refStore.createIndex("by-group", "groupId");
      }
    },
  });

  return dbInstance;
}

// List operations
export async function getAllLists(): Promise<PackingList[]> {
  const db = await getDB();
  return db.getAllFromIndex("lists", "by-date");
}

export async function getList(id: string): Promise<PackingList | undefined> {
  const db = await getDB();
  return db.get("lists", id);
}

export async function createList(
  list: Omit<PackingList, "id" | "createdAt" | "updatedAt">
): Promise<PackingList> {
  const db = await getDB();
  const now = Date.now();
  const newList: PackingList = {
    ...list,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.add("lists", newList);
  return newList;
}

export async function updateList(
  id: string,
  updates: Partial<Omit<PackingList, "id" | "createdAt">>
): Promise<PackingList> {
  const db = await getDB();
  const existing = await db.get("lists", id);
  if (!existing) {
    throw new Error("List not found");
  }
  const updated: PackingList = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };
  await db.put("lists", updated);
  return updated;
}

export async function deleteList(id: string): Promise<void> {
  const db = await getDB();
  // Delete the list
  await db.delete("lists", id);
  // Delete all items in the list
  const items = await getItemsForList(id);
  for (const item of items) {
    await db.delete("items", item.id);
  }
  // Delete all group references for this list
  const groupRefs = await getGroupRefsForList(id);
  for (const ref of groupRefs) {
    await db.delete("listGroupRefs", ref.id);
  }
}

// Item operations
export async function getItemsForList(listId: string): Promise<PackingItem[]> {
  const db = await getDB();
  return db.getAllFromIndex("items", "by-list", listId);
}

export async function getItem(id: string): Promise<PackingItem | undefined> {
  const db = await getDB();
  return db.get("items", id);
}

export async function createItem(
  item: Omit<PackingItem, "id" | "createdAt" | "updatedAt">
): Promise<PackingItem> {
  const db = await getDB();
  const now = Date.now();
  const newItem: PackingItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.add("items", newItem);
  return newItem;
}

export async function updateItem(
  id: string,
  updates: Partial<Omit<PackingItem, "id" | "createdAt">>
): Promise<PackingItem> {
  const db = await getDB();
  const existing = await db.get("items", id);
  if (!existing) {
    throw new Error("Item not found");
  }
  const updated: PackingItem = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };
  await db.put("items", updated);
  return updated;
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("items", id);
}

export async function toggleItemChecked(id: string): Promise<PackingItem> {
  const item = await getItem(id);
  if (!item) {
    throw new Error("Item not found");
  }
  return updateItem(id, { checked: !item.checked });
}

// Tag operations
export async function getAllTags(): Promise<{
  listTags: string[];
  itemTags: string[];
}> {
  const db = await getDB();
  const lists = await db.getAll("lists");
  const items = await db.getAll("items");

  const listTagSet = new Set<string>();
  const itemTagSet = new Set<string>();

  lists.forEach((list) => {
    list.tags?.forEach((tag) => listTagSet.add(tag));
  });

  items.forEach((item) => {
    item.tags?.forEach((tag) => itemTagSet.add(tag));
  });

  return {
    listTags: Array.from(listTagSet).sort(),
    itemTags: Array.from(itemTagSet).sort(),
  };
}

// Suggestion interface
export interface ItemSuggestion {
  name: string;
  tags: string[];
  frequency: number; // How many times this item appears in matching lists
  matchScore: number; // How well the tags match
  coOccurrenceScore?: number; // How often this item appears with items in the current list (0-1)
  coOccurrenceCount?: number; // Number of times it co-occurred with current items
}

// Get item suggestions based on list tags
export async function getSuggestedItems(
  listTags: string[]
): Promise<ItemSuggestion[]> {
  if (listTags.length === 0) {
    return [];
  }

  const db = await getDB();
  const allLists = await db.getAll("lists");
  const allItems = await db.getAll("items");

  // Find lists that share tags with the current list
  const matchingLists = allLists.filter((list) => {
    const sharedTags = list.tags.filter((tag) => listTags.includes(tag));
    return sharedTags.length > 0;
  });

  if (matchingLists.length === 0) {
    return [];
  }

  // Build a map of items by name with their aggregate data
  const itemMap = new Map<
    string,
    {
      tags: Set<string>;
      frequency: number;
      matchScore: number;
    }
  >();

  // Process items from matching lists
  for (const list of matchingLists) {
    const listItems = allItems.filter((item) => item.listId === list.id);
    const sharedTags = list.tags.filter((tag) => listTags.includes(tag));
    const matchScore = sharedTags.length / listTags.length;

    for (const item of listItems) {
      const existing = itemMap.get(item.name);
      if (existing) {
        existing.frequency++;
        existing.matchScore = Math.max(existing.matchScore, matchScore);
        item.tags?.forEach((tag) => existing.tags.add(tag));
      } else {
        itemMap.set(item.name, {
          tags: new Set(item.tags || []),
          frequency: 1,
          matchScore,
        });
      }
    }
  }

  // Convert to array and sort by relevance
  const suggestions: ItemSuggestion[] = Array.from(itemMap.entries())
    .map(([name, data]) => ({
      name,
      tags: Array.from(data.tags),
      frequency: data.frequency,
      matchScore: data.matchScore,
    }))
    .sort((a, b) => {
      // Sort by match score first, then frequency
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return b.frequency - a.frequency;
    });

  return suggestions;
}

// Get item suggestions based on co-occurrence patterns with current list items
export async function getCoOccurrenceRecommendations(
  currentItemNames: string[]
): Promise<ItemSuggestion[]> {
  if (currentItemNames.length === 0) {
    return [];
  }

  const db = await getDB();
  const allItems = await db.getAll("items");

  // Normalize current item names for comparison
  const normalizedCurrentNames = currentItemNames.map((name) =>
    name.toLowerCase().trim()
  );

  // Build a map of lists that contain each current item
  const listsPerCurrentItem = new Map<string, Set<string>>();

  for (const item of allItems) {
    const normalizedName = item.name.toLowerCase().trim();
    if (normalizedCurrentNames.includes(normalizedName)) {
      if (!listsPerCurrentItem.has(normalizedName)) {
        listsPerCurrentItem.set(normalizedName, new Set());
      }
      listsPerCurrentItem.get(normalizedName)!.add(item.listId);
    }
  }

  // Find all items that co-occur with current items
  const coOccurrenceMap = new Map<
    string,
    {
      tags: Set<string>;
      coOccurrences: number; // Total times it appeared with any current item
      listsWithCoOccurrence: Set<string>; // Unique lists where it co-occurred
    }
  >();

  for (const [, listIds] of listsPerCurrentItem.entries()) {
    // For each list containing the current item, find other items in that list
    for (const listId of listIds) {
      const listItems = allItems.filter((item) => item.listId === listId);

      for (const item of listItems) {
        const normalizedName = item.name.toLowerCase().trim();

        // Skip if it's one of the current items
        if (normalizedCurrentNames.includes(normalizedName)) {
          continue;
        }

        // Add or update co-occurrence data
        if (!coOccurrenceMap.has(item.name)) {
          coOccurrenceMap.set(item.name, {
            tags: new Set(item.tags || []),
            coOccurrences: 0,
            listsWithCoOccurrence: new Set(),
          });
        }

        const data = coOccurrenceMap.get(item.name)!;
        data.coOccurrences++;
        data.listsWithCoOccurrence.add(listId);
        item.tags?.forEach((tag) => data.tags.add(tag));
      }
    }
  }

  // Calculate total list instances for current items (for scoring)
  const totalCurrentItemLists = Array.from(listsPerCurrentItem.values()).reduce(
    (sum, set) => sum + set.size,
    0
  );

  // Convert to suggestions with scoring
  const suggestions: ItemSuggestion[] = Array.from(coOccurrenceMap.entries())
    .map(([name, data]) => {
      // Co-occurrence score: how often this item appears when current items are present
      const coOccurrenceScore =
        totalCurrentItemLists > 0
          ? data.coOccurrences / totalCurrentItemLists
          : 0;

      return {
        name,
        tags: Array.from(data.tags),
        frequency: data.listsWithCoOccurrence.size,
        matchScore: 0, // Not based on tag matching in this case
        coOccurrenceScore,
        coOccurrenceCount: data.coOccurrences,
      };
    })
    .filter((s) => s.coOccurrenceScore > 0.1) // Only show items with >10% co-occurrence
    .sort((a, b) => {
      // Sort by co-occurrence score first, then by frequency
      if (b.coOccurrenceScore! !== a.coOccurrenceScore!) {
        return b.coOccurrenceScore! - a.coOccurrenceScore!;
      }
      return b.frequency - a.frequency;
    });

  return suggestions;
}

// Get combined suggestions: both tag-based and co-occurrence based
export async function getCombinedSuggestions(
  listTags: string[],
  currentItemNames: string[]
): Promise<ItemSuggestion[]> {
  // Get both types of suggestions
  const [tagSuggestions, coOccurrenceSuggestions] = await Promise.all([
    getSuggestedItems(listTags),
    getCoOccurrenceRecommendations(currentItemNames),
  ]);

  // Merge suggestions by item name
  const mergedMap = new Map<string, ItemSuggestion>();

  // Add tag-based suggestions
  for (const suggestion of tagSuggestions) {
    const key = suggestion.name.toLowerCase().trim();
    mergedMap.set(key, { ...suggestion });
  }

  // Merge in co-occurrence suggestions
  for (const suggestion of coOccurrenceSuggestions) {
    const key = suggestion.name.toLowerCase().trim();
    const existing = mergedMap.get(key);

    if (existing) {
      // Combine data if item exists in both
      existing.coOccurrenceScore = suggestion.coOccurrenceScore;
      existing.coOccurrenceCount = suggestion.coOccurrenceCount;
      // Update frequency to be the max
      existing.frequency = Math.max(existing.frequency, suggestion.frequency);
      // Merge tags
      const allTags = new Set([...existing.tags, ...suggestion.tags]);
      existing.tags = Array.from(allTags);
    } else {
      // Add new co-occurrence suggestion
      mergedMap.set(key, { ...suggestion });
    }
  }

  // Convert to array and sort by relevance
  const combined = Array.from(mergedMap.values()).sort((a, b) => {
    // Prioritize items with co-occurrence data
    const aHasCoOccurrence = (a.coOccurrenceScore || 0) > 0;
    const bHasCoOccurrence = (b.coOccurrenceScore || 0) > 0;

    if (aHasCoOccurrence && !bHasCoOccurrence) return -1;
    if (!aHasCoOccurrence && bHasCoOccurrence) return 1;

    // If both have co-occurrence, sort by co-occurrence score
    if (aHasCoOccurrence && bHasCoOccurrence) {
      if (b.coOccurrenceScore! !== a.coOccurrenceScore!) {
        return b.coOccurrenceScore! - a.coOccurrenceScore!;
      }
    }

    // Fall back to tag match score, then frequency
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return b.frequency - a.frequency;
  });

  return combined;
}

// Item Group operations
export async function getAllGroups(): Promise<ItemGroup[]> {
  const db = await getDB();
  return db.getAllFromIndex("groups", "by-date");
}

export async function getGroup(id: string): Promise<ItemGroup | undefined> {
  const db = await getDB();
  return db.get("groups", id);
}

export async function createGroup(
  group: Omit<ItemGroup, "id" | "createdAt" | "updatedAt">
): Promise<ItemGroup> {
  const db = await getDB();
  const now = Date.now();
  const newGroup: ItemGroup = {
    ...group,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.add("groups", newGroup);
  return newGroup;
}

export async function updateGroup(
  id: string,
  updates: Partial<Omit<ItemGroup, "id" | "createdAt">>
): Promise<ItemGroup> {
  const db = await getDB();
  const existing = await db.get("groups", id);
  if (!existing) {
    throw new Error("Group not found");
  }
  const updated: ItemGroup = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };
  await db.put("groups", updated);
  return updated;
}

export async function deleteGroup(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("groups", id);
  // Note: We don't delete items in the group, just remove their groupId reference
  const items = await getItemsForGroup(id);
  for (const item of items) {
    await updateItem(item.id, { groupId: undefined });
  }
}

export async function getItemsForGroup(
  groupId: string
): Promise<PackingItem[]> {
  const db = await getDB();
  return db.getAllFromIndex("items", "by-group", groupId);
}

// Create a group item (template item that belongs to a group)
export async function createGroupItem(
  groupId: string,
  item: Omit<
    PackingItem,
    "id" | "createdAt" | "updatedAt" | "listId" | "checked"
  >
): Promise<PackingItem> {
  const db = await getDB();
  const now = Date.now();
  const newItem: PackingItem = {
    ...item,
    id: crypto.randomUUID(),
    listId: "", // Group items don't belong to a list initially
    checked: false,
    groupId,
    createdAt: now,
    updatedAt: now,
  };
  await db.add("items", newItem);
  return newItem;
}

// Add a group to a packing list (creates a reference, not copies)
export async function addGroupToList(
  groupId: string,
  listId: string
): Promise<ListGroupRef> {
  const db = await getDB();
  const now = Date.now();
  const ref: ListGroupRef = {
    id: crypto.randomUUID(),
    listId,
    groupId,
    checked: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.add("listGroupRefs", ref);
  return ref;
}

// Remove a group from a packing list
export async function removeGroupFromList(refId: string): Promise<void> {
  const db = await getDB();
  await db.delete("listGroupRefs", refId);
}

// Get all groups added to a specific list
export async function getGroupRefsForList(
  listId: string
): Promise<ListGroupRef[]> {
  const db = await getDB();
  return db.getAllFromIndex("listGroupRefs", "by-list", listId);
}

// Toggle the checked status of a group in a list
export async function toggleGroupChecked(refId: string): Promise<ListGroupRef> {
  const db = await getDB();
  const ref = await db.get("listGroupRefs", refId);
  if (!ref) {
    throw new Error("Group reference not found");
  }
  const updated: ListGroupRef = {
    ...ref,
    checked: !ref.checked,
    updatedAt: Date.now(),
  };
  await db.put("listGroupRefs", updated);
  return updated;
}

// Mark a group as verified
export async function verifyGroup(groupId: string): Promise<ItemGroup> {
  const db = await getDB();
  const group = await db.get("groups", groupId);
  if (!group) {
    throw new Error("Group not found");
  }
  const updated: ItemGroup = {
    ...group,
    lastVerified: Date.now(),
    updatedAt: Date.now(),
  };
  await db.put("groups", updated);
  return updated;
}

// Check if a group needs verification (not verified today)
export function groupNeedsVerification(group: ItemGroup): boolean {
  if (!group.lastVerified) {
    return true;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastVerified = new Date(group.lastVerified);
  lastVerified.setHours(0, 0, 0, 0);
  return lastVerified.getTime() < today.getTime();
}

// Search interface for item lookup
export interface ItemSearchResult {
  name: string;
  tags: string[];
  consumable: boolean;
  usageCount: number; // Number of times this item has been used across lists
}

// Search for items across all lists by name
export async function searchItems(query: string): Promise<ItemSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const db = await getDB();
  const allItems = await db.getAll("items");

  const normalizedQuery = query.toLowerCase().trim();

  // Build a map of unique items by name
  const itemMap = new Map<
    string,
    {
      tags: Set<string>;
      consumable: boolean;
      usageCount: number;
    }
  >();

  for (const item of allItems) {
    const normalizedName = item.name.toLowerCase().trim();

    // Check if the item name contains the query
    if (normalizedName.includes(normalizedQuery)) {
      const key = item.name; // Use original case for display
      const existing = itemMap.get(key);

      if (existing) {
        existing.usageCount++;
        item.tags?.forEach((tag) => existing.tags.add(tag));
        // If any instance is consumable, mark as consumable
        if (item.consumable) {
          existing.consumable = true;
        }
      } else {
        itemMap.set(key, {
          tags: new Set(item.tags || []),
          consumable: item.consumable || false,
          usageCount: 1,
        });
      }
    }
  }

  // Convert to array and sort by usage count (most used first)
  const results: ItemSearchResult[] = Array.from(itemMap.entries())
    .map(([name, data]) => ({
      name,
      tags: Array.from(data.tags),
      consumable: data.consumable,
      usageCount: data.usageCount,
    }))
    .sort((a, b) => b.usageCount - a.usageCount);

  return results;
}
