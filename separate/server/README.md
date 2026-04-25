# WhatsApp SaaS Backend - Refactored Architecture

A scalable, enterprise-grade backend for WhatsApp Business SaaS platform with clean architecture and comprehensive testing.

## 🏗️ Architecture Overview

### Directory Structure

```
server/src/
├── config/                    # Configuration management
│   ├── database.js           # MongoDB connection
│   ├── redis.js             # Redis configuration
│   ├── env.js               # Environment validation
│   └── bspConfig.js         # BSP-specific config
│
├── constants/                # Application constants
│   ├── errors.js            # Error codes and messages
│   ├── messages.js          # Success/info messages
│   ├── limits.js            # Rate limits and quotas
│   └── templates.js         # Template configurations
│
├── middlewares/              # Express middlewares
│   ├── auth/                # Authentication middlewares
│   ├── rate-limits/         # Rate limiting
│   ├── validation/          # Input validation
│   ├── error/               # Error handling
│   └── security/            # Security middlewares
│
├── models/                  # Mongoose models (domain-organized)
│   ├── user/                # User domain models
│   ├── workspace/           # Workspace domain models
│   ├── messaging/           # Messaging domain models
│   ├── commerce/            # Commerce domain models
│   ├── automation/          # Automation domain models
│   ├── analytics/           # Analytics domain models
│   ├── admin/               # Admin domain models
│   └── shared/              # Shared models
│
├── repositories/            # Data access layer
│   ├── baseRepository.js    # Abstract base repository
│   ├── contactRepository.js # Contact-specific repository
│   └── ...                  # Other domain repositories
│
├── services/                # Business logic layer
│   ├── auth/                # Authentication services
│   ├── messaging/           # Messaging services
│   ├── bsp/                 # BSP integration services
│   ├── commerce/            # Commerce services
│   ├── workspace/           # Workspace services
│   ├── analytics/           # Analytics services
│   ├── integration/         # External integrations
│   └── admin/               # Admin services
│
├── controllers/             # HTTP request handlers
│   └── messaging/           # Domain-organized controllers
│
├── routes/                  # Route definitions
│   └── messaging/           # Domain-organized routes
│
├── utils/                   # Utility functions
│   ├── logger.js           # Structured logging
│   ├── errorFormatter.js   # Error formatting
│   ├── validation.js       # Input validation helpers
│   ├── transformers.js     # Data transformation
│   └── crypto.js           # Encryption utilities
│
├── types/                   # Type definitions (future JSDoc)
├── tests/                   # Test suites
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── e2e/                # End-to-end tests
│
├── cron/                    # Scheduled jobs
├── webhooks/                # Webhook handlers
├── queue/                   # Background job queues
└── server.js                # Application entry point
```

## 🚀 Key Improvements

### 1. **Separation of Concerns**
- **Controllers**: Only handle HTTP requests/responses
- **Services**: Contain business logic
- **Repositories**: Handle data access
- **Models**: Define data schemas

### 2. **Domain-Driven Design**
- Organized by business domains (messaging, commerce, automation, etc.)
- Clear boundaries between different areas of functionality
- Easier to maintain and extend

### 3. **Comprehensive Testing**
- Unit tests for services and utilities
- Integration tests for API endpoints
- E2E tests for critical user flows
- 70%+ code coverage target

### 4. **Structured Logging**
- Winston-based structured logging
- Different log levels (error, warn, info, debug)
- Specialized logging for API requests, BSP operations, etc.

### 5. **Error Handling**
- Centralized error formatting
- Consistent error responses
- Proper HTTP status codes

### 6. **Input Validation**
- Request validation with express-validator
- Centralized validation rules
- Consistent error messages

### 7. **Security & Encryption**
- Environment variable validation
- Sensitive data encryption
- API key hashing

## 🛠️ Development Setup

### Prerequisites
- Node.js 16+
- MongoDB
- Redis
- npm or yarn

### Installation
```bash
cd server
npm install
```

### Environment Configuration
Create a `.env` file with required variables:
```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=64-character-hex-string
REDIS_URL=redis://localhost:6379
MONGO_URI=mongodb://localhost:27017/wapi_development
```

### Running the Application
```bash
# Development with auto-reload
npm run dev

# Development with in-memory DB
npm run dev:local

# Production
npm start
```

### Running Tests
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📊 Testing Strategy

### Unit Tests
- Test individual functions and methods
- Mock external dependencies
- Focus on business logic

### Integration Tests
- Test API endpoints
- Use test database
- Verify data flow between components

### E2E Tests
- Test complete user workflows
- Use real database (separate from dev)
- Verify system integration

## 🔒 Security Features

- **Environment Validation**: Required variables checked at startup
- **Input Sanitization**: All inputs validated and sanitized
- **Rate Limiting**: Configurable rate limits by endpoint and user
- **Encryption**: Sensitive data encrypted at rest
- **CORS**: Configurable cross-origin policies
- **Helmet**: Security headers

## 📈 Performance Optimizations

- **Connection Pooling**: MongoDB and Redis connection pools
- **Indexing**: Proper database indexes
- **Caching**: Redis-based caching for frequently accessed data
- **Background Jobs**: Asynchronous processing for heavy operations
- **Pagination**: Efficient data pagination for large datasets

## 🔄 Migration Guide

### From Legacy Architecture

1. **Dead Code Removal**: Removed old files and unused dependencies
2. **Service Extraction**: Moved business logic from controllers to services
3. **Repository Pattern**: Introduced data access layer
4. **Domain Organization**: Reorganized files by business domain
5. **Testing Framework**: Added comprehensive test suite

### Breaking Changes
- Some API response formats may have changed for consistency
- Error response structure standardized
- Validation rules more strict

## 📚 API Documentation

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## 🤝 Contributing

1. Follow the established patterns and conventions
2. Write tests for new functionality
3. Update documentation as needed
4. Ensure code coverage remains above 70%

## 📝 License

This project is proprietary software.
| `META_WABA_ID` | WhatsApp Business Account ID |
| `META_CONFIG_ID` | Embedded Signup config ID (for multi-tenant) |
| `GUPSHUP_PARTNER_TOKEN` | Partner token for Gupshup partner APIs |
| `GUPSHUP_APP_ID` | Default partner app ID |
| `GUPSHUP_API_KEY` | Gupshup app API key for messaging APIs |
| `GUPSHUP_DEFAULT_REGION` | Default region for register-phone flow (default: `IN`) |

## 📞 BSP Connect Number API

The backend now supports both connection options from the dashboard modal:

- Connect your WhatsApp Business App
- Connect new number

Endpoint:

```http
POST /api/v1/onboarding/bsp/register-phone
Authorization: Bearer <jwt>
Content-Type: application/json
```

Request body:

```json
{
   "connectionType": "business_app" | "new_number",
   "region": "IN",
   "appId": "optional-app-id"
}
```

Behavior:

- `business_app`: starts BSP embedded onboarding and returns onboarding `url` + `state`.
- `new_number`: calls Gupshup `POST /partner/app/{appId}/onboarding/register` and returns provider response.

Common error codes:

- `400` invalid request payload or provider-side validation errors
- `429` provider rate limit reached
- `502` provider authentication/authorization failure

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

##  License

MIT
