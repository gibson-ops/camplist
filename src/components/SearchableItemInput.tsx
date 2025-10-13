import { useState, useEffect } from "react";
import { Plus, Search } from "lucide-react";
import { searchItems, getAllTags, type ItemSearchResult } from "@/lib/db";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { TagInput } from "./TagInput";

interface SearchableItemInputProps {
  existingItems: string[];
  onAddExistingItem: (name: string, tags: string[], consumable: boolean) => void;
  onAddNewItem: (name: string, tags: string[], consumable: boolean) => void;
}

export function SearchableItemInput({
  existingItems,
  onAddExistingItem,
  onAddNewItem,
}: SearchableItemInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ItemSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemTags, setNewItemTags] = useState<string[]>([]);
  const [newItemConsumable, setNewItemConsumable] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    async function loadTags() {
      const tags = await getAllTags();
      setAvailableTags(tags.itemTags);
    }
    loadTags();
  }, []);

  useEffect(() => {
    async function performSearch() {
      if (!searchQuery || searchQuery.trim().length === 0) {
        setSearchResults([]);
        setIsSearching(false);
        setShowNewItemForm(false);
        return;
      }

      setIsSearching(true);
      const results = await searchItems(searchQuery);

      // Filter out items already in this list
      const filteredResults = results.filter(
        result => !existingItems.some(
          item => item.toLowerCase() === result.name.toLowerCase()
        )
      );

      setSearchResults(filteredResults);
      setIsSearching(false);
    }

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, existingItems]);

  const handleAddExistingItem = (result: ItemSearchResult) => {
    onAddExistingItem(result.name, result.tags, result.consumable);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleCreateNewItem = () => {
    if (!searchQuery.trim()) return;

    onAddNewItem(searchQuery.trim(), newItemTags, newItemConsumable);
    setSearchQuery("");
    setNewItemTags([]);
    setNewItemConsumable(false);
    setShowNewItemForm(false);
    setSearchResults([]);
  };

  const handleShowNewItemForm = () => {
    setShowNewItemForm(true);
  };

  return (
    <div className="space-y-2">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for an item or add new..."
          className="pl-10"
        />
      </div>

      {/* Search Results */}
      {searchQuery && searchResults.length > 0 && !showNewItemForm && (
        <Card>
          <CardContent className="p-2">
            <div className="space-y-1">
              {searchResults.slice(0, 5).map((result) => (
                <div
                  key={result.name}
                  className="flex items-center justify-between p-3 hover:bg-accent rounded-lg cursor-pointer"
                  onClick={() => handleAddExistingItem(result)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.name}</span>
                      {result.consumable && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                          C
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        Used {result.usageCount}x
                      </Badge>
                    </div>
                    {result.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {result.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{result.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results - Show "Create New" Option */}
      {searchQuery && searchResults.length === 0 && !isSearching && !showNewItemForm && (
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No existing items found for "{searchQuery}"
              </p>
              <Button onClick={handleShowNewItemForm} variant="outline" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Create New Item
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Item Form */}
      {showNewItemForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., Tent, Sleeping bag..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (optional)</Label>
              <TagInput
                tags={newItemTags}
                onChange={setNewItemTags}
                suggestions={availableTags}
                placeholder="e.g., shelter, sleeping, cooking..."
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="new-item-consumable"
                checked={newItemConsumable}
                onCheckedChange={(checked) => setNewItemConsumable(checked as boolean)}
              />
              <Label htmlFor="new-item-consumable" className="font-normal cursor-pointer">
                Consumable/Perishable (needs restocking)
              </Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateNewItem} className="flex-1">
                <Plus className="mr-2 h-4 w-4" />
                Add New Item
              </Button>
              <Button
                onClick={() => {
                  setShowNewItemForm(false);
                  setNewItemTags([]);
                  setNewItemConsumable(false);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
