# WhatsApp Business API SaaS Backend

A complete backend for building a WhatsApp Business API provider platform (like Interakt, Wati, etc.)

## 📁 Project Structure

```
/src
  /config       - Environment configuration
  /controllers  - Request handlers
  /models       - MongoDB models
  /routes       - API routes
  /middlewares  - Auth, validation, etc.
  /services     - Business logic & Meta API integration
  /utils        - Helper functions
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials (see setup guide below)

# Start development server
npm run dev
```

## 📜 Available Scripts

- `npm run dev` - Start server with hot reload (nodemon)
- `npm start` - Start production server
- `npm run worker` - Start queue worker for WhatsApp message processing

## 🔧 Environment Variables

See `.env.example` for all available options. Key variables:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for JWT tokens |
| `META_APP_ID` | Your Meta App ID |
| `META_APP_SECRET` | Your Meta App Secret |
| `META_ACCESS_TOKEN` | System User access token |
| `META_PHONE_NUMBER_ID` | Your WhatsApp phone number ID |
| `META_WABA_ID` | WhatsApp Business Account ID |
| `META_CONFIG_ID` | Embedded Signup config ID (for multi-tenant) |

## 🔐 Business Verification & WhatsApp Setup

### For Your Platform (Admin Setup)

1. **Create Meta App**
   - Go to [developers.facebook.com](https://developers.facebook.com/)
   - Create a Business type app
   - Add WhatsApp product

2. **Set Up System User**
   - In Business Manager, go to Settings > System Users
   - Create a System User with Admin access
   - Generate a token with permissions:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`

3. **Business Verification**
   - Complete Meta Business Verification
   - For India, provide GST/MSME/PAN
   - Upload required documents

4. **Configure Embedded Signup** (for multi-tenant)
   - In App Dashboard > WhatsApp > Getting Started
   - Enable Embedded Signup
   - Create a configuration and copy the Config ID

### For Your Customers

The platform supports two WhatsApp connection methods:

1. **Embedded Signup (Recommended)**
   - Customers connect via Facebook Login
   - Creates their own WABA automatically
   - Full control of their WhatsApp number

2. **Manual OTP Flow**
   - Customers enter their phone number
   - Verify via OTP
   - Admin activates the number

### Admin Management Endpoints

```
GET  /api/v1/admin/whatsapp-setup-requests     - List pending activations
PUT  /api/v1/admin/whatsapp-setup-requests/:id - Update activation status
GET  /api/v1/admin/verification-requests        - List verification requests
PUT  /api/v1/admin/verification-requests/:id    - Approve/reject verification
POST /api/v1/admin/workspaces/:id/activate-whatsapp - Manual activation
```

## 📡 Webhook Setup

1. Set webhook URL: `https://your-domain.com/api/v1/webhook/meta`
2. Use `META_VERIFY_TOKEN` as verification token
3. Subscribe to: `messages`, `message_status_updates`

## 🛠 Troubleshooting

### Common Issues

**Token Expired**
- Generate a new System User token
- Update `META_ACCESS_TOKEN` in .env

**Business Verification Pending**
- Allow 1-5 business days for Meta review
- Ensure all documents are clear and valid

**Phone Number Not Activating**
- Check if number is already registered with WhatsApp
- Verify business is approved in Meta
- Use Admin panel for manual activation

**Embedded Signup Fails**
- Verify `META_CONFIG_ID` is correct
- Check App is in Live mode (not Development)
- Ensure domain is whitelisted in Meta App settings

## 📝 License

MIT
