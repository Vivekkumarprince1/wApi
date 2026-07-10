# ConnectSphere Premium Emerald

A modern Next.js platform for WhatsApp BSP management and automation.

## 📚 Documentation

The project documentation is organized in the [**`doc/`**](./doc/) directory:

- [**Architecture Overview**](./doc/architecture/overview.md)
- [**Design System**](./doc/design/design-system.md)
- [**Onboarding Pipeline**](./doc/onboarding/analysis.md)
- [**Implementation Phases**](./doc/onboarding/implementation-phases.md)

## 🚀 Getting Started

For the split app, run the backend services first:

```bash
cd ../automation-service && npm run dev
cd ../campaign-service && npm run dev
cd ../billing-service && npm run dev
cd ../main-server && npm run dev
```

Then run the frontend development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The frontend proxies `/api/*` to `BACKEND_API_URL` and connects Socket.IO to
`NEXT_PUBLIC_SOCKET_URL`. For local parity with the split backend, use
`BACKEND_API_URL=http://127.0.0.1:5001` and
`NEXT_PUBLIC_SOCKET_URL=http://127.0.0.1:5001`.

## 🛠 Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Database**: MongoDB
- **Services**: Gupshup Partner API
