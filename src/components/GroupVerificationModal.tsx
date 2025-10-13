import { useState } from "react";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ItemGroup, PackingItem } from "@/lib/db";

interface GroupVerificationModalProps {
  group: ItemGroup;
  items: PackingItem[];
  onVerify: () => void;
  onSkip: () => void;
}

export function GroupVerificationModal({ group, items, onVerify, onSkip }: GroupVerificationModalProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const consumables = items.filter(item => item.consumable);
  const regularItems = items.filter(item => !item.consumable);

  const allChecked = checkedItems.size === items.length;
  const consumablesChecked = consumables.every(item => checkedItems.has(item.id));

  const toggleItem = (itemId: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleVerify = () => {
    onVerify();
  };

  const getLastVerifiedText = () => {
    if (!group.lastVerified) {
      return "Never verified";
    }
    const now = Date.now();
    const diff = now - group.lastVerified;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "Last verified today";
    } else if (days === 1) {
      return "Last verified yesterday";
    } else if (days < 7) {
      return `Last verified ${days} days ago`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `Last verified ${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      const months = Math.floor(days / 30);
      return `Last verified ${months} month${months > 1 ? 's' : ''} ago`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl">Verify {group.name}</CardTitle>
              <CardDescription className="mt-1">
                {getLastVerifiedText()}
              </CardDescription>
              {consumables.length > 0 && (
                <div className="mt-2">
                  <Badge variant={consumablesChecked ? "default" : "destructive"} className="text-xs">
                    {consumablesChecked ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        All consumables checked
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Check consumables first
                      </>
                    )}
                  </Badge>
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="overflow-y-auto flex-1 pt-4">
          <div className="space-y-6">
            {/* Consumables Section */}
            {consumables.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-orange-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Consumables (Check & Restock)
                </h3>
                <div className="space-y-2">
                  {consumables.map(item => (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        checkedItems.has(item.id)
                          ? 'bg-green-50 border-green-300'
                          : 'bg-white hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            checkedItems.has(item.id)
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {checkedItems.has(item.id) && (
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <span className={checkedItems.has(item.id) ? 'font-medium' : ''}>
                          {item.name}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs text-orange-600 border-orange-600">
                          Consumable
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Items Section */}
            {regularItems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Other Items
                </h3>
                <div className="space-y-2">
                  {regularItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        checkedItems.has(item.id)
                          ? 'bg-green-50 border-green-300'
                          : 'bg-white hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            checkedItems.has(item.id)
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {checkedItems.has(item.id) && (
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <span className={checkedItems.has(item.id) ? 'font-medium' : ''}>
                          {item.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <div className="border-t p-4 flex gap-3">
          <Button
            onClick={onSkip}
            variant="outline"
            className="flex-1"
          >
            Skip Verification
          </Button>
          <Button
            onClick={handleVerify}
            className="flex-1"
            disabled={!allChecked}
          >
            {allChecked ? 'Verify & Add to List' : `Check All Items (${checkedItems.size}/${items.length})`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
