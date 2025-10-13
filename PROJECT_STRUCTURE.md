# Camp List - Project Structure

## Overview

This is a React + Vite application using React Router 7 in declarative mode with shadcn/ui components for styling.

## Directory Structure

```
camplist/
├── public/                     # Static assets
│   ├── favicon.ico
│   ├── icon-192.png           # PWA icon
│   └── icon-512.png           # PWA icon
├── src/
│   ├── components/            # React components
│   │   └── ui/               # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── checkbox.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── progress.tsx
│   │       └── textarea.tsx
│   ├── lib/                  # Utility libraries
│   │   ├── db.ts            # IndexedDB operations
│   │   └── utils.ts         # Utility functions
│   ├── pages/               # Page components
│   │   ├── Home.tsx         # List management page
│   │   └── ListDetail.tsx   # Item management page
│   ├── App.tsx              # Root component with routing
│   ├── main.tsx             # Application entry point
│   ├── index.css            # Global styles with Tailwind
│   └── vite-env.d.ts        # Vite type definitions
├── index.html               # HTML template
├── vite.config.ts           # Vite configuration with PWA plugin
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.js        # PostCSS configuration
├── components.json          # shadcn/ui configuration
├── tsconfig.json            # TypeScript root config
├── tsconfig.app.json        # TypeScript app config
├── tsconfig.node.json       # TypeScript node config
└── package.json             # Project dependencies

## Key Technologies

### React Router 7 (Declarative Mode)

The app uses React Router 7's declarative routing pattern:

```typescript
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/list/:id" element={<ListDetail />} />
  </Routes>
</BrowserRouter>
```

### shadcn/ui Components

All UI components are from shadcn/ui, providing:
- Consistent design system
- Accessibility out of the box
- Full customization with Tailwind CSS
- Type-safe components

### IndexedDB Storage

Local-first data storage with two object stores:

**lists store:**
- id: string (primary key)
- name: string
- description?: string
- createdAt: number
- updatedAt: number
- Index: by-date (on createdAt)

**items store:**
- id: string (primary key)
- listId: string (foreign key to lists)
- name: string
- checked: boolean
- createdAt: number
- updatedAt: number
- Indexes: by-list (on listId), by-date (on createdAt)

### PWA Configuration

The Vite PWA plugin automatically generates:
- Service worker for offline caching
- Web app manifest for installation
- Automatic asset precaching
- Auto-update functionality

## Data Flow

1. **Home Page** (`src/pages/Home.tsx`)
   - Loads all lists from IndexedDB
   - Displays list cards with metadata
   - Provides create/delete functionality
   - Links to individual list detail pages

2. **List Detail Page** (`src/pages/ListDetail.tsx`)
   - Loads specific list and its items from IndexedDB
   - Displays items grouped by packed/unpacked status
   - Provides item CRUD operations
   - Shows progress bar based on completion

3. **Database Operations** (`src/lib/db.ts`)
   - Singleton database connection
   - Type-safe CRUD operations
   - Automatic timestamp management
   - Cascade delete for lists and items

## Adding New Features

### Adding a new shadcn/ui component

Components are already set up. To add more:

```bash
npx shadcn@latest add [component-name]
```

Or manually create in `src/components/ui/`

### Adding a new page

1. Create component in `src/pages/`
2. Add route to `src/App.tsx`:

```typescript
<Route path="/your-path" element={<YourPage />} />
```

### Adding new database operations

1. Add types to `src/lib/db.ts`
2. Create CRUD functions following existing patterns
3. Import and use in page components

## Development Workflow

```bash
# Install dependencies
npm install

# Start dev server (with HMR)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Building and Deployment

The build process:
1. TypeScript compilation (`tsc -b`)
2. Vite bundle optimization
3. PWA asset generation
4. Service worker creation

Output directory: `dist/`

Deploy the `dist/` folder to any static hosting service:
- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages
- Any web server

No server-side code required - it's a fully static PWA!
