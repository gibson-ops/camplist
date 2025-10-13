# Tagging & Suggestion System

## Overview

The tagging system allows users to add tags to both lists and items, enabling intelligent suggestions for packing items based on similar lists.

## How It Works

### List Tags

When creating or editing a list, you can add tags that describe the type of trip or activity:
- **camping** - for camping trips
- **multi-day** - for trips lasting multiple days
- **water-sports** - for activities involving water
- **hiking** - for hiking adventures
- **winter** - for cold weather trips
- etc.

### Item Tags

When adding items to a list, you can optionally tag them with categories:
- **shelter** - tents, tarps, etc.
- **sleeping** - sleeping bags, pads, pillows
- **cooking** - stoves, pots, utensils
- **water** - bottles, filters, hydration systems
- **clothing** - jackets, pants, base layers
- **safety** - first aid, emergency gear
- etc.

### Smart Suggestions

The suggestion engine analyzes your list's tags and:

1. **Finds Similar Lists**: Looks for other lists that share tags with your current list
2. **Identifies Common Items**: Finds items that frequently appear in those similar lists
3. **Calculates Match Score**: Scores each item based on:
   - How well the list tags match (higher score = more shared tags)
   - How frequently the item appears across matching lists
4. **Displays Suggestions**: Shows the most relevant items you might want to add

### Example Use Case

**Scenario**: You're creating a new list called "Weekend Paddle Boarding & Camping"

**Tags you add**: `camping`, `multi-day`, `water-sports`

**What happens**:
- System finds all lists with `camping`, `multi-day`, or `water-sports` tags
- Calculates which items appear most frequently in those lists
- Prioritizes items from lists that match more of your tags
- Suggests items like:
  - Paddle board (from water-sports lists)
  - Life jacket (from water-sports lists)
  - Tent (from camping lists)
  - Sleeping bag (from camping lists)
  - Tarp (from camping lists)
  - Cooking supplies (from multi-day + camping lists)

## Technical Implementation

### Database Schema (v2)

**PackingList**:
```typescript
{
  id: string;
  name: string;
  description?: string;
  tags: string[];  // NEW
  createdAt: number;
  updatedAt: number;
}
```

**PackingItem**:
```typescript
{
  id: string;
  listId: string;
  name: string;
  checked: boolean;
  tags: string[];  // NEW
  createdAt: number;
  updatedAt: number;
}
```

### Suggestion Algorithm

The `getSuggestedItems()` function in `src/lib/db.ts`:

1. **Filter Lists**: Find lists with overlapping tags
2. **Calculate Match Score**: `sharedTags.length / currentListTags.length`
3. **Aggregate Items**: Collect all items from matching lists
4. **Track Frequency**: Count how many times each item name appears
5. **Sort by Relevance**:
   - Primary: Match score (lists with more shared tags = higher priority)
   - Secondary: Frequency (items that appear more often = higher priority)

### Components

**TagInput** (`src/components/TagInput.tsx`):
- Autocomplete tag input with suggestions
- Add/remove tags with chips
- Keyboard navigation (Enter to add, Backspace to remove)
- Click outside to close suggestions

**ItemSuggestions** (`src/components/ItemSuggestions.tsx`):
- Displays suggested items based on list tags
- Shows match score percentage
- One-click add with tags preserved
- Filters out items already in the list

## User Interface

### Home Page (List Management)
- **Tag Input**: When creating/editing lists, add tags with autocomplete
- **Tag Display**: Lists show their tags as colored badges
- **Tag Suggestions**: Dropdown shows existing list tags as you type

### List Detail Page (Item Management)
- **List Tags**: Displayed below list name/description
- **Edit Tags**: Click edit button to modify list tags
- **Item Tags**: Optional tags when adding items
- **Tag Suggestions**: Autocomplete from existing item tags
- **Suggestion Card**:
  - Appears when list has tags
  - Shows top 10 most relevant suggestions
  - Displays match score and item tags
  - One-click add button
- **Item Display**: Tags shown below item names

## Benefits

1. **Faster Packing**: Don't have to remember everything - the system suggests items
2. **Learning from Experience**: Your past lists help you pack for new trips
3. **Consistency**: Similar trips end up with similar items
4. **Discovery**: Might discover items you hadn't thought of
5. **Organization**: Tags help categorize and understand your items

## Future Enhancements

Potential improvements:
- **Tag Categories**: Group tags into types (activity, duration, season, etc.)
- **Tag Synonyms**: "camping" and "backpacking" could be related
- **Negative Tags**: Exclude certain suggestions based on anti-patterns
- **Seasonal Suggestions**: Weight suggestions by time of year
- **Weather Integration**: Suggest items based on forecast
- **Community Tags**: Learn from popular tagging patterns
- **AI Suggestions**: Use ML to improve suggestion accuracy over time
