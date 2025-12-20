# WhatsApp Business API Platform

A comprehensive WhatsApp Business API platform similar to Interakt, built with Next.js frontend and Node.js backend with MongoDB and Prisma.

## 🚀 Features

### ✅ **Bulk Message Sending**
- Send personalized messages to multiple contacts
- Template-based messaging with variable substitution
- Campaign management and tracking
- Real-time delivery status

### ✅ **CSV Contact Import**
- Upload contacts via CSV files
- Duplicate detection and handling
- Contact validation and formatting
- Bulk contact management

### ✅ **Message Templates**
- Create and manage message templates
- Variable support ({{name}}, {{phone}}, {{email}}, {{company}})
- Category-based organization
- Template search and filtering

### ✅ **Campaign Management**
- Create, schedule, and manage campaigns
- Campaign status tracking (draft, scheduled, running, completed, failed)
- Campaign analytics and reporting
- Message delivery statistics

### ✅ **WhatsApp Business API Integration**
- Direct integration with WhatsApp Business API
- Message sending and status tracking
- Phone number validation and formatting
- Error handling and retry logic

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework
- **Tailwind CSS** - Styling
- **React Icons** - Icons
- **TypeScript** - Type safety

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **MongoDB** - Database
- **JWT** - Authentication
- **Axios** - HTTP client

## 📁 Project Structure

```
whatsaap api/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── contacts.controller.js
│   │   │   ├── templates.controller.js
│   │   │   └── campaigns.controller.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── contacts.routes.js
│   │   │   ├── templates.routes.js
│   │   │   └── campaigns.routes.js
│   │   ├── middleware/
│   │   │   └── auth.middleware.js
│   │   ├── utils/
│   │   │   └── whatsappService.js
│   │   └── index.js
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
└── frontend/
    └── landing/
        ├── app/
        │   ├── dashboard/
        │   │   ├── campaign/
        │   │   └── profile/
        │   └── auth/
        ├── components/
        │   ├── BulkMessageSender.jsx
        │   ├── TemplateManager.jsx
        │   ├── CampaignList.jsx
        │   ├── SandboxCard.jsx
        │   └── DashboardLayout.jsx
        ├── lib/
        │   └── api.js
        └── package.json
```
See `README.md` — canonical content consolidated here.
### 1. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```env
DATABASE_URL="mongodb://localhost:27017/whatsapp_api"
JWT_SECRET="your-jwt-secret-key"
WHATSAPP_API_URL="https://graph.facebook.com/v17.0"
WHATSAPP_ACCESS_TOKEN="your-whatsapp-access-token"
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
```

Setup database:
```bash
npx prisma generate
npx prisma db push
```

Start backend:
See `README.md` — canonical content consolidated here.

### 2. Frontend Setup

```bash
cd frontend/landing
npm install
```

Start frontend:
See `README.md` — canonical content consolidated here.

### 🔐 Social Login Environment Variables

To enable Google and Facebook authentication flows, add the following variables:

**Backend `.env`:**
```env
GOOGLE_CLIENT_ID=your-google-oauth-client-id
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

**Frontend `.env.local`:**
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id
NEXT_PUBLIC_FACEBOOK_APP_ID=your-facebook-app-id
```

Make sure the Google OAuth client has `http://localhost:3000` listed in the authorized JavaScript origins, and that the Facebook app is in Live mode with `email` permission approved for production.

## 📋 API Endpoints

### Authentication
- `POST /api/auth/send-signup-otp` - Send signup OTP
- `POST /api/auth/verify-signup-otp` - Verify signup OTP
- `POST /api/auth/send-login-otp` - Send login OTP
- `POST /api/auth/verify-login-otp` - Verify login OTP
- `POST /api/auth/logout` - Logout user

### Contacts
- `POST /api/contacts/upload` - Upload contacts via CSV
- `GET /api/contacts` - Get all contacts (with pagination)
- `GET /api/contacts/stats` - Get contact statistics
- `DELETE /api/contacts/:id` - Delete a contact

### Templates
- `POST /api/templates` - Create a new template
- `GET /api/templates` - Get all templates
- `GET /api/templates/:id` - Get a specific template
- `PUT /api/templates/:id` - Update a template
- `DELETE /api/templates/:id` - Delete a template
- `GET /api/templates/categories` - Get template categories

