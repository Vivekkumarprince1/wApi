# ⚠️ REQUIRED: Complete These Steps Before Template Submission Works

## Current Status: ❌ BLOCKED

Template submission is failing because:
- ❌ WABA ID not accessible to system user token
- ❌ System user not assigned to WhatsApp Business Account
- ❌ Token lacks proper permissions

**You must complete ALL steps below before trying again.**

---

## 🎯 Required Configuration Steps

### ☐ Step 1: Verify You Have Meta Business Manager Access
- [ ] Can log into https://business.facebook.com
- [ ] Can see your Business Account
- [ ] Have admin or full access

**If you can't access Business Manager, ask the Business Account owner to:**
- Add you as admin
- Or provide you with a system user token that has WABA access

---

### ☐ Step 2: Find Your Correct WABA ID

**Go to:**
1. https://business.facebook.com
2. Select your Business Account (left sidebar)
3. **Settings** (bottom left) → **WhatsApp Accounts**
4. Find your WhatsApp Business Account
5. **Copy the ID** shown (example: `123456789012345`)

**Document it here:**
```
My WhatsApp Business Account ID: ___________________
```

**⚠️ IMPORTANT:**
- This should be an ID number, NOT a phone number
- It should be around 15 digits
- It's different from "Phone Number ID"

---

### ☐ Step 3: Assign System User to WhatsApp Account

**Go to:**
1. https://business.facebook.com
2. **Settings** → **Users and Permissions** → **System Users**
3. Click the system user you're using (that generated your token)

**Verify/Do:**
- [ ] Under "Assets" section, find your WhatsApp Business Account
- [ ] If NOT listed: Click **"Assign Assets"** → Select WhatsApp account → Assign
- [ ] If listed: Click it and verify these roles are checked:
  - [ ] ✅ Manage WhatsApp business
  - [ ] ✅ Manage WhatsApp messaging
- [ ] Click **"Save"** or **"Assign"**

---

### ☐ Step 4: Generate NEW System User Token

**⚠️ CRITICAL:** You MUST generate a NEW token after assigning WABA access

**Go to:**
1. Same system user page from Step 3
2. Scroll down to **"Access Tokens"** section
3. Click **"Generate Token"**

**Configure:**
- [ ] **App**: Select your app (usually your WhatsApp integration app)
- [ ] **Expiration**: "No expiration" (or your preference)
- [ ] **Permissions/Scopes** (select these exactly):
  - [ ] ✅ `whatsapp_business_management`
  - [ ] ✅ `whatsapp_business_messaging`
- [ ] Click **"Generate Token"**

**⚠️ SAVE THE TOKEN IMMEDIATELY - You won't see it again!**

**Document it:**
```
New System User Token: ___________________
```

---

### ☐ Step 5: Update .env File

**File:** `/Users/vivek/Desktop/wApi/server/.env`

**Update these lines:**
```bash
# Line 53: Replace with CORRECT WABA ID from Step 2
BSP_WABA_ID=YOUR_CORRECT_WABA_ID_HERE

# Line 54: Replace with NEW TOKEN from Step 4
BSP_SYSTEM_USER_TOKEN=YOUR_NEW_SYSTEM_USER_TOKEN_HERE

# Keep these unchanged:
BSP_BUSINESS_ID=789846416555877
BSP_WEBHOOK_VERIFY_TOKEN=your-webhook-verify-token-151
```

**Example:**
```bash
BSP_WABA_ID=123456789012345
BSP_SYSTEM_USER_TOKEN=EAAXBlBXSZAaMBQUDDjQqf8Q4zmcrT3GX6amTZCxm9R5qdLFEdoDpXTCJN1ILw1KYsjHaCrpQ8TZBkTBPpuwkWi8rozezTSM4rAI6Gly65jrcQZC6lJCO5BxkktuKr9LUs9p8xGdUqfljfAByHGsymbSwUvH2OSZAXXiafoef08JR4xYZCZBA0PCYF7DzPKQgdTNBAZDZD
```

---

### ☐ Step 6: Verify Configuration

**Run diagnostics:**
```bash
cd /Users/vivek/Desktop/wApi/server
node diagnostics/bsp-meta-api-diagnostics.js
```

**Expected output:**
```
✅ Token is valid
✅ WABA is accessible
✅ Found X phone number(s)
✅ Template endpoint is accessible
✅ Template submission successful
```

**If you see ✅ on all tests → Go to Step 7**  
**If you see ❌ on any test → Repeat Step 2-5**

---

### ☐ Step 7: Restart Server

**Stop current server:** Press `Ctrl+C` in terminal

**Restart:**
```bash
cd /Users/vivek/Desktop/wApi/server
npm start
```

**Wait for:** `Server running on port http://localhost:5001`

---

### ☐ Step 8: Test Template Submission

**Try submitting a template again:**
1. Create a template in the UI
2. Click "Submit to Meta"
3. **Expected:** Success message ✅

---

## ⏱️ Estimated Time: 20 minutes

---

## 🆘 If You Get Stuck

### "I can't access Business Manager"
- Your user account doesn't have access
- Ask the Business Account owner to add you as admin
- Or ask them for a system user token

### "I don't see my WhatsApp Account in Settings"
- You might not be the owner
- Try a different Business Account
- Ask the WhatsApp Business Account owner to verify

### "System Users page shows 'You don't have permission'"
- You need admin access to Business Manager
- Ask the Business Account owner to give you admin role

### "Still getting WABA error after these steps"
- Verify you copied WABA ID correctly (no spaces)
- Verify you copied token correctly (no spaces, no line breaks)
- Make sure server was restarted after updating .env
- Run diagnostic again to verify

---

## ✅ Completion Checklist

Before trying template submission again:
- [ ] Found correct WABA ID (documented above)
- [ ] System user assigned to WhatsApp account
- [ ] System user has both required roles
- [ ] Generated NEW system user token
- [ ] Updated .env with WABA ID
- [ ] Updated .env with NEW token
- [ ] Ran diagnostic - all tests passed ✅
- [ ] Server restarted

**Only attempt template submission after ALL boxes are checked.**

---

## 📞 Status After Completion

Once you've completed all steps and the diagnostic passes:
- Template submission will work ✅
- You can send template messages ✅
- Webhooks will be properly routed ✅
- Multi-tenant BSP model will be active ✅
