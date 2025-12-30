# wApi - WhatsApp Business SaaS Platform

A comprehensive WhatsApp Business API platform built with modern technologies, featuring a robust backend and intuitive frontend for managing business communications, automations, and customer relationships.

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Environment Variables](#environment-variables)
- [Features](#features)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

wApi is a complete WhatsApp Business SaaS solution that enables businesses to:
- Manage customer communications and conversations
- Create and automate marketing campaigns
- Build interactive forms and workflows
- Manage product catalogs and checkouts
- Handle sales pipelines and CRM functions
- Track analytics and performance metrics
- Integrate with Instagram and other platforms
- Manage templates and messaging automation

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Cache**: Redis with ioredis
- **Queue**: BullMQ for job processing
- **Authentication**: JWT & OAuth2 (Google)
- **Payment**: Razorpay
- **Real-time**: Socket.io
- **Task Scheduling**: node-cron

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components + shadcn/ui
- **State Management**: React Context API
- **Real-time**: Socket.io Client
- **HTTP Client**: Axios
- **Authentication**: JWT with cookies
- **Animations**: Framer Motion

## 📁 Project Structure

```
wApi/
├── server/                 # Node.js/Express Backend
│   ├── src/
│   │   ├── controllers/   # Request handlers
│   │   ├── models/        # MongoDB schemas
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── middlewares/   # Custom middleware
│   │   ├── config/        # Configuration
│   │   └── utils/         # Utility functions
│   ├── seeds/             # Database seeders
│   └── package.json
│
└── client/                 # Next.js Frontend
    ├── app/               # App Router pages
    │   ├── auth/         # Authentication pages
    │   ├── dashboard/    # Dashboard & features
    │   ├── automation/   # Automation flows
    │   ├── campaign/     # Campaign management
    │   ├── commerce/     # E-commerce features
    │   ├── sales-crm/    # CRM features
    │   ├── admin/        # Admin panel
    │   └── onboarding/   # User onboarding
    ├── components/        # React components
    ├── lib/               # Utility functions & hooks
    ├── public/            # Static assets
    └── package.json
```

## 📦 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB (local or Atlas)
- Redis (local or cloud)
- Git

## 🚀 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd wApi
```

### 2. Backend Setup

```bash
cd server
npm install
```

### 3. Frontend Setup

```bash
cd ../client
npm install
```

## 🏃 Running the Application

### Backend

Navigate to the `server` directory:

```bash
# Development with auto-reload
npm run dev

# Production
npm start

# Local development (in-memory DB, no Redis)
npm run dev:local

# Start job worker
npm run worker
```

The backend will run on `http://localhost:5000` (or configured PORT)

### Frontend

Navigate to the `client` directory:

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Lint code
npm run lint
```

The frontend will run on `http://localhost:3000`

## 🔐 Environment Variables

### Server (.env)

```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/wapi
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
WHATSAPP_API_URL=https://graph.instagram.com
FRONTEND_URL=http://localhost:3000
```

### Client (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

See `.env.example` files in respective directories for all available options.

## ✨ Features

### Core Features
- ✅ WhatsApp Business API Integration
- ✅ User Authentication & Authorization
- ✅ Contact Management
- ✅ Message Templates
- ✅ Campaign Management
- ✅ Conversation Management
- ✅ Real-time Chat

### Automation
- ✅ Answer Bot
- ✅ Auto-replies
- ✅ Instagram Quickflows
- ✅ WhatsApp Forms
- ✅ Workflow Builder

### E-Commerce
- ✅ Product Catalog Management
- ✅ Checkout Bot
- ✅ Order Management
- ✅ Commerce Settings

### Sales & CRM
- ✅ Sales Pipeline
- ✅ Deal Management
- ✅ Sales Reports
- ✅ Task Management

### Admin & Analytics
- ✅ Admin Dashboard
- ✅ Analytics & Metrics
- ✅ Usage Tracking
- ✅ Ad Management

### Integrations
- ✅ Google OAuth
- ✅ Instagram Integration
- ✅ Razorpay Payment Gateway
- ✅ Webhook Support

## 📚 API Documentation

API endpoints are organized by feature:

- `/api/auth` - Authentication endpoints
- `/api/contacts` - Contact management
- `/api/messages` - Messaging
- `/api/templates` - Message templates
- `/api/campaigns` - Campaign management
- `/api/automation` - Automation workflows
- `/api/commerce` - E-commerce features
- `/api/sales` - Sales & CRM
- `/api/analytics` - Analytics data
- `/api/integrations` - Third-party integrations
- `/api/webhooks` - Webhook handlers

For detailed API documentation, refer to controller files in `server/src/controllers/`.

## 🔄 Database Seeding

To populate the database with sample data:

```bash
cd server
npm run seed

# For development with in-memory DB
npm run seed:dev
```

## 📖 Additional Documentation

- [Backend README](server/README.md)
- [Frontend README](client/README.md)
- [API Documentation](server/docs/) (if available)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Create a feature branch (`git checkout -b feature/your-feature`)
2. Commit your changes (`git commit -am 'Add some feature'`)
3. Push to the branch (`git push origin feature/your-feature`)
4. Open a Pull Request

## 📄 License

ISC License - See LICENSE file for details

---

**Last Updated**: December 2025