import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Plus, Trash2, Edit2, Package, CheckCircle2 } from "lucide-react";
import {
  getGroup,
  getItemsForGroup,
  createGroupItem,
  deleteItem,
  updateItem,
  updateGroup,
  getAllTags,
  verifyGroup,
  type ItemGroup,
  type PackingItem,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TagInput } from "@/components/TagInput";

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState<ItemGroup | null>(null);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemTags, setNewItemTags] = useState<string[]>([]);
  const [newItemConsumable, setNewItemConsumable] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemTags, setEditItemTags] = useState<string[]>([]);
  const [editItemConsumable, setEditItemConsumable] = useState(false);
  const [availableTags, setAvailableTags] = useState<{ listTags: string[]; itemTags: string[] }>({ listTags: [], itemTags: [] });

  useEffect(() => {
    if (id) {
      loadGroup();
      loadItems();
      loadTags();
    }
  }, [id]);

  async function loadGroup() {
    if (!id) return;
    const loadedGroup = await getGroup(id);
    setGroup(loadedGroup || null);
    if (loadedGroup) {
      setEditName(loadedGroup.name);
      setEditDescription(loadedGroup.description || "");
      setEditTags(loadedGroup.tags || []);
    }
  }

  async function loadItems() {
    if (!id) return;
    const loadedItems = await getItemsForGroup(id);
    setItems(loadedItems.sort((a, b) => a.createdAt - b.createdAt));
  }

  async function loadTags() {
    const tags = await getAllTags();
    setAvailableTags(tags);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !newItemName.trim()) return;

    await createGroupItem(id, {
      name: newItemName,
      tags: newItemTags,
      consumable: newItemConsumable,
      groupId: id,
    });

    setNewItemName("");
    setNewItemTags([]);
    setNewItemConsumable(false);
    await loadItems();
    await loadTags();
  }

  async function handleDeleteItem(itemId: string) {
    await deleteItem(itemId);
    await loadItems();
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

  async function handleUpdateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !editName.trim()) return;

    await updateGroup(id, {
      name: editName,
      description: editDescription || undefined,
      tags: editTags,
    });

    setIsEditingGroup(false);
    await loadGroup();
    await loadTags();
  }

  async function handleVerifyGroup() {
    if (!id) return;
    await verifyGroup(id);
    await loadGroup();
  }

  const getLastVerifiedText = () => {
    if (!group?.lastVerified) {
      return "Never verified";
    }
    const now = Date.now();
    const diff = now - group.lastVerified;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "Verified today";
    } else if (days === 1) {
      return "Verified yesterday";
    } else if (days < 7) {
      return `Verified ${days} days ago`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `Verified ${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      const months = Math.floor(days / 30);
      return `Verified ${months} month${months > 1 ? 's' : ''} ago`;
    }
  };

  if (!group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Group not found</p>
            <Link to="/groups">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Groups
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/groups">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Groups
          </Button>
        </Link>

        {!isEditingGroup ? (
          <div className="mb-6">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-800">{group.name}</h1>
                {group.description && <p className="text-gray-600 mt-1">{group.description}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {group.tags && group.tags.length > 0 && (
                    <>
                      {group.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </>
                  )}
                  <Badge
                    variant={group.lastVerified && (Date.now() - group.lastVerified) < 24 * 60 * 60 * 1000 ? "default" : "outline"}
                    className="text-xs"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {getLastVerifiedText()}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyGroup}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verify Now
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditingGroup(true)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Edit Group</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateGroup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">Group Name *</Label>
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
                    suggestions={[...availableTags.listTags, ...availableTags.itemTags]}
                    placeholder="e.g., kitchen, cooking, camping..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="flex-1">
                    Save Changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingGroup(false);
                      setEditName(group.name);
                      setEditDescription(group.description || "");
                      setEditTags(group.tags || []);
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

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Add Item to Group</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="itemName">Item Name *</Label>
                <Input
                  id="itemName"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g., Spatula, Cooking pot..."
                />
              </div>
              <div className="space-y-2">
                <Label>Item Tags (optional)</Label>
                <TagInput
                  tags={newItemTags}
                  onChange={setNewItemTags}
                  suggestions={availableTags.itemTags}
                  placeholder="e.g., utensils, cookware..."
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="consumable"
                  checked={newItemConsumable}
                  onCheckedChange={(checked) => setNewItemConsumable(checked as boolean)}
                />
                <Label htmlFor="consumable" className="font-normal cursor-pointer">
                  Consumable/Perishable (needs restocking)
                </Label>
              </div>
              <Button type="submit" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {items.length === 0 ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">No items yet</CardTitle>
                <CardDescription>Add your first item to this group!</CardDescription>
              </CardContent>
            </Card>
          ) : (
            items.map((item) => (
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
                          placeholder="e.g., utensils, cookware..."
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
