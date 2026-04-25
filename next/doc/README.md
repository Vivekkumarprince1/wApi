# wApi Project Documentation

Welcome to the central documentation repository for the wApi project. This directory contains structured documentation for architecture, design, and onboarding pipelines.

## Directory Structure

- [**`architecture/`**](./architecture/): Core system architecture, data models, and technical overviews.
- [**`features/`**](./features/): User-facing modules, frontend components, and feature mapping.
- [**`services/`**](./services/): Backend services, business logic engines, and third-party integrations.
- [**`onboarding/`**](./onboarding/): Comprehensive documentation for the user onboarding and BSP (Gupshup) pipeline.
- [**`design/`**](./design/): Design system, tokens, and UI/UX principles.
- [**`guides/`**](./guides/): Development guides, agent rules, and setup instructions.

## Quick Links

### 🏗 Architecture & Backend
- [Architecture Overview](./architecture/overview.md): Technical stack and project structure.
- [Data Models](./architecture/data-models.md): Database schema and Mongoose models.
- [Detailed Models](./architecture/models-detailed.md): Deep-dive into fields for User, Workspace, Contact, etc.
- [API Routes](./architecture/api-routes.md): Comprehensive list of all REST endpoints.
- [Authentication Flow](./architecture/auth-flow.md): User lifecycle and onboarding steering.
- [Frontend Architecture](./architecture/frontend-structure.md): State management, UI structure, and conventions.
- [Background Workers](./architecture/background-workers.md): BullMQ queues and asynchronous tasks.
- [Core Services](./services/overview.md): Mapping of backend logic engines and files.
- [Core Functions](./services/core-functions.md): Catalog of key functions in the service layer.
- [Messaging Logic](./services/messaging-flow.md): End-to-end inbound and outbound flow.
- [Automation Engine](./services/automation-engine.md): Logic for workflow execution and safety.
- [Billing System](./services/billing-system.md): Wallet management, ledger, and transactions.

### ✨ Features & Functionality
- [Feature Overview](./features/overview.md): Mapping of product features to code.

### 🎨 Design & UI
- [Design System Overview](./design/design-system.md): Visual theme, color palette, and typography.

### 🚀 Onboarding Pipeline
- [Current State Analysis](./onboarding/analysis.md): What's working and what's missing.
- [Implementation Phases](./onboarding/implementation-phases.md): Detailed breakdown of the completion plan.
- [State Machine](./onboarding/state-machine.md): Visual logic for the onboarding flow.

### 🛠 Development & Setup
- [Setup Guide](./guides/setup-guide.md): Local development environment setup.
- [Env Variables](./guides/environment-variables.md): Reference for all configuration keys.
- [Deployment Guide](./guides/deployment.md): Steps for production release.
- [Agent Rules](./guides/agent-rules.md): Instructions for AI coding assistants.
- [API Sequence](./onboarding/api-sequence.md): Gupshup partner API integration steps.
- [Execution Order](./onboarding/execution-order.md): Prioritized task list.

### 🛠 Development Guides
- [Agent Rules](./guides/agent-rules.md): Instructions for AI coding assistants.
- [Claude Instructions](./guides/claude-instructions.md): Specific guidelines for Claude.

---

*Note: This documentation is a living document and should be updated as the project evolves.*
