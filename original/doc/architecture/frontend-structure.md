# Frontend Architecture & Conventions

wApi is built with Next.js 15, utilizing the App Router and React Server Components for a high-performance, SEO-friendly experience.

## 1. Directory Structure (`src/app/`)

- **`/auth/`**: Authentication pages (Login, Register, Reset Password).
- **`/onboarding/`**: Multi-step setup wizard (Email/Mobile verification, Business Info).
- **`/dashboard/`**: The main application interface for workspace owners and agents.
- **`/super-admin/`**: Platform-level management portal.
- **`/api/`**: Next.js Route Handlers for internal and public APIs.

## 2. State Management (Zustand)

We use **Zustand** for lightweight, performant client-side state management.
- `src/store/auth-store.ts`: Manages the current user session, workspace metadata, and permissions.
- `src/store/socket-store.ts`: Handles the WebSocket connection status and event listeners.

## 3. Styling & UI Components

### TailwindCSS
The project uses TailwindCSS with a custom theme. Common patterns are encapsulated in `src/app/globals.css`.

### Component Organization (`src/components/`)
- **`ui/`**: Primitive, reusable UI components (Buttons, Inputs, Modals, Cards).
- **`dashboard/`**: Feature-specific components used within the dashboard.
- **`layouts/`**: Shared layout wrappers (Sidebars, Headers).

## 4. Real-time Synchronization

The frontend maintains a persistent WebSocket connection via `src/hooks/use-socket.ts`.
- **Event Listeners**: Listens for `message:new`, `workspace:wallet_update`, and status changes.
- **Query Invalidation**: Uses `TanStack Query` (React Query) to refresh data when a socket event indicates a change in the backend.

## 5. Form Handling

We use **React Hook Form** combined with **Zod** for schema-based validation. This ensures type-safe forms for both the client and the API.

## 6. Iconography

The project primarily uses **Lucide React** for consistent, modern icons.
