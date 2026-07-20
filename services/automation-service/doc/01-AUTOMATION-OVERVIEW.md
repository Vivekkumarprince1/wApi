# Automation Service — Overview

This document set describes the `automation-service` (workflow / automation engine) used by wApi.
It covers architecture, runtime components, public and internal APIs, data models, controllers, services and deployment/run instructions.

Purpose
- Provide automation and workflow capabilities for workspaces: AI intent detection, answer-bot rules, interactive lists, and WhatsApp form handling.
- Act as both a management API (dashboard CRUD) and an execution engine (internal triggers, scheduled rules).

Key Characteristics
- Language: TypeScript (Node.js / Express)
- Primary datastore: MongoDB
- Queue: BullMQ (Redis-backed)
- Auth: Gateway headers + JWT for user APIs; `x-internal-service-secret` for internal endpoints
- API docs: Swagger UI mounted at `/docs`

Quick Links
- Code: `src/`
- Routes: `src/routes/`
- Controllers: `src/controllers/`
- Services: `src/services/`
- Models: `src/models/`
- OpenAPI generator: `src/openapi.ts`

Recommended reading order
1. 02-ARCHITECTURE.md — system architecture and runtime components
2. 03-API-REFERENCE.md — enumerates endpoints and security model
3. 04-CONTROLLERS.md — controllers and their responsibilities
4. 05-SERVICES.md — core services, queues and rules execution
5. 06-MODELS.md — data models and important fields
6. 07-DEPLOYMENT-AND-ENV.md — env vars, running, and troubleshooting
