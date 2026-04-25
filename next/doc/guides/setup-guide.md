# Local Setup & Development Guide

Follow these steps to get the wApi project running on your local machine.

## Prerequisites
- **Node.js**: v18 or higher.
- **MongoDB**: A running instance (local or Atlas).
- **Redis**: Required for BullMQ workers and caching.
- **ngrok**: (Optional) For receiving webhooks from WhatsApp/Gupshup.

## 1. Installation

Clone the repository and install dependencies:
```bash
npm install
```

## 2. Environment Configuration

Copy the example environment file and fill in the values:
```bash
cp .env.example .env
```
Refer to the [Environment Variables Guide](./environment-variables.md) for details on each key.

## 3. Database Setup

Ensure MongoDB and Redis are running. If you are using local instances:
```bash
# Start MongoDB
brew services start mongodb-community
# Start Redis
brew services start redis
```

## 4. Running the Application

### Development Mode
Runs the Next.js dev server with hot reloading:
```bash
npm run dev
```

### Background Workers
The messaging and automation engines rely on BullMQ workers. These must be running to process webhooks:
```bash
# In a separate terminal
npm run workers
```
*(Note: If your project integrates workers into the main process, this step may be handled by `npm run dev`.)*

## 5. Webhook Setup (Local Development)

To receive real-time messages on your local machine:
1. Start ngrok: `ngrok http 3000`.
2. Copy the ngrok URL (e.g., `https://xyz.ngrok-free.app`).
3. Update `WHATSAPP_WEBHOOK_URL` in your `.env`.
4. Configure this URL in your Gupshup/Meta partner dashboard.

## 6. Build & Production

To verify the project builds correctly for production:
```bash
npm run build
npm start
```