### Campaigns
- `POST /api/campaigns` - Create a new campaign
- `GET /api/campaigns` - Get all campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns/:id/start` - Start a campaign
- `PUT /api/campaigns/:id` - Update a campaign
- `DELETE /api/campaigns/:id` - Delete a campaign
- `GET /api/campaigns/stats` - Get campaign statistics

## 🔧 WhatsApp Business API Setup

### 1. Create Meta Developer Account
- Go to [Meta for Developers](https://developers.facebook.com/)
- Create a new app or use an existing one
- Add WhatsApp product to your app

### 2. Set Up WhatsApp Business API
- In your Meta app, go to WhatsApp > Getting Started
- Follow the setup process to get your:
  - Access Token
  - Phone Number ID
  - Verify your phone number

### 3. Configure Environment Variables
```env
WHATSAPP_API_URL="https://graph.facebook.com/v17.0"
WHATSAPP_ACCESS_TOKEN="your-whatsapp-access-token"
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
```

## 📊 Database Schema

### User
- `id` - Unique identifier
- `email` - User email
- `password` - Hashed password
- `firstName`, `lastName` - User details
- `googleId`, `googleEmail`, `googlePicture` - Google OAuth
- `authProvider` - Authentication method
- `isVerified` - Email verification status

### Contact
- `id` - Unique identifier
- `userId` - User who owns the contact
- `phone` - Contact phone number
- `firstName`, `lastName` - Contact name
- `email` - Contact email
- `company` - Contact company

### Template
- `id` - Unique identifier
- `userId` - User who owns the template
- `name` - Template name
- `content` - Template message content
- `variables` - Array of variables used
- `category` - Template category
- `isActive` - Template status

### Campaign
- `id` - Unique identifier
- `userId` - User who owns the campaign
- `name` - Campaign name
- `message` - Campaign message
- `templateId` - Associated template
- `status` - Campaign status
- `totalContacts`, `sentCount`, `failedCount` - Statistics
- `scheduledAt`, `startedAt`, `completedAt` - Timestamps

### Message
- `id` - Unique identifier
- `userId` - User who owns the message
- `campaignId` - Associated campaign
- `contactId` - Target contact
- `phone` - Contact phone number
- `message` - Message content
- `status` - Message status
- `whatsappMessageId` - WhatsApp API message ID
- `sentAt`, `deliveredAt` - Timestamps
- `error` - Error message if failed

## 🎯 Usage Examples

### 1. Create a Template
```javascript
const template = await createTemplate({
  name: "Welcome Message",
  content: "Hello {{name}}, welcome to our platform!",
  category: "marketing",
  variables: ["name"]
});
```

### 2. Upload Contacts
```javascript
const contacts = [
  { name: "John Doe", phone: "+1234567890", email: "john@example.com" },
  { name: "Jane Smith", phone: "+0987654321", email: "jane@example.com" }
];

const result = await uploadContacts(contacts);
```

### 3. Create and Start Campaign
```javascript
// Create campaign
const campaign = await createCampaign({
  name: "Promotional Campaign",
  message: "Hi {{name}}! Get {{discount}}% off with code {{code}}",
  templateId: "template_id"
});

// Start campaign
await startCampaign(campaign.id, contactIds);
```

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS configuration
- Input validation and sanitization
- Rate limiting (recommended)
- Environment variable protection

## 📈 Monitoring and Analytics

- Campaign success rates
- Message delivery statistics
- Contact engagement metrics
- Template performance tracking
- Error logging and reporting
See `README.md` — canonical content consolidated here.
### Backend Deployment
1. Set up MongoDB database
2. Configure environment variables
3. Deploy to your preferred platform (Heroku, Vercel, AWS, etc.)
4. Run database migrations

### Frontend Deployment
1. Build the Next.js application
2. Deploy to Vercel, Netlify, or your preferred platform
3. Configure environment variables
See `README.md` — canonical content consolidated here.
See `README.md` — canonical content consolidated here.
See `README.md` — canonical content consolidated here.
## 📄 License

This project is licensed under the MIT License.
See `README.md` — canonical content consolidated here.
For support and questions:
- Check the [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- Review the [Meta Developer Documentation](https://developers.facebook.com/docs)
- Create an issue in this repository
See `EXACT_CODE_FIXES.md` — canonical content consolidated here.
**Built with ❤️ for WhatsApp Business API integration** 



























const API_URL = 'http://localhost:5001/api/v1';

// Helper function to get token from localStorage
const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

// Helper function to check if user is authenticated
const isAuthenticated = () => {
  if (typeof window !== 'undefined') {
    return !!localStorage.getItem('token');
  }
  return false;
};

// Helper function to get headers with authorization
const getAuthHeaders = () => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// OTP-based authentication functions
export const sendSignupOTP = async (userData) => {
  const response = await fetch(`${API_URL}/auth/send-signup-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send OTP');
  }

  return response.json();
};

