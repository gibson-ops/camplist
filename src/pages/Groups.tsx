import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Plus, Trash2, Package } from "lucide-react";
import { getAllGroups, createGroup, deleteGroup, getAllTags, type ItemGroup } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/TagInput";

export default function Groups() {
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupTags, setNewGroupTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    loadGroups();
    loadTags();
  }, []);

  async function loadGroups() {
    const allGroups = await getAllGroups();
    setGroups(allGroups.sort((a, b) => b.createdAt - a.createdAt));
  }

  async function loadTags() {
    const tags = await getAllTags();
    setAvailableTags([...tags.listTags, ...tags.itemTags]);
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    await createGroup({
      name: newGroupName,
      description: newGroupDescription || undefined,
      tags: newGroupTags,
    });

    setNewGroupName("");
    setNewGroupDescription("");
    setNewGroupTags([]);
    setIsCreating(false);
    await loadGroups();
    await loadTags();
  }

  async function handleDeleteGroup(id: string) {
    if (confirm("Are you sure you want to delete this group?")) {
      await deleteGroup(id);
      await loadGroups();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Lists
          </Button>
        </Link>

        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Item Groups</h1>
          <p className="text-gray-600">Manage reusable groups like "Kitchen Box", "Camping Gear", etc.</p>
        </header>

        <div className="mb-6">
          {!isCreating ? (
            <Button
              onClick={() => setIsCreating(true)}
              className="w-full"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              New Group
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Create New Group</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateGroup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="groupName">Group Name *</Label>
                    <Input
                      id="groupName"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g., Kitchen Box, Camping Gear..."
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupDescription">Description (optional)</Label>
                    <Textarea
                      id="groupDescription"
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      placeholder="Describe what's in this group..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <TagInput
                      tags={newGroupTags}
                      onChange={setNewGroupTags}
                      suggestions={availableTags}
                      placeholder="e.g., kitchen, cooking, camping..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" className="flex-1">
                      Create Group
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreating(false);
                        setNewGroupName("");
                        setNewGroupDescription("");
                        setNewGroupTags([]);
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
          {groups.length === 0 ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">No groups yet</CardTitle>
                <CardDescription>Create your first item group to get started!</CardDescription>
              </CardContent>
            </Card>
          ) : (
            groups.map((group) => (
              <Card key={group.id} className="hover:shadow-lg transition-shadow">
                <Link to={`/group/${group.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl">{group.name}</CardTitle>
                        {group.description && (
                          <CardDescription className="mt-1">{group.description}</CardDescription>
                        )}
                        {group.tags && group.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {group.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Created {new Date(group.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteGroup(group.id);
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
