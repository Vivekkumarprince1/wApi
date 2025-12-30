/**
 * COMMERCE SETTINGS - QUICK START GUIDE
 * 
 * This guide shows how to use the new Commerce Settings API
 */

// ============================================
// 1. FETCH CURRENT SETTINGS
// ============================================

async function fetchSettings() {
  const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  console.log('Current Settings:', data.settings);
  
  // Returns:
  // {
  //   enabled: false,
  //   currency: 'INR',
  //   taxPercentage: 0,
  //   paymentMethods: { ... },
  //   notifications: { ... },
  //   ...
  // }
}

// ============================================
// 2. ENABLE COMMERCE & SET BASIC CONFIG
// ============================================

async function setupCommerce() {
  const payload = {
    enabled: true,
    currency: 'INR',
    taxPercentage: 18, // GST in India
    orderAutoConfirm: false,
    notifications: {
      notifyAdminOnOrder: true,
      notifyCustomerOnOrder: true,
      adminEmails: ['admin@mystore.com', 'sales@mystore.com']
    }
  };
  
  const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  console.log('Settings Updated:', result.settings);
}

// ============================================
// 3. ADD CASH ON DELIVERY
// ============================================

async function addCOD() {
  const payload = {
    paymentMethods: {
      cashOnDelivery: {
        enabled: true,
        instructions: 'Customer pays ₹{AMOUNT} in cash at delivery. No prepayment needed.'
      }
    }
  };
  
  const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  console.log('COD Enabled:', await response.json());
}

// ============================================
// 4. ADD RAZORPAY PAYMENT GATEWAY
// ============================================

async function addRazorpay() {
  const payload = {
    paymentMethods: {
      razorpay: {
        enabled: true,
        keyId: 'rzp_live_1Aa0d9xxxxxxxxxxx',      // Get from Razorpay Dashboard
        keySecret: '9xxxxxxxxxxxxxxxxxxx',          // Get from Razorpay Dashboard
        webhookSecret: 'whsec_xxxxxxxxx'            // Generate in Razorpay
      }
    }
  };
  
  const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  
  if (response.ok) {
    console.log('✅ Razorpay configured successfully');
  } else {
    console.error('❌ Error:', result.message);
    // Will show: "Razorpay credentials required to enable" if keys missing
  }
}

// ============================================
// 5. ADD STRIPE PAYMENT GATEWAY
// ============================================

async function addStripe() {
  const payload = {
    paymentMethods: {
      stripe: {
        enabled: true,
        publicKey: 'pk_live_xxxxxxxxxxxxxx',        // From Stripe Dashboard
        secretKey: 'sk_live_xxxxxxxxxxxxx',         // From Stripe Dashboard
        webhookSecret: 'whsec_xxxxxxxxxxxxx'        // From Stripe Webhooks
      }
    }
  };
  
  const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  console.log('Stripe Added:', await response.json());
}

// ============================================
// 6. CONFIGURE SHIPPING
// ============================================

async function setupShipping() {
  const payload = {
    shipping: {
      enabled: true,
      flatRate: {
        enabled: true,
        amount: 100  // ₹100 flat shipping
      },
      freeShippingAbove: {
        enabled: true,
        amount: 1000  // Free shipping above ₹1000
      }
    }
  };
  
  const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  console.log('Shipping Configured:', await response.json());
}

// ============================================
// 7. ADD BUSINESS INFO & POLICIES
// ============================================

async function addBusinessInfo() {
  const payload = {
    business: {
      storeDescription: 'Your premium clothing brand',
      returnPolicy: 'Returns accepted within 30 days of purchase in original condition.',
      cancellationPolicy: 'Orders can be cancelled within 24 hours of placement.',
      privacyPolicy: 'We protect your data. Read our privacy policy at https://...',
      termsConditions: 'By ordering, you agree to our terms and conditions.'
    }
  };
  
  const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  console.log('Business Info Added:', await response.json());
}

// ============================================
// 8. VALIDATE YOUR CONFIGURATION
// ============================================

async function validateConfig() {
  const response = await fetch('http://localhost:5001/api/v1/settings/commerce/validate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const validation = await response.json();
  
  console.log('Validation Report:');
  console.log('- Enabled:', validation.validation.isEnabled);
  console.log('- Has Payment Methods:', validation.validation.hasAtLeastOnePaymentMethod);
  console.log('- Admin Emails Configured:', validation.validation.hasNotificationEmails);
  console.log('- Issues:', validation.validation.issues);
  
  // Example output:
  // Validation Report:
  // - Enabled: true
  // - Has Payment Methods: true
  // - Admin Emails Configured: true
  // - Issues: []
}

// ============================================
// 9. COMPLETE SETUP - ALL IN ONE
// ============================================

async function completeSetup() {
  const fullConfig = {
    enabled: true,
    currency: 'INR',
    taxPercentage: 18,
    
    paymentMethods: {
      cashOnDelivery: {
        enabled: true,
        instructions: 'Pay at delivery'
      },
      razorpay: {
        enabled: true,
        keyId: 'rzp_live_xxxxx',
        keySecret: 'xxxxx'
      }
    },
    
    orderAutoConfirm: false,
    
    notifications: {
      notifyAdminOnOrder: true,
      notifyCustomerOnOrder: true,
      notifyAdminOnPayment: true,
      notifyCustomerOnPayment: true,
      adminEmails: ['admin@store.com']
    },
    
    shipping: {
      enabled: true,
      flatRate: {
        enabled: true,
        amount: 100
      },
      freeShippingAbove: {
        enabled: true,
        amount: 1000
      }
    },
    
    business: {
      storeDescription: 'Premium Store',
      returnPolicy: '30 days return',
      cancellationPolicy: '24 hours cancellation',
      privacyPolicy: 'Your privacy is important',
      termsConditions: 'Agree to terms'
    }
  };
  
  const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fullConfig)
  });
  
  if (response.ok) {
    console.log('✅ Complete setup successful!');
    
    // Now validate
    await validateConfig();
  } else {
    const error = await response.json();
    console.error('❌ Setup failed:', error.message);
  }
}

// ============================================
// ERROR HANDLING EXAMPLES
// ============================================

async function demonstrateErrors() {
  // 1. Using free plan (doesn't have commerce)
  try {
    const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ enabled: true })
    });
    
    if (response.status === 403) {
      const error = await response.json();
      console.error('❌ Plan Error:', error.message);
      // Output: "Commerce features are not available on your plan"
    }
  } catch (e) {
    console.error('Request failed:', e);
  }
  
  // 2. Invalid tax percentage
  try {
    const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ taxPercentage: 150 })  // > 100
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Tax Error:', error.message);
      // Output: "Tax percentage must be between 0 and 100"
    }
  } catch (e) {
    console.error('Request failed:', e);
  }
  
  // 3. Razorpay enabled but no credentials
  try {
    const response = await fetch('http://localhost:5001/api/v1/settings/commerce', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        paymentMethods: {
          razorpay: {
            enabled: true
            // Missing keyId and keySecret
          }
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Razorpay Error:', error.message);
      // Output: "Razorpay credentials required to enable"
    }
  } catch (e) {
    console.error('Request failed:', e);
  }
}

// ============================================
// EXPORT FUNCTIONS FOR USE IN COMPONENTS
// ============================================

export {
  fetchSettings,
  setupCommerce,
  addCOD,
  addRazorpay,
  addStripe,
  setupShipping,
  addBusinessInfo,
  validateConfig,
  completeSetup,
  demonstrateErrors
};
