# Camp List

A local-first progressive web app for managing packing lists for camping, trips, and any adventure where you need to track items.

## Features

- **Local-First Architecture**: All data is stored locally in IndexedDB, so it works completely offline
- **Progressive Web App**: Install on your phone's home screen and use like a native app
- **Offline Capable**: Full functionality even without internet connection
- **Multiple Lists**: Create and manage multiple packing lists for different trips
- **Item Management**: Add, check off, and delete items from your lists
- **Progress Tracking**: Visual progress bar showing how much you've packed
- **Clean UI**: Modern, responsive design built with Tailwind CSS

## Tech Stack

- **React 19** - Modern React with hooks
- **React Router 7** (Declarative Mode) - Client-side routing
- **Vite** - Fast build tool and dev server
- **shadcn/ui** - High-quality UI components built with Radix UI and Tailwind CSS
- **IndexedDB** (via idb library) - Local-first data storage
- **Vite PWA Plugin** - Progressive web app capabilities
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type safety

## Getting Started

### Development

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Using the App

1. **Create a List**: Click "New List" on the home screen and give your list a name
2. **Add Items**: Open a list and type item names to add them to your packing list
3. **Check Off Items**: Click the checkbox next to an item when you've packed it
4. **Track Progress**: Watch the progress bar fill up as you check off items
5. **Edit Lists**: Click "Edit" to change the list name or description
6. **Delete**: Remove individual items or entire lists when you're done

## PWA Installation

### On Mobile (iOS/Android)

1. Open the app in your browser
2. Tap the browser menu (three dots or share button)
3. Look for "Add to Home Screen" or "Install App"
4. Follow the prompts to install

### On Desktop (Chrome/Edge)

1. Look for the install icon in the address bar
2. Click it and follow the prompts

Once installed, the app works completely offline!

## Architecture

### Local-First Design

All data is stored in the browser's IndexedDB, making this a truly local-first application:

- **No server required** for core functionality
- **Instant performance** - no network latency
- **Privacy-first** - your data never leaves your device
- **Offline by default** - works without internet

### Data Storage

The app uses IndexedDB with two object stores:

- `lists`: Stores packing list metadata (name, description, timestamps)
- `items`: Stores individual packing items (name, checked status, list association)

### Service Worker

The Vite PWA plugin automatically generates a service worker that:

- Caches all app assets for offline use
- Provides a fast, app-like experience
- Updates automatically when new versions are deployed

## Future Enhancements

Potential features for future versions:

- Cloud sync with conflict resolution
- Share lists with other users
- Templates for common trip types
- Item categories and organization
- Search and filter
- Export/import lists
- Dark mode

## License

MIT