export const verifySignupOTP = async (otpData) => {
  const response = await fetch(`${API_URL}/auth/verify-signup-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(otpData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify OTP');
  }

  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
};

export const sendLoginOTP = async (credentials) => {
  const response = await fetch(`${API_URL}/auth/send-login-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send OTP');
  }

  return response.json();
};

export const verifyLoginOTP = async (otpData) => {
  const response = await fetch(`${API_URL}/auth/verify-login-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(otpData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify OTP');
  }

  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
};

// Legacy functions (keeping for backward compatibility)
export const registerUser = async (userData) => {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to register');
  }

  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
};

export const loginUser = async (credentials) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to login');
  }

  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
};

export const logoutUser = async () => {
  try {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to logout');
    }

    return response.json();
  } finally {
    localStorage.removeItem('token');
  }
};

export const getCurrentUser = async () => {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      return null; // Not authenticated
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to get user');
  }

  const data = await response.json();
  return data.user; // Return the user object from the response
};

export const updateProfile = async (profileData) => {
  const response = await fetch(`${API_URL}/auth/update-profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update profile');
  }

  const data = await response.json();
  return data.user; // Return the updated user object
};

// Google OAuth functions
export const googleLogin = async (token) => {
  const response = await fetch(`${API_URL}/auth/google/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Google authentication failed');
  }

  return response.json();
};

export const getGoogleAuthUrl = async () => {
  const response = await fetch(`${API_URL}/auth/google/auth-url`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get Google auth URL');
  }

  return response.json();
};

// Google OTP verification
export const verifyGoogleOTP = async (data) => {
  try {
    const response = await fetch(`${API_URL}/auth/google/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify Google OTP');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

// ===== CONTACTS API =====

// Upload contacts (bulk)
export const uploadContacts = async (contacts) => {
  const response = await fetch(`${API_URL}/contacts/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ contacts }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload contacts');
  }
  return response.json();
};

// Fetch all contacts for the logged-in user
export const fetchContacts = async (page = 1, limit = 50, search = '') => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search })
  });
  
  const response = await fetch(`${API_URL}/contacts?${params}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch contacts');
  }
  return response.json();
};

// Get contact statistics
export const getContactStats = async () => {
  const response = await fetch(`${API_URL}/contacts/stats`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch contact stats');
  }
  return response.json();
};

// Delete a contact
export const deleteContact = async (contactId) => {
  const response = await fetch(`${API_URL}/contacts/${contactId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete contact');
  }
  return response.json();
};

// ===== TEMPLATES API (Meta Integration) =====

// Get all templates with optional filters
export const fetchTemplates = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`${API_URL}/templates${queryString ? '?' + queryString : ''}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch templates');
  }

  return await response.json();
};

// Get single template by ID
export const fetchTemplate = async (templateId) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch template');
  }

  return await response.json();
};

// Create new template
export const createTemplate = async (templateData) => {
  const response = await fetch(`${API_URL}/templates`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(templateData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create template');
  }

  return await response.json();
};

// Update existing template
export const updateTemplate = async (templateId, updates) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update template');
  }

  return await response.json();
};

// Delete template
export const deleteTemplate = async (templateId) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete template');
  }

  return await response.json();
};

// Submit template to Meta for approval
export const submitTemplateToMeta = async (templateId) => {
  const response = await fetch(`${API_URL}/templates/${templateId}/submit`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to submit template');
  }

  return await response.json();
};

// Sync templates from Meta
export const syncTemplatesFromMeta = async () => {
  const response = await fetch(`${API_URL}/templates/sync`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to sync templates');
  }

  return await response.json();
};

