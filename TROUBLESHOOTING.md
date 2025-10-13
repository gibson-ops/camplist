# Troubleshooting Guide

## Database Migration Issues

### Error: "transaction.objectStore is not a function"

This error has been fixed in the latest code. If you're still seeing it:

**Solution 1: Clear Browser Storage** (Recommended for development)

Open your browser's developer console and run:
```javascript
// Clear IndexedDB
indexedDB.deleteDatabase('camplist-db');

// Clear localStorage
localStorage.clear();

// Clear sessionStorage
sessionStorage.clear();

// Then refresh the page
location.reload();
```

**Solution 2: Manual Clear via DevTools**

1. Open Chrome/Edge DevTools (F12)
2. Go to **Application** tab
3. Under **Storage** → **IndexedDB**
4. Right-click `camplist-db` and select **Delete database**
5. Refresh the page

**Solution 3: Clear All Site Data**

1. Open Chrome/Edge DevTools (F12)
2. Go to **Application** tab
3. Click **Clear site data** button
4. Refresh the page

### After Clearing Database

The app will automatically:
1. Create a new database with version 3
2. Set up the schema with tags, groups, and consumable flag support
3. Be ready to use immediately

You won't lose any data because the old database structure is being replaced with the new one.

## Development Database Reset

If you want to reset your database during development, you can add this function to your browser console:

```javascript
async function resetDatabase() {
  // Close any open connections
  if (window.indexedDB) {
    await indexedDB.deleteDatabase('camplist-db');
  }
  console.log('Database deleted. Refreshing...');
  location.reload();
}

// Run it
resetDatabase();
```

## Common Issues

### Issue: Tags not showing up

**Check:**
- Are you on database version 3? (Open DevTools → Application → IndexedDB → camplist-db)
- If version 1 or 2, clear the database and refresh

### Issue: Suggestions not appearing

**Check:**
- Does your list have tags?
- Do you have other lists with similar tags?
- Do those lists have items?

Suggestions only appear when:
1. The current list has at least one tag
2. There are other lists that share at least one tag
3. Those other lists have items

### Issue: Can't create lists or items

**Try:**
1. Clear browser console errors
2. Check if IndexedDB is available: `console.log(window.indexedDB)`
3. Clear database and refresh
4. Try in incognito mode to rule out extensions

## Production Database

In production, the migration should work automatically:
- Users on v1 will be migrated to v3 when they first load the new version
- v1→v2: Empty `tags` arrays will be added to all existing lists and items
- v2→v3: `consumable` flag (defaulting to false) and `groupId` field will be added to items, and the groups store will be created
- No data loss will occur

## Need More Help?

If issues persist:
1. Check the browser console for detailed error messages
2. Note your browser and version
3. Check if IndexedDB is enabled in your browser settings
