# New Features

## 1. Item Groups

### Overview
Item groups allow you to create reusable collections of items (like "Kitchen Box", "Camping Gear", etc.) that can be quickly added to any packing list.

### How to Use

**Creating a Group:**
1. Click "Manage Groups" button on the home page
2. Click "New Group" to create a group
3. Give it a name (e.g., "Kitchen Box"), optional description, and tags
4. Add items to the group with their names, tags, and consumable flags

**Adding a Group to a List:**
1. Open any packing list
2. Look for the "Add Item Group" card
3. Click "Select a Group"
4. Click on the group you want to add
5. All items from that group will be added to your list

**Managing Groups:**
- Edit group details by clicking the edit icon
- Add/edit/delete items within a group
- Delete entire groups from the Groups page

### Key Features
- **Reusable**: Create once, use on multiple lists
- **Organized**: Keep related items together (all kitchen items in one place)
- **Fast**: Add 10+ items to a list with one click
- **Flexible**: Items can have tags and be marked as consumable
- **Independent**: Items added from groups become regular list items (changes to the group don't affect existing lists)

### Example Use Case
You have a "Kitchen Box" with 15 items (spatula, pots, pans, dish soap, etc.). Instead of adding each item individually to every camping list, you:
1. Create a "Kitchen Box" group once
2. Add all 15 items to the group
3. For each new camping trip, just add the "Kitchen Box" group to your list
4. All 15 items appear instantly

## 2. Consumable/Perishable Items

### Overview
Mark items as consumable/perishable to track which items need restocking after (or before) a trip.

### How to Use

**Marking Items as Consumable:**
- When adding a new item to a list or group, check the "Consumable/Perishable (needs restocking)" checkbox
- When editing an item, toggle the consumable checkbox
- Consumable items are marked with an orange "Consumable" badge

**Examples of Consumable Items:**
- Paper towels
- Toilet paper
- Soap/dish soap
- Sunscreen
- First aid supplies
- Propane canisters
- Matches/lighters
- Food items
- Batteries
- Water purification tablets

### Key Features
- **Visual Indicators**: Orange "Consumable" badge on items
- **Planning**: Reminder to check supplies before a trip
- **Post-Trip**: Know what needs restocking after returning
- **Group Support**: Items in groups can be marked as consumable

### Workflow

**Before a Trip:**
1. Review your packing list
2. Look for items with the "Consumable" badge
3. Check if those items need to be purchased or restocked

**After a Trip:**
1. Check off items as you unpack
2. Note which consumable items were used up
3. Restock those items for the next trip
4. Update your groups if consumables need to be added/removed

## Database Changes

The database has been upgraded to version 3:

### New Schema
```typescript
interface PackingItem {
  // ... existing fields
  groupId?: string;        // Links item to a group
  consumable: boolean;     // Marks item as needing restocking
}

interface ItemGroup {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}
```

### Migration
- Existing users will be automatically migrated to v3
- All existing items will have `consumable: false` by default
- No data loss occurs during migration
- If you encounter issues, see TROUBLESHOOTING.md

## Navigation

- **Home Page** → Access your packing lists
- **Manage Groups** (button on home) → Create and manage item groups
- **Group Detail** (click a group) → Add/edit/delete items in a group
- **List Detail** (click a list) → Add items, groups, or edit existing items

## Tips

1. **Create groups for common scenarios:**
   - Kitchen Box
   - First Aid Kit
   - Camping Gear
   - Water Sports Equipment
   - Winter Gear

2. **Use tags on groups:**
   - Tags help with organization
   - Groups with matching tags will show suggested items

3. **Mark consumables in groups:**
   - When creating a group, mark which items are consumable
   - These will carry over when you add the group to a list

4. **Update groups over time:**
   - Add items you forgot
   - Remove items you no longer use
   - New lists will get the updated group contents