// Get template categories
export const getTemplateCategories = async () => {
  const response = await fetch(`${API_URL}/templates/categories`, {
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch categories');
  }

  return await response.json();
};

// ===== SETTINGS API =====

// Get WABA settings
export const getWABASettings = async () => {
  const response = await fetch(`${API_URL}/settings/waba`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch WABA settings');
  }
  return response.json();
};

// Update WABA settings
export const updateWABASettings = async (settings) => {
  const response = await fetch(`${API_URL}/settings/waba`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update WABA settings');
  }
  return response.json();
};

// Test WABA connection
export const testWABAConnection = async () => {
  const response = await fetch(`${API_URL}/settings/waba/test`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Connection test failed');
  }
  return response.json();
};

// ===== CONVERSATIONS API =====

// Get all conversations
export const fetchConversations = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.assignedTo) queryParams.append('assignedTo', params.assignedTo);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.offset) queryParams.append('offset', params.offset);
  
  const response = await fetch(`${API_URL}/conversations?${queryParams}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch conversations');
  }
  return response.json();
};

// Get conversation by contact
export const fetchConversationByContact = async (contactId) => {
  const response = await fetch(`${API_URL}/conversations/${contactId}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch conversation');
  }
  return response.json();
};

// Get message thread
export const fetchMessageThread = async (contactId, params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.offset) queryParams.append('offset', params.offset);
  
  const response = await fetch(`${API_URL}/conversations/${contactId}/messages?${queryParams}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch messages');
  }
  return response.json();
};

// Update conversation
export const updateConversation = async (contactId, updates) => {
  const response = await fetch(`${API_URL}/conversations/${contactId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update conversation');
  }
  return response.json();
};

// Mark conversation as read
export const markConversationAsRead = async (contactId) => {
  const response = await fetch(`${API_URL}/conversations/${contactId}/read`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mark as read');
  }
  return response.json();
};

// ===== METRICS API =====

// Get template metrics
export const getTemplateMetrics = async (days = 30) => {
  const response = await fetch(`${API_URL}/metrics/templates?days=${days}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch template metrics');
  }
  return response.json();
};

// Get message metrics
export const getMessageMetrics = async (days = 7) => {
  const response = await fetch(`${API_URL}/metrics/messages?days=${days}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch message metrics');
  }
  return response.json();
};

// ===== CAMPAIGNS API =====

// Create a new campaign
export const createCampaign = async (campaignData) => {
  const response = await fetch(`${API_URL}/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(campaignData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create campaign');
  }
  return response.json();
};

// Get all campaigns
export const fetchCampaigns = async (status = '', page = 1, limit = 10) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(status && { status })
  });
  
  const response = await fetch(`${API_URL}/campaigns?${params}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch campaigns');
  }
  return response.json();
};

// Get a single campaign
export const fetchCampaign = async (campaignId) => {
  const response = await fetch(`${API_URL}/campaigns/${campaignId}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch campaign');
  }
  return response.json();
};

// Start a campaign
export const startCampaign = async (campaignId, contactIds) => {
  const response = await fetch(`${API_URL}/campaigns/${campaignId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ contactIds }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start campaign');
  }
  return response.json();
};

// Update a campaign
export const updateCampaign = async (campaignId, campaignData) => {
  const response = await fetch(`${API_URL}/campaigns/${campaignId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(campaignData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update campaign');
  }
  return response.json();
};

// Delete a campaign
export const deleteCampaign = async (campaignId) => {
  const response = await fetch(`${API_URL}/campaigns/${campaignId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete campaign');
  }
  return response.json();
};

// Get campaign statistics
export const getCampaignStats = async () => {
  const response = await fetch(`${API_URL}/campaigns/stats`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch campaign stats');
  }
  return response.json();
};

// ===== TEMPLATES API (Meta Integration) =====

// Get all templates with optional filters
export const getTemplates = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`${API_URL}/templates${queryString ? '?' + queryString : ''}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch templates');
  }

  return await response.json();
};

// Get single template by ID
export const getTemplate = async (templateId) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch template');
  }

  return await response.json();
};

// Create new template
export const createNewTemplate = async (templateData) => {
  const response = await fetch(`${API_URL}/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(templateData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create template');
  }

  return await response.json();
};

// Update existing template
export const updateExistingTemplate = async (templateId, updates) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update template');
  }

  return await response.json();
};

// Delete template
export const deleteExistingTemplate = async (templateId) => {
  const response = await fetch(`${API_URL}/templates/${templateId}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete template');
  }

  return await response.json();
};