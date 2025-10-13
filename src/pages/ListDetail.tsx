import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Plus, Trash2, Edit2, Package, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import {
  getList,
  getItemsForList,
  createItem,
  deleteItem,
  toggleItemChecked,
  updateList,
  updateItem,
  getAllTags,
  getCombinedSuggestions,
  getAllGroups,
  addGroupToList,
  getGroupRefsForList,
  removeGroupFromList,
  toggleGroupChecked,
  getGroup,
  getItemsForGroup,
  verifyGroup,
  groupNeedsVerification,
  type PackingList,
  type PackingItem,
  type ItemSuggestion,
  type ItemGroup,
  type ListGroupRef,
} from "@/lib/db";
import { GroupVerificationModal } from "@/components/GroupVerificationModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/TagInput";
import { ItemSuggestions } from "@/components/ItemSuggestions";
import { SearchableItemInput } from "@/components/SearchableItemInput";

export default function ListDetail() {
  const { id } = useParams();
  const [list, setList] = useState<PackingList | null>(null);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [isEditingList, setIsEditingList] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemTags, setEditItemTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<{ listTags: string[]; itemTags: string[] }>({ listTags: [], itemTags: [] });
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([]);
  const [editItemConsumable, setEditItemConsumable] = useState(false);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [groupRefs, setGroupRefs] = useState<ListGroupRef[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupDetails, setGroupDetails] = useState<Map<string, { group: ItemGroup; items: PackingItem[] }>>(new Map());
  const [verificationModal, setVerificationModal] = useState<{ group: ItemGroup; items: PackingItem[] } | null>(null);

  useEffect(() => {
    if (id) {
      loadList();
      loadItems();
      loadTags();
      loadGroups();
      loadGroupRefs();
    }
  }, [id]);

  async function loadList() {
    if (!id) return;
    const loadedList = await getList(id);
    setList(loadedList || null);
    if (loadedList) {
      setEditName(loadedList.name);
      setEditDescription(loadedList.description || "");
      setEditTags(loadedList.tags || []);
      // Load suggestions when list loads - will be updated with items
      await updateSuggestions(loadedList.tags || []);
    }
  }

  async function updateSuggestions(listTags: string[]) {
    if (!id) return;
    // Get current items to use for co-occurrence analysis
    const currentItems = await getItemsForList(id);
    const currentItemNames = currentItems.map(item => item.name);

    // Get combined suggestions (tag-based + co-occurrence)
    const combinedSuggestions = await getCombinedSuggestions(listTags, currentItemNames);
    setSuggestions(combinedSuggestions);
  }

  async function loadItems() {
    if (!id) return;
    const loadedItems = await getItemsForList(id);
    setItems(loadedItems.sort((a, b) => a.createdAt - b.createdAt));
  }

  async function loadTags() {
    const tags = await getAllTags();
    setAvailableTags(tags);
  }

  async function loadGroups() {
    const allGroups = await getAllGroups();
    setGroups(allGroups);
  }

  async function loadGroupRefs() {
    if (!id) return;
    const refs = await getGroupRefsForList(id);
    setGroupRefs(refs);

    // Load details for each group
    const details = new Map();
    for (const ref of refs) {
      const group = await getGroup(ref.groupId);
      const items = await getItemsForGroup(ref.groupId);
      if (group) {
        details.set(ref.id, { group, items });
      }
    }
    setGroupDetails(details);
  }

  async function handleAddGroup(groupId: string) {
    if (!id) return;

    // Load group and items to check if verification is needed
    const group = await getGroup(groupId);
    const items = await getItemsForGroup(groupId);

    if (!group) return;

    // Check if group needs verification
    if (groupNeedsVerification(group)) {
      // Show verification modal
      setVerificationModal({ group, items });
      setShowGroupPicker(false);
    } else {
      // Add directly without verification
      await addGroupToList(groupId, id);
      await loadGroupRefs();
      setShowGroupPicker(false);
    }
  }

  async function handleVerifyAndAdd() {
    if (!verificationModal || !id) return;

    // Mark group as verified
    await verifyGroup(verificationModal.group.id);

    // Add to list
    await addGroupToList(verificationModal.group.id, id);
    await loadGroupRefs();
    await loadGroups(); // Reload to get updated lastVerified

    // Close modal
    setVerificationModal(null);
  }

  async function handleSkipVerification() {
    if (!verificationModal || !id) return;

    // Add without verifying
    await addGroupToList(verificationModal.group.id, id);
    await loadGroupRefs();

    // Close modal
    setVerificationModal(null);
  }

  async function handleRemoveGroup(refId: string) {
    await removeGroupFromList(refId);
    await loadGroupRefs();
  }

  async function handleToggleGroup(refId: string) {
    await toggleGroupChecked(refId);
    await loadGroupRefs();
  }

  function toggleGroupExpanded(refId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(refId)) {
        next.delete(refId);
      } else {
        next.add(refId);
      }
      return next;
    });
  }

  async function handleAddSuggestedItem(name: string, tags: string[]) {
    if (!id) return;

    await createItem({
      listId: id,
      name,
      checked: false,
      tags,
      consumable: false,
    });

    await loadItems();
    await loadTags();
    // Update suggestions based on new items
    if (list) {
      await updateSuggestions(list.tags || []);
    }
  }

  async function handleToggleItem(itemId: string) {
    await toggleItemChecked(itemId);
    await loadItems();
  }

  async function handleDeleteItem(itemId: string) {
    await deleteItem(itemId);
    await loadItems();
    // Update suggestions when items are removed
    if (list) {
      await updateSuggestions(list.tags || []);
    }
  }

  function handleStartEditItem(item: PackingItem) {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemTags(item.tags || []);
    setEditItemConsumable(item.consumable || false);
  }

  async function handleUpdateItem(e: React.FormEvent, itemId: string) {
    e.preventDefault();
    if (!editItemName.trim()) return;

    await updateItem(itemId, {
      name: editItemName,
      tags: editItemTags,
      consumable: editItemConsumable,
    });

    setEditingItemId(null);
    setEditItemName("");
    setEditItemTags([]);
    setEditItemConsumable(false);
    await loadItems();
    await loadTags();
  }

  function handleCancelEditItem() {
    setEditingItemId(null);
    setEditItemName("");
    setEditItemTags([]);
    setEditItemConsumable(false);
  }

  async function handleUpdateList(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !editName.trim()) return;

    await updateList(id, {
      name: editName,
      description: editDescription || undefined,
      tags: editTags,
    });

    setIsEditingList(false);
    await loadList();
    await loadTags();
    // Update suggestions when tags change
    await updateSuggestions(editTags);
  }

  const getLastVerifiedText = (group: ItemGroup) => {
    if (!group.lastVerified) {
      return "Never verified";
    }
    const now = Date.now();
    const diff = now - group.lastVerified;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "Verified today";
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days}d ago`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks}w ago`;
    } else {
      const months = Math.floor(days / 30);
      return `${months}mo ago`;
    }
  };

  if (!list) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">List not found</p>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Lists
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const checkedItemCount = items.filter((item) => item.checked).length;
  const checkedGroupCount = groupRefs.filter((ref) => ref.checked).length;
  const totalCount = items.length + groupRefs.length;
  const checkedCount = checkedItemCount + checkedGroupCount;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Link to="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Lists
          </Button>
        </Link>

        {/* Two-column layout on larger screens */}
        <div className="lg:grid lg:grid-cols-[1fr,400px] lg:gap-6">
          {/* Left column - Main content */}
          <div className="lg:overflow-auto">{/* This will contain the main list content */}

        {!isEditingList ? (
          <div className="mb-6">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-800">{list.name}</h1>
                {list.description && <p className="text-gray-600 mt-1">{list.description}</p>}
                {list.tags && list.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {list.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditingList(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
            {totalCount > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>
                    {checkedCount} of {totalCount} items
                  </span>
                </div>
                <Progress value={progress} />
              </div>
            )}
          </div>
        ) : (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Edit List</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateList} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">List Name *</Label>
                  <Input
                    id="editName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editDescription">Description</Label>
                  <Textarea
                    id="editDescription"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <TagInput
                    tags={editTags}
                    onChange={setEditTags}
                    suggestions={availableTags.listTags}
                    placeholder="e.g., camping, multi-day, water-sports..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Tags help suggest items from similar lists
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="flex-1">
                    Save Changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingList(false);
                      setEditName(list.name);
                      setEditDescription(list.description || "");
                      setEditTags(list.tags || []);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {suggestions.length > 0 && (
          <div className="mb-6">
            <ItemSuggestions
              suggestions={suggestions}
              existingItems={items.map(i => i.name)}
              onAddItem={handleAddSuggestedItem}
            />
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Add Item</CardTitle>
          </CardHeader>
          <CardContent>
            <SearchableItemInput
              existingItems={items.map(i => i.name)}
              onAddExistingItem={async (name, tags, consumable) => {
                if (!id) return;
                await createItem({
                  listId: id,
                  name,
                  checked: false,
                  tags,
                  consumable,
                });
                await loadItems();
                await loadTags();
                if (list) {
                  await updateSuggestions(list.tags || []);
                }
              }}
              onAddNewItem={async (name, tags, consumable) => {
                if (!id) return;
                await createItem({
                  listId: id,
                  name,
                  checked: false,
                  tags,
                  consumable,
                });
                await loadItems();
                await loadTags();
                if (list) {
                  await updateSuggestions(list.tags || []);
                }
              }}
            />
          </CardContent>
        </Card>

        {groups.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Add Item Group</CardTitle>
              <CardDescription>
                Add all items from a group (like "Kitchen Box") to this list at once
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showGroupPicker ? (
                <Button onClick={() => setShowGroupPicker(true)} className="w-full" variant="outline">
                  <Package className="mr-2 h-4 w-4" />
                  Select a Group
                </Button>
              ) : (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <Card key={group.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleAddGroup(group.id)}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{group.name}</span>
                              <Badge
                                variant={group.lastVerified && (Date.now() - group.lastVerified) < 24 * 60 * 60 * 1000 ? "default" : "outline"}
                                className="text-xs"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {getLastVerifiedText(group)}
                              </Badge>
                            </div>
                            {group.description && (
                              <div className="text-sm text-muted-foreground">{group.description}</div>
                            )}
                            {group.tags && group.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {group.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Plus className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Button onClick={() => setShowGroupPicker(false)} className="w-full" variant="ghost">
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
          </div>{/* End of left column */}

          {/* Right column - To Pack section (sticky on large screens) */}
          <div className="hidden lg:block">
            <div className="sticky top-4">
              <Card className="max-h-[calc(100vh-8rem)] overflow-auto">
                <CardHeader>
                  <CardTitle className="text-lg">To Pack</CardTitle>
                  {totalCount > 0 && (
                    <CardDescription>
                      {checkedCount} of {totalCount} items checked
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.length === 0 && groupRefs.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No items yet</p>
                    </div>
                  ) : (
                    <>
                      {/* Unchecked groups first */}
                      {groupRefs
                        .filter((ref) => !ref.checked)
                        .map((ref) => {
                          const detail = groupDetails.get(ref.id);
                          if (!detail) return null;
                          const { group, items: groupItems } = detail;
                          const isExpanded = expandedGroups.has(ref.id);

                          return (
                            <Card key={ref.id} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={ref.checked}
                                    onCheckedChange={() => handleToggleGroup(ref.id)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleGroupExpanded(ref.id)}
                                    className="p-0 h-auto"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      <span className="font-medium text-sm truncate">{group.name}</span>
                                      <Badge variant="secondary" className="text-xs">
                                        {groupItems.length}
                                      </Badge>
                                      <Badge
                                        variant={group.lastVerified && (Date.now() - group.lastVerified) < 24 * 60 * 60 * 1000 ? "default" : "outline"}
                                        className="text-xs"
                                      >
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        {getLastVerifiedText(group)}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                {isExpanded && groupItems.length > 0 && (
                                  <div className="mt-2 ml-8 pl-2 border-l border-gray-200 space-y-1">
                                    {groupItems.map((item) => (
                                      <div key={item.id} className="flex items-center gap-1 text-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                        <span className="text-gray-700 truncate">{item.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}

                      {/* Unchecked individual items */}
                      {items
                        .filter((item) => !item.checked)
                        .map((item) => (
                          <Card key={item.id} className="hover:shadow-md transition-shadow group">
                            <CardContent className="p-3">
                              {editingItemId === item.id ? (
                                <form onSubmit={(e) => handleUpdateItem(e, item.id)} className="space-y-2">
                                  <Input
                                    value={editItemName}
                                    onChange={(e) => setEditItemName(e.target.value)}
                                    placeholder="Item name"
                                    className="text-sm"
                                    autoFocus
                                  />
                                  <TagInput
                                    tags={editItemTags}
                                    onChange={setEditItemTags}
                                    suggestions={availableTags.itemTags}
                                    placeholder="Tags..."
                                  />
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`edit-consumable-sidebar-${item.id}`}
                                      checked={editItemConsumable}
                                      onCheckedChange={(checked) => setEditItemConsumable(checked as boolean)}
                                    />
                                    <Label htmlFor={`edit-consumable-sidebar-${item.id}`} className="text-xs font-normal cursor-pointer">
                                      Consumable
                                    </Label>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button type="submit" size="sm" className="flex-1 text-xs">
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={handleCancelEditItem}
                                      className="flex-1 text-xs"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </form>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={item.checked}
                                    onCheckedChange={() => handleToggleItem(item.id)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-sm truncate">{item.name}</span>
                                      {item.consumable && (
                                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                                          C
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleStartEditItem(item)}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteItem(item.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}

                      {/* Divider if there are checked items */}
                      {(groupRefs.some(ref => ref.checked) || items.some(item => item.checked)) && (
                        <div className="border-t border-gray-200 my-3"></div>
                      )}

                      {/* Checked groups */}
                      {groupRefs
                        .filter((ref) => ref.checked)
                        .map((ref) => {
                          const detail = groupDetails.get(ref.id);
                          if (!detail) return null;
                          const { group, items: groupItems } = detail;
                          const isExpanded = expandedGroups.has(ref.id);

                          return (
                            <Card key={ref.id} className="opacity-60 hover:opacity-100 transition-opacity">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={ref.checked}
                                    onCheckedChange={() => handleToggleGroup(ref.id)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleGroupExpanded(ref.id)}
                                    className="p-0 h-auto"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      <span className="font-medium text-sm truncate line-through text-gray-500">{group.name}</span>
                                      <Badge variant="secondary" className="text-xs opacity-60">
                                        {groupItems.length}
                                      </Badge>
                                      <Badge
                                        variant={group.lastVerified && (Date.now() - group.lastVerified) < 24 * 60 * 60 * 1000 ? "default" : "outline"}
                                        className="text-xs opacity-60"
                                      >
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        {getLastVerifiedText(group)}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                {isExpanded && groupItems.length > 0 && (
                                  <div className="mt-2 ml-8 pl-2 border-l border-gray-200 space-y-1">
                                    {groupItems.map((item) => (
                                      <div key={item.id} className="flex items-center gap-1 text-xs opacity-60">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                        <span className="text-gray-600 line-through truncate">{item.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}

                      {/* Checked individual items */}
                      {items
                        .filter((item) => item.checked)
                        .map((item) => (
                          <Card key={item.id} className="opacity-60 hover:opacity-100 transition-opacity group">
                            <CardContent className="p-3">
                              {editingItemId === item.id ? (
                                <form onSubmit={(e) => handleUpdateItem(e, item.id)} className="space-y-2">
                                  <Input
                                    value={editItemName}
                                    onChange={(e) => setEditItemName(e.target.value)}
                                    placeholder="Item name"
                                    className="text-sm"
                                    autoFocus
                                  />
                                  <TagInput
                                    tags={editItemTags}
                                    onChange={setEditItemTags}
                                    suggestions={availableTags.itemTags}
                                    placeholder="Tags..."
                                  />
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`edit-consumable-sidebar-checked-${item.id}`}
                                      checked={editItemConsumable}
                                      onCheckedChange={(checked) => setEditItemConsumable(checked as boolean)}
                                    />
                                    <Label htmlFor={`edit-consumable-sidebar-checked-${item.id}`} className="text-xs font-normal cursor-pointer">
                                      Consumable
                                    </Label>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button type="submit" size="sm" className="flex-1 text-xs">
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={handleCancelEditItem}
                                      className="flex-1 text-xs"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </form>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={item.checked}
                                    onCheckedChange={() => handleToggleItem(item.id)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-sm truncate line-through text-gray-500">{item.name}</span>
                                      {item.consumable && (
                                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-600 opacity-60">
                                          C
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleStartEditItem(item)}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteItem(item.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>{/* End of two-column layout */}

        {/* Mobile/Tablet view - show full list below */}
        <div className="space-y-6 lg:hidden mt-6">
          {items.length === 0 && groupRefs.length === 0 ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">No items yet</CardTitle>
                <CardDescription>Add your first item or group to this packing list!</CardDescription>
              </CardContent>
            </Card>
          ) : (
            <>
              {(items.filter((item) => !item.checked).length > 0 || groupRefs.filter((ref) => !ref.checked).length > 0) && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    To Pack
                  </h3>
                  <div className="space-y-2">
                    {/* Groups first */}
                    {groupRefs
                      .filter((ref) => !ref.checked)
                      .map((ref) => {
                        const detail = groupDetails.get(ref.id);
                        if (!detail) return null;
                        const { group, items: groupItems } = detail;
                        const isExpanded = expandedGroups.has(ref.id);

                        return (
                          <Card key={ref.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={ref.checked}
                                  onCheckedChange={() => handleToggleGroup(ref.id)}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleGroupExpanded(ref.id)}
                                  className="p-0 h-auto"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-gray-800">{group.name}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {groupItems.length} items
                                    </Badge>
                                    <Badge
                                      variant={group.lastVerified && (Date.now() - group.lastVerified) < 24 * 60 * 60 * 1000 ? "default" : "outline"}
                                      className="text-xs"
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      {getLastVerifiedText(group)}
                                    </Badge>
                                  </div>
                                  {group.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                                  )}
                                  {group.tags && group.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {group.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveGroup(ref.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              {isExpanded && groupItems.length > 0 && (
                                <div className="mt-3 ml-11 pl-4 border-l-2 border-gray-200 space-y-2">
                                  {groupItems.map((item) => (
                                    <div key={item.id} className="flex items-center gap-2 text-sm">
                                      <div className="w-2 h-2 rounded-full bg-gray-300" />
                                      <span className="text-gray-700">{item.name}</span>
                                      {item.consumable && (
                                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                                          Consumable
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}

                    {/* Individual items */}
                    {items
                      .filter((item) => !item.checked)
                      .map((item) => (
                        <Card key={item.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            {editingItemId === item.id ? (
                              <form onSubmit={(e) => handleUpdateItem(e, item.id)} className="space-y-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-item-name-${item.id}`}>Item Name</Label>
                                  <Input
                                    id={`edit-item-name-${item.id}`}
                                    value={editItemName}
                                    onChange={(e) => setEditItemName(e.target.value)}
                                    autoFocus
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Tags</Label>
                                  <TagInput
                                    tags={editItemTags}
                                    onChange={setEditItemTags}
                                    suggestions={availableTags.itemTags}
                                    placeholder="e.g., shelter, sleeping, cooking..."
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`edit-consumable-${item.id}`}
                                    checked={editItemConsumable}
                                    onCheckedChange={(checked) => setEditItemConsumable(checked as boolean)}
                                  />
                                  <Label htmlFor={`edit-consumable-${item.id}`} className="font-normal cursor-pointer">
                                    Consumable/Perishable (needs restocking)
                                  </Label>
                                </div>
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm" className="flex-1">
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEditItem}
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </form>
                            ) : (
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={item.checked}
                                  onCheckedChange={() => handleToggleItem(item.id)}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-800">{item.name}</span>
                                    {item.consumable && (
                                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                                        Consumable
                                      </Badge>
                                    )}
                                  </div>
                                  {item.tags && item.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {item.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleStartEditItem(item)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

              {(items.filter((item) => item.checked).length > 0 || groupRefs.filter((ref) => ref.checked).length > 0) && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Packed
                  </h3>
                  <div className="space-y-2">
                    {/* Groups first */}
                    {groupRefs
                      .filter((ref) => ref.checked)
                      .map((ref) => {
                        const detail = groupDetails.get(ref.id);
                        if (!detail) return null;
                        const { group, items: groupItems } = detail;
                        const isExpanded = expandedGroups.has(ref.id);

                        return (
                          <Card key={ref.id} className="opacity-60 hover:opacity-100 transition-opacity">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={ref.checked}
                                  onCheckedChange={() => handleToggleGroup(ref.id)}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleGroupExpanded(ref.id)}
                                  className="p-0 h-auto"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-gray-600 line-through">{group.name}</span>
                                    <Badge variant="secondary" className="text-xs opacity-60">
                                      {groupItems.length} items
                                    </Badge>
                                    <Badge
                                      variant={group.lastVerified && (Date.now() - group.lastVerified) < 24 * 60 * 60 * 1000 ? "default" : "outline"}
                                      className="text-xs opacity-60"
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      {getLastVerifiedText(group)}
                                    </Badge>
                                  </div>
                                  {group.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                                  )}
                                  {group.tags && group.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {group.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs opacity-60">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveGroup(ref.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              {isExpanded && groupItems.length > 0 && (
                                <div className="mt-3 ml-11 pl-4 border-l-2 border-gray-200 space-y-2">
                                  {groupItems.map((item) => (
                                    <div key={item.id} className="flex items-center gap-2 text-sm opacity-60">
                                      <div className="w-2 h-2 rounded-full bg-gray-300" />
                                      <span className="text-gray-600 line-through">{item.name}</span>
                                      {item.consumable && (
                                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                                          Consumable
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}

                    {/* Individual items */}
                    {items
                      .filter((item) => item.checked)
                      .map((item) => (
                        <Card key={item.id} className="opacity-60 hover:opacity-100 transition-opacity">
                          <CardContent className="p-4">
                            {editingItemId === item.id ? (
                              <form onSubmit={(e) => handleUpdateItem(e, item.id)} className="space-y-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-item-name-${item.id}`}>Item Name</Label>
                                  <Input
                                    id={`edit-item-name-${item.id}`}
                                    value={editItemName}
                                    onChange={(e) => setEditItemName(e.target.value)}
                                    autoFocus
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Tags</Label>
                                  <TagInput
                                    tags={editItemTags}
                                    onChange={setEditItemTags}
                                    suggestions={availableTags.itemTags}
                                    placeholder="e.g., shelter, sleeping, cooking..."
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`edit-consumable-${item.id}`}
                                    checked={editItemConsumable}
                                    onCheckedChange={(checked) => setEditItemConsumable(checked as boolean)}
                                  />
                                  <Label htmlFor={`edit-consumable-${item.id}`} className="font-normal cursor-pointer">
                                    Consumable/Perishable (needs restocking)
                                  </Label>
                                </div>
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm" className="flex-1">
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEditItem}
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </form>
                            ) : (
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={item.checked}
                                  onCheckedChange={() => handleToggleItem(item.id)}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-600 line-through">{item.name}</span>
                                    {item.consumable && (
                                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-600 opacity-60">
                                        Consumable
                                      </Badge>
                                    )}
                                  </div>
                                  {item.tags && item.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {item.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs opacity-60">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleStartEditItem(item)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Verification Modal */}
      {verificationModal && (
        <GroupVerificationModal
          group={verificationModal.group}
          items={verificationModal.items}
          onVerify={handleVerifyAndAdd}
          onSkip={handleSkipVerification}
        />
      )}
    </div>
  );
}
