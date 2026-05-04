# Project Architecture Overview

This document provides a high-level overview of the wApi Next.js architecture.

## Core Technologies

- **Frontend/Backend**: Next.js (App Router)
- **Language**: TypeScript
- **State Management**: Zustand / React Context
- **Styling**: TailwindCSS
- **Database**: MongoDB (via Mongoose)
- **Cache**: Redis

## Directory Structure

- `src/dashboard/`: Next.js App Router (Pages and API Routes).
- `src/components/`: Reusable UI components.
- `src/lib/`: Core logic, models, and services.
  - `src/lib/models/`: Mongoose schemas.
  - `src/lib/services/`: Business logic and external API integrations.
- `src/hooks/`: Custom React hooks.
- `src/store/`: Zustand state stores.
- `src/config/`: Configuration management.

## Key Services

- **Gupshup Partner Service**: Handles integration with Gupshup for WhatsApp BSP onboarding.
- **Auth Service**: Manages user authentication and session steering.
- **Sync Services**: Background synchronization for templates, profiles, and health status.

## Networking

The project uses a proxy-based approach for some external requests, defined in `src/proxy.ts`. API routes are used for most backend operations.
