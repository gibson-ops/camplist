import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, Trash2, List, Package } from "lucide-react";
import { getAllLists, createList, deleteList, getAllTags, type PackingList } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/TagInput";

export default function Home() {
  const [lists, setLists] = useState<PackingList[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [newListTags, setNewListTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    loadLists();
    loadTags();
  }, []);

  async function loadLists() {
    const allLists = await getAllLists();
    setLists(allLists.sort((a, b) => b.createdAt - a.createdAt));
  }

  async function loadTags() {
    const tags = await getAllTags();
    setAvailableTags(tags.listTags);
  }

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;

    await createList({
      name: newListName,
      description: newListDescription || undefined,
      tags: newListTags,
    });

    setNewListName("");
    setNewListDescription("");
    setNewListTags([]);
    setIsCreating(false);
    await loadLists();
    await loadTags();
  }

  async function handleDeleteList(id: string) {
    if (confirm("Are you sure you want to delete this list and all its items?")) {
      await deleteList(id);
      await loadLists();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Camp List</h1>
              <p className="text-gray-600">Your packing lists for every adventure</p>
            </div>
            <Link to="/groups">
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Manage Groups
              </Button>
            </Link>
          </div>
        </header>

        <div className="mb-6">
          {!isCreating ? (
            <Button
              onClick={() => setIsCreating(true)}
              className="w-full"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              New List
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Create New List</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateList} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="listName">List Name *</Label>
                    <Input
                      id="listName"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="e.g., Weekend Camping Trip"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="listDescription">Description (optional)</Label>
                    <Textarea
                      id="listDescription"
                      value={newListDescription}
                      onChange={(e) => setNewListDescription(e.target.value)}
                      placeholder="Add notes about this trip..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <TagInput
                      tags={newListTags}
                      onChange={setNewListTags}
                      suggestions={availableTags}
                      placeholder="e.g., camping, multi-day, water-sports..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Tags help suggest items from similar lists
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" className="flex-1">
                      Create List
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreating(false);
                        setNewListName("");
                        setNewListDescription("");
                        setNewListTags([]);
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
        </div>

        <div className="space-y-4">
          {lists.length === 0 ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <List className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">No lists yet</CardTitle>
                <CardDescription>Create your first packing list to get started!</CardDescription>
              </CardContent>
            </Card>
          ) : (
            lists.map((list) => (
              <Card key={list.id} className="hover:shadow-lg transition-shadow">
                <Link to={`/list/${list.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl">{list.name}</CardTitle>
                        {list.description && (
                          <CardDescription className="mt-1">{list.description}</CardDescription>
                        )}
                        {list.tags && list.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {list.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Created {new Date(list.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteList(list.id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Link>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
