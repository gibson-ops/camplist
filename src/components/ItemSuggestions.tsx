import { Plus, Lightbulb } from "lucide-react";
import { type ItemSuggestion } from "@/lib/db";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface ItemSuggestionsProps {
  suggestions: ItemSuggestion[];
  existingItems: string[];
  onAddItem: (name: string, tags: string[]) => void;
}

export function ItemSuggestions({ suggestions, existingItems, onAddItem }: ItemSuggestionsProps) {
  // Filter out items that already exist in the list
  const availableSuggestions = suggestions.filter(
    s => !existingItems.some(item => item.toLowerCase() === s.name.toLowerCase())
  );

  if (availableSuggestions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Suggested Items</CardTitle>
        </div>
        <CardDescription>
          Based on your list's tags and packing patterns, here are recommended items
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {availableSuggestions.slice(0, 3).map((suggestion) => (
            <div
              key={suggestion.name}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1">
                <div className="font-medium">{suggestion.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex flex-wrap gap-1">
                    {suggestion.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {suggestion.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{suggestion.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                  {suggestion.coOccurrenceScore && suggestion.coOccurrenceScore > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      • Often packed together ({Math.round(suggestion.coOccurrenceScore * 100)}%)
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      • {Math.round(suggestion.matchScore * 100)}% tag match
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAddItem(suggestion.name, suggestion.tags)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
