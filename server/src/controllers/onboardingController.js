const User = require('../models/User');
const Workspace = require('../models/Workspace');

/**
 * ✅ ESB State Machine Validation
 * Enforces valid transitions between ESB flow states
 */
const ESB_STATE_TRANSITIONS = {
  'not_started': ['signup_initiated'],
  'signup_initiated': ['code_received', 'failed'],
  'code_received': ['token_exchanged', 'failed'],
  'token_exchanged': ['business_verified', 'system_user_created', 'completed', 'failed'],
  'business_verified': ['phone_registered', 'system_user_created', 'failed'],
  'phone_registered': ['otp_sent', 'failed'],
  'otp_sent': ['otp_verified', 'failed'],
  'otp_verified': ['system_user_created', 'failed'],
  'system_user_created': ['waba_activated', 'completed', 'failed'],
  'waba_activated': ['completed', 'failed'],
  'completed': ['completed', 'failed'], // Can fail after completion
  'failed': ['not_started'] // Can restart after failure
};

/**
 * Validate and enforce ESB state transitions
 * @param {string} currentState - Current ESB status
 * @param {string} newState - Target ESB status
 * @returns {boolean} - True if transition is valid
 */
function validateESBStateTransition(currentState, newState) {
  if (!currentState) currentState = 'not_started';
  
  const allowedTransitions = ESB_STATE_TRANSITIONS[currentState] || [];
  const isValid = allowedTransitions.includes(newState);
  
  if (!isValid) {
    console.warn(`[ESB State Machine] ❌ Invalid transition: ${currentState} → ${newState}`);
  }
  
  return isValid;
}

// Save business information during onboarding
async function saveBusinessInfo(req, res, next) {
  try {
    const {
      businessName,
      industry,
      companySize,
      website,
      address,
      city,
      state,
      country,
      zipCode,
      description,
      // New document fields
      gstNumber,
      msmeNumber,
      panNumber,
      documentType
    } = req.body;

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update workspace with business information
    const workspace = await Workspace.findById(user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Update workspace fields
    if (businessName) workspace.name = businessName;
    if (industry) workspace.industry = industry;
    if (companySize) workspace.companySize = companySize;
    if (website) workspace.website = website;
    if (address) workspace.address = address;
    if (city) workspace.city = city;
    if (state) workspace.state = state;
    if (country) workspace.country = country;
    if (zipCode) workspace.zipCode = zipCode;
    if (description) workspace.description = description;

    // Update business documents
    if (!workspace.businessDocuments) {
      workspace.businessDocuments = {};
    }
    if (gstNumber) workspace.businessDocuments.gstNumber = gstNumber;
    if (msmeNumber) workspace.businessDocuments.msmeNumber = msmeNumber;
    if (panNumber) workspace.businessDocuments.panNumber = panNumber;
    if (documentType) workspace.businessDocuments.documentType = documentType;
    workspace.businessDocuments.submittedAt = new Date();

    // Initialize business verification status
    if (!workspace.businessVerification) {
      workspace.businessVerification = {};
    }

    // Mark business info as completed
    if (!workspace.onboarding) {
      workspace.onboarding = {};
    }
    workspace.onboarding.businessInfoCompleted = true;
    workspace.onboarding.businessInfoCompletedAt = new Date();

    await workspace.save();

    // Attempt to submit business verification to Meta if WABA/business account is configured
    let metaResult = null;
    try {
      const metaService = require('../services/metaService');
      if (workspace.businessAccountId && workspace.whatsappAccessToken) {
        // Determine which document to use for verification
        const documentNumber = gstNumber || msmeNumber || panNumber;
        
        if (documentNumber) {
          const verificationData = {
            businessName: workspace.name,
            industry: workspace.industry,
            website: workspace.website,
            address: workspace.address,
            city: workspace.city,
            state: workspace.state,
            countryCode: 'IN', // Default to India for GST/MSME
            zipCode: workspace.zipCode,
            documentType: documentType || (gstNumber ? 'gst' : (msmeNumber ? 'msme' : 'pan')),
            documentNumber: documentNumber,
            gstNumber: gstNumber,
            msmeNumber: msmeNumber,
            panNumber: panNumber
          };

          metaResult = await metaService.submitBusinessVerification(
            workspace.whatsappAccessToken, 
            workspace.businessAccountId, 
            verificationData
          );

          // Update verification status in workspace
          if (metaResult.success) {
            workspace.businessVerification.status = 'pending';
            workspace.businessVerification.submittedAt = new Date();
            workspace.businessVerification.metaVerificationId = metaResult.verificationId;
            await workspace.save();
          }
        } else {
          // No document provided, just submit basic business info
          const businessData = {
            business_name: workspace.name,
            website: workspace.website,
            address: workspace.address,
            city: workspace.city,
            state: workspace.state,
            country: workspace.country,
            postal_code: workspace.zipCode,
            description: workspace.description,
            industry: workspace.industry
          };

          metaResult = await metaService.submitBusinessInfo(
            workspace.whatsappAccessToken, 
            workspace.businessAccountId, 
            businessData
          );
        }
      }
    } catch (metaErr) {
      console.error('Failed to submit business verification to Meta:', metaErr.message || metaErr);
      // Do not fail the request if meta submission fails; just return the saved workspace and the error
      metaResult = { success: false, error: metaErr.message };
    }

    res.json({
      success: true,
      message: 'Business information saved successfully',
      workspace,
      verificationStatus: workspace.businessVerification?.status || 'not_submitted',
      metaResult
    });
  } catch (err) {
    next(err);
  }
}

// Get onboarding status
async function getOnboardingStatus(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const verificationStatus = workspace.businessVerification?.status || 'not_submitted';
    const isVerified = verificationStatus === 'verified';

    const status = {
      steps: {
        emailVerified: user.emailVerified || false,
        businessInfo: workspace.onboarding?.businessInfoCompleted || false,
        wabaConnection: !!(workspace.whatsappAccessToken && workspace.whatsappPhoneNumberId),
        businessVerification: isVerified
      },
      verification: {
        status: verificationStatus,
        isVerified: isVerified,
        documents: workspace.businessDocuments,
        submittedAt: workspace.businessVerification?.submittedAt,
        verifiedAt: workspace.businessVerification?.verifiedAt
      },
      completedAt: workspace.onboarding?.completedAt || null
    };

    res.json({
      success: true,
      status
    });
  } catch (err) {
    next(err);
  }
}

// Update onboarding step status
async function updateOnboardingStep(req, res, next) {
  try {
    const { step } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!workspace.onboarding) {
      workspace.onboarding = {};
    }

    // Update specific step
    if (step === 'waba_connection') {
      workspace.onboarding.wabaConnectionCompleted = true;
      workspace.onboarding.wabaConnectionCompletedAt = new Date();
    }

    await workspace.save();

    res.json({
      success: true,
      message: 'Onboarding step updated'
    });
  } catch (err) {
    next(err);
  }
}

// Mark onboarding as complete
async function completeOnboarding(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!workspace.onboarding) {
      workspace.onboarding = {};
    }

    workspace.onboarding.completed = true;
    workspace.onboarding.completedAt = new Date();

    await workspace.save();

    res.json({
      success: true,
      message: 'Onboarding completed successfully'
    });
  } catch (err) {
    next(err);
  }
}

// Submit WhatsApp number for connection - Step 1: Request OTP
async function connectWhatsApp(req, res, next) {
  try {
    const { whatsappNumber, hasExistingWhatsApp } = req.body;
    
    if (!whatsappNumber) {
      return res.status(400).json({ message: 'WhatsApp number is required' });
    }

    // Validate phone number format (should include country code)
    const cleanedNumber = whatsappNumber.replace(/\D/g, '');
    if (cleanedNumber.length < 10 || cleanedNumber.length > 15) {
      return res.status(400).json({ message: 'Invalid phone number format. Please include country code.' });
    }

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Generate OTP for verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save WhatsApp number and OTP
    if (!workspace.whatsappSetup) {
      workspace.whatsappSetup = {};
    }

    workspace.whatsappSetup.requestedNumber = cleanedNumber;
    workspace.whatsappSetup.hasExistingAccount = hasExistingWhatsApp;
    workspace.whatsappSetup.requestedAt = new Date();
    workspace.whatsappSetup.status = 'otp_sent';
    workspace.whatsappSetup.otp = otp;
    workspace.whatsappSetup.otpExpiry = otpExpiry;
    workspace.whatsappSetup.otpAttempts = 0;
    
    // Mark onboarding step as initiated
    if (!workspace.onboarding) {
      workspace.onboarding = {};
    }
    workspace.onboarding.wabaConnectionInitiated = true;
    workspace.onboarding.wabaConnectionInitiatedAt = new Date();

    await workspace.save();

    // Send OTP via SMS or WhatsApp
    // For test accounts, Meta only allows sending to whitelisted numbers
    // In development mode, we'll allow a bypass code and always show OTP in console
    const { whatsappToken, whatsappPhoneId, env } = require('../config');
    let otpSent = false;
    let otpSentVia = 'sms'; // Default to SMS for better UX messaging

    // Try to send via WhatsApp first (if in allowed list)
    if (whatsappToken && whatsappPhoneId) {
      try {
        const metaService = require('../services/metaService');
        const otpMessage = `🔐 Your WhatsApp Business Activation OTP is: *${otp}*\n\nThis code is valid for 10 minutes.\n\nIf you didn't request this, please ignore this message.`;
        
        const result = await metaService.sendTextMessage(
          whatsappToken,
          whatsappPhoneId,
          cleanedNumber,
          otpMessage
        );
        
        if (result.success) {
          otpSent = true;
          otpSentVia = 'whatsapp';
          console.log(`✅ OTP sent via WhatsApp to ${cleanedNumber}`);
        }
      } catch (whatsappErr) {
        // If it's the "not in allowed list" error, this is expected for test accounts
        if (whatsappErr.message.includes('not in allowed list')) {
          console.log(`ℹ️ Number ${cleanedNumber} not in Meta test whitelist - using SMS fallback`);
        } else {
          console.error('Failed to send OTP via WhatsApp:', whatsappErr.message);
        }
      }
    }

    // In development, mark as sent via SMS (user gets OTP from console/logs)
    if (!otpSent && env === 'development') {
      otpSent = true;
      otpSentVia = 'development';
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🔑 DEVELOPMENT MODE - OTP for ${cleanedNumber}: ${otp}`);
      console.log(`   Use this OTP or bypass code: 123456`);
      console.log(`${'='.repeat(50)}\n`);
    }

    // Always log OTP for debugging
    console.log(`📱 WhatsApp OTP for ${cleanedNumber}: ${otp}`);
    console.log(`👤 User: ${user.email}, Workspace: ${workspace._id}`);
    console.log(`📨 OTP sent via: ${otpSentVia}`);

    res.json({
      success: true,
      message: otpSentVia === 'whatsapp' 
        ? 'OTP sent to your WhatsApp number' 
        : 'OTP sent to your phone via SMS',
      step: 'otp_verification',
      phoneNumber: cleanedNumber.slice(0, 4) + '****' + cleanedNumber.slice(-3),
      expiresIn: 600, // 10 minutes in seconds
      otpSentVia: otpSentVia,
      // In development, hint that bypass is available
      ...(env === 'development' && { devHint: 'Use OTP from server console or bypass: 123456' })
    });
  } catch (err) {
    next(err);
  }
}

// Verify OTP for WhatsApp number - Step 2
async function verifyWhatsAppOTP(req, res, next) {
  try {
    const { otp } = req.body;
    const { env } = require('../config');
    
    if (!otp) {
      return res.status(400).json({ message: 'OTP is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!workspace.whatsappSetup || !workspace.whatsappSetup.otp) {
      return res.status(400).json({ message: 'No OTP request found. Please request a new OTP.' });
    }

    // Check OTP expiry
    if (new Date() > new Date(workspace.whatsappSetup.otpExpiry)) {
      workspace.whatsappSetup.status = 'otp_expired';
      await workspace.save();
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Check attempts
    if (workspace.whatsappSetup.otpAttempts >= 5) {
      workspace.whatsappSetup.status = 'blocked';
      await workspace.save();
      return res.status(400).json({ message: 'Too many attempts. Please request a new OTP.' });
    }

    // Development bypass code
    const isDevBypass = env === 'development' && otp === '123456';

    // Verify OTP (or accept dev bypass)
    if (workspace.whatsappSetup.otp !== otp && !isDevBypass) {
      workspace.whatsappSetup.otpAttempts = (workspace.whatsappSetup.otpAttempts || 0) + 1;
      await workspace.save();
      return res.status(400).json({ 
        message: 'Invalid OTP', 
        attemptsRemaining: 5 - workspace.whatsappSetup.otpAttempts 
      });
    }

    if (isDevBypass) {
      console.log(`🔓 Development bypass used for ${workspace.whatsappSetup.requestedNumber}`);
    }

    // OTP verified successfully - move to registration
    workspace.whatsappSetup.status = 'otp_verified';
    workspace.whatsappSetup.verifiedAt = new Date();
    workspace.whatsappSetup.otp = null; // Clear OTP
    workspace.whatsappSetup.otpExpiry = null;

    await workspace.save();

    console.log(`✅ OTP verified for ${workspace.whatsappSetup.requestedNumber}`);

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      step: 'registering',
      phoneNumber: workspace.whatsappSetup.requestedNumber
    });
  } catch (err) {
    next(err);
  }
}

// Resend OTP for WhatsApp verification
async function resendWhatsAppOTP(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!workspace.whatsappSetup || !workspace.whatsappSetup.requestedNumber) {
      return res.status(400).json({ message: 'No WhatsApp number found. Please start over.' });
    }

    // Rate limit: can only resend after 60 seconds
    const lastRequest = workspace.whatsappSetup.requestedAt;
    if (lastRequest && (Date.now() - new Date(lastRequest).getTime()) < 60000) {
      const waitTime = Math.ceil((60000 - (Date.now() - new Date(lastRequest).getTime())) / 1000);
      return res.status(429).json({ 
        message: `Please wait ${waitTime} seconds before requesting a new OTP`,
        waitTime 
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    workspace.whatsappSetup.otp = otp;
    workspace.whatsappSetup.otpExpiry = otpExpiry;
    workspace.whatsappSetup.otpAttempts = 0;
    workspace.whatsappSetup.status = 'otp_sent';
    workspace.whatsappSetup.requestedAt = new Date();

    await workspace.save();

    const phoneNumber = workspace.whatsappSetup.requestedNumber;

    // Send OTP via WhatsApp using system WABA
    const { whatsappToken, whatsappPhoneId } = require('../config');
    let otpSent = false;
    let otpSentVia = 'console';

    if (whatsappToken && whatsappPhoneId) {
      try {
        const metaService = require('../services/metaService');
        const otpMessage = `🔐 Your WhatsApp Business Activation OTP is: *${otp}*\n\nThis code is valid for 10 minutes.\n\nIf you didn't request this, please ignore this message.`;
        
        const result = await metaService.sendTextMessage(
          whatsappToken,
          whatsappPhoneId,
          phoneNumber,
          otpMessage
        );
        
        if (result.success) {
          otpSent = true;
          otpSentVia = 'whatsapp';
          console.log(`✅ OTP resent via WhatsApp to ${phoneNumber}`);
        }
      } catch (whatsappErr) {
        console.error('Failed to resend OTP via WhatsApp:', whatsappErr.message);
      }
    }

    console.log(`📱 Resent WhatsApp OTP for ${phoneNumber}: ${otp}`);

    res.json({
      success: true,
      message: otpSent ? 'New OTP sent to your WhatsApp' : 'New OTP generated',
      phoneNumber: phoneNumber.slice(0, 4) + '****' + phoneNumber.slice(-3),
      expiresIn: 600,
      otpSentVia: otpSentVia
    });
  } catch (err) {
    next(err);
  }
}

// Register WhatsApp number on platform - Step 3
async function registerWhatsAppNumber(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!workspace.whatsappSetup || workspace.whatsappSetup.status !== 'otp_verified') {
      return res.status(400).json({ message: 'Please verify your phone number first' });
    }

    // Update status to registering
    workspace.whatsappSetup.status = 'registering';
    workspace.whatsappSetup.registrationStartedAt = new Date();
    await workspace.save();

    // In production, this would initiate the Meta WhatsApp Business API registration
    // For now, we simulate the registration process
    console.log(`🔄 Starting registration for ${workspace.whatsappSetup.requestedNumber}`);

    // Simulate async registration (in production, this would be a webhook callback)
    // For demo, we'll mark as pending_activation
    setTimeout(async () => {
      try {
        const ws = await Workspace.findById(workspace._id);
        if (ws && ws.whatsappSetup.status === 'registering') {
          ws.whatsappSetup.status = 'pending_activation';
          ws.whatsappSetup.registrationCompletedAt = new Date();
          await ws.save();
          console.log(`📋 Registration submitted for ${ws.whatsappSetup.requestedNumber}, pending admin activation`);
        }
      } catch (e) {
        console.error('Registration update error:', e);
      }
    }, 3000);

    res.json({
      success: true,
      message: 'Registration initiated. Your number is being processed.',
      step: 'pending_activation',
      estimatedTime: workspace.whatsappSetup.hasExistingAccount ? '2-4 hours' : '4-6 hours'
    });
  } catch (err) {
    next(err);
  }
}

// Get WhatsApp activation status
async function getWhatsAppActivationStatus(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const setup = workspace.whatsappSetup || {};
    const isConnected = !!(workspace.whatsappAccessToken && workspace.whatsappPhoneNumberId);

    // Determine current step
    let currentStep = 'not_started';
    let stepNumber = 0;
    
    if (isConnected) {
      currentStep = 'activated';
      stepNumber = 5;
    } else if (setup.status === 'connected') {
      currentStep = 'activated';
      stepNumber = 5;
    } else if (setup.status === 'pending_activation') {
      currentStep = 'pending_activation';
      stepNumber = 4;
    } else if (setup.status === 'registering') {
      currentStep = 'registering';
      stepNumber = 3;
    } else if (setup.status === 'otp_verified') {
      currentStep = 'otp_verified';
      stepNumber = 2;
    } else if (setup.status === 'otp_sent') {
      currentStep = 'otp_verification';
      stepNumber = 1;
    }

    res.json({
      success: true,
      isConnected,
      status: setup.status || 'not_started',
      currentStep,
      stepNumber,
      phoneNumber: setup.requestedNumber,
      maskedPhoneNumber: setup.requestedNumber 
        ? setup.requestedNumber.slice(0, 4) + '****' + setup.requestedNumber.slice(-3) 
        : null,
      hasExistingAccount: setup.hasExistingAccount,
      requestedAt: setup.requestedAt,
      verifiedAt: setup.verifiedAt,
      estimatedActivation: setup.status === 'pending_activation' 
        ? (setup.hasExistingAccount ? '2-4 hours' : '4-6 hours') 
        : null,
      connectedNumber: workspace.whatsappPhoneNumberId,
      connectedAt: workspace.connectedAt
    });
  } catch (err) {
    next(err);
  }
}

// Get business verification status - checks from Meta API and updates local status
async function getVerificationStatus(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Try to fetch real status from Meta if connected
    let metaStatus = null;
    if (workspace.businessAccountId && workspace.whatsappAccessToken) {
      try {
        const metaService = require('../services/metaService');
        metaStatus = await metaService.getBusinessVerificationStatus(
          workspace.whatsappAccessToken,
          workspace.businessAccountId
        );

        // Update local status based on Meta response
        if (metaStatus.success) {
          if (!workspace.businessVerification) {
            workspace.businessVerification = {};
          }
          
          workspace.businessVerification.status = metaStatus.status;
          workspace.businessVerification.lastCheckedAt = new Date();
          
          if (metaStatus.status === 'verified') {
            workspace.businessVerification.verifiedAt = new Date();
          }
          
          await workspace.save();
        }
      } catch (metaErr) {
        console.error('Failed to fetch verification status from Meta:', metaErr.message);
        // Continue with local status
      }
    }

    const status = workspace.businessVerification?.status || 'not_submitted';
    const isVerified = status === 'verified';

    res.json({
      success: true,
      workspace: {
        verification: {
          status: status,
          isVerified: isVerified,
          details: workspace.businessVerification,
          message: getVerificationMessage(status),
          metaStatus: metaStatus
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

// Helper function to get user-friendly verification message
function getVerificationMessage(status) {
  const messages = {
    'not_submitted': 'Business verification not yet submitted. Please submit your GST or MSME number.',
    'pending': 'Business verification submitted and pending review.',
    'in_review': 'Business verification is currently under review by Meta.',
    'verified': 'Congratulations! Your business is verified.',
    'rejected': 'Business verification was rejected. Please check the rejection reason and resubmit.',
    'test_mode': 'Business is in test mode - all features enabled for testing.'
  };
  return messages[status] || 'Unknown verification status';
}

// Check if user can access features based on verification
async function checkFeatureAccess(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const verificationStatus = workspace.businessVerification?.status || 'not_submitted';
    const isTestMode = workspace.businessVerification?.isTestMode || false;
    const isVerified = verificationStatus === 'verified';

    // Allow access if verified OR in test mode
    const canAccess = isVerified || isTestMode;

    res.json({
      success: true,
      canAccess: canAccess,
      isVerified: isVerified,
      isTestMode: isTestMode,
      status: verificationStatus,
      message: canAccess 
        ? 'Access granted' 
        : 'Please complete business verification to access all features'
    });
  } catch (err) {
    next(err);
  }
}

// Get Meta configuration for Embedded Signup
async function getMetaConfig(req, res, next) {
  try {
    const config = require('../config');
    
    res.json({
      success: true,
      appId: config.metaAppId || config.facebookAppId || '',
      configId: config.metaConfigId || '',
      sdkVersion: 'v21.0'
    });
  } catch (err) {
    next(err);
  }
}

// Handle Embedded Signup - Exchange token for WABA info
async function handleEmbeddedSignup(req, res, next) {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Access token is required' 
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const metaService = require('../services/metaService');
    const config = require('../config');

    // Exchange short-lived token for long-lived token
    let longLivedToken = accessToken;
    try {
      const tokenExchangeResult = await metaService.exchangeToken(
        accessToken,
        config.metaAppId || config.facebookAppId,
        config.metaAppSecret || config.facebookAppSecret
      );
      if (tokenExchangeResult.success) {
        longLivedToken = tokenExchangeResult.accessToken;
        console.log('✅ Exchanged for long-lived token');
      }
    } catch (tokenErr) {
      console.log('⚠️ Token exchange failed, using original token:', tokenErr.message);
    }

    // Debug token to get WABA info
    const debugInfo = await metaService.debugTokenInfo(longLivedToken);
    
    if (!debugInfo.tokenValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired access token'
      });
    }

    // Try to find WABA and phone number from the token
    let wabaId = null;
    let phoneNumberId = null;
    let displayNumber = null;
    let verifiedName = null;

    // Check if we have WABA accounts
    if (debugInfo.wabaAccounts && debugInfo.wabaAccounts.length > 0) {
      wabaId = debugInfo.wabaAccounts[0].id;
      
      // Get phone numbers for this WABA
      try {
        const phoneInfo = await metaService.getWABAPhoneNumbers(longLivedToken, wabaId);
        if (phoneInfo.phoneNumbers && phoneInfo.phoneNumbers.length > 0) {
          const phone = phoneInfo.phoneNumbers[0];
          phoneNumberId = phone.id;
          displayNumber = phone.displayPhoneNumber;
          verifiedName = phone.verifiedName;
        }
      } catch (phoneErr) {
        console.log('Could not get phone numbers:', phoneErr.message);
      }
    }

    if (!wabaId) {
      return res.status(400).json({
        success: false,
        message: 'No WhatsApp Business Account found. Please complete the signup process in the Facebook dialog.',
        debugInfo: config.env === 'development' ? debugInfo : undefined
      });
    }

    // Save to workspace
    workspace.whatsappAccessToken = longLivedToken;
    workspace.wabaId = wabaId;
    workspace.businessAccountId = debugInfo.businessAccounts?.[0]?.id || wabaId;
    
    if (phoneNumberId) {
      workspace.whatsappPhoneNumberId = phoneNumberId;
      workspace.whatsappPhoneNumber = displayNumber;
      workspace.connectedAt = new Date();
      
      if (!workspace.whatsappSetup) {
        workspace.whatsappSetup = {};
      }
      workspace.whatsappSetup.status = 'connected';
      workspace.whatsappSetup.completedAt = new Date();
    }

    // Mark onboarding step
    if (!workspace.onboarding) {
      workspace.onboarding = {};
    }
    workspace.onboarding.wabaConnectionCompleted = true;
    workspace.onboarding.wabaConnectionCompletedAt = new Date();

    await workspace.save();

    console.log(`✅ Embedded signup completed for workspace ${workspace._id}`);
    console.log(`   WABA ID: ${wabaId}`);
    console.log(`   Phone ID: ${phoneNumberId}`);

    res.json({
      success: true,
      message: 'WhatsApp Business Account connected successfully',
      data: {
        wabaId: wabaId,
        phoneNumberId: phoneNumberId,
        displayNumber: displayNumber,
        verifiedName: verifiedName,
        isConnected: !!phoneNumberId
      }
    });
  } catch (err) {
    console.error('Embedded signup error:', err);
    next(err);
  }
}

/**
 * ================================================================
 * NEW: EMBEDDED SIGNUP BUSINESS (ESB) FLOW - FULLY AUTOMATED
 * ================================================================
 * These new endpoints implement the complete Meta ESB flow
 * for automated WhatsApp Business onboarding
 */

// Step 1: Start Embedded Signup - Generate ESB URL
async function startEmbeddedSignupFlow(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const metaAutomationService = require('../services/metaAutomationService');
    const callbackUrl = `${process.env.APP_URL || 'http://localhost:5000'}/api/onboarding/esb/callback`;

    const esbResult = await metaAutomationService.generateEmbeddedSignupURL(
      user._id,
      callbackUrl
    );

    // Save state in workspace for later verification
    if (!workspace.esbFlow) {
      workspace.esbFlow = {};
    }
    workspace.esbFlow.status = 'signup_initiated';
    workspace.esbFlow.authState = esbResult.state;
    workspace.esbFlow.callbackState = esbResult.state;
    workspace.esbFlow.startedAt = new Date();
    workspace.esbFlow.createdBy = user.email;
    await workspace.save();

    console.log(`[ESB] 📋 Started for user: ${user.email}, workspace: ${workspace._id}, timestamp: ${new Date().toISOString()}`);

    res.json({
      success: true,
      message: 'ESB flow initiated',
      url: esbResult.url,
      state: esbResult.state,
      configId: esbResult.configId
    });
  } catch (error) {
    console.error('[ESB] ❌ Error starting ESB flow:', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      timestamp: new Date().toISOString()
    });
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

// Step 2: Handle OAuth Callback from Meta
async function processEsbCallback(req, res, next) {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing code or state parameter'
      });
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User session not found. Please sign in first.'
      });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    // Idempotency check - return cached result if already processed
    const { generateIdempotencyKey, checkIdempotency, storeIdempotencyResult } = require('../utils/idempotency');
    const idempotencyKey = generateIdempotencyKey('esb_callback', { workspaceId: workspace._id.toString(), code, state });
    
    const cachedResult = checkIdempotency(idempotencyKey);
    if (cachedResult) {
      console.log(`[ESB] Returning cached result for workspace ${workspace._id}`);
      return res.json(cachedResult);
    }

    // Check if already completed
    if (workspace.esbFlow?.status === 'completed') {
      const result = {
        success: true,
        message: 'WhatsApp Business already connected',
        data: {
          businessAccountId: workspace.businessAccountId,
          wabaId: workspace.wabaId,
          phoneNumber: workspace.whatsappPhoneNumber,
          phoneNumberId: workspace.whatsappPhoneNumberId,
          status: 'completed'
        }
      };
      storeIdempotencyResult(idempotencyKey, result);
      return res.json(result);
    }

    // Verify state for CSRF protection
    const metaAutomationService = require('../services/metaAutomationService');
    const { whatsappToken, metaBusinessId, metaWabaId } = require('../config');
    if (!metaAutomationService.verifyCallbackState(state, workspace.esbFlow?.callbackState)) {
      console.error('[ESB] State verification failed for workspace:', workspace._id);
      return res.status(400).json({
        success: false,
        message: 'State verification failed. This request may be fraudulent.'
      });
    }

    // Check code expiry
    if (workspace.esbFlow?.authCodeExpiresAt && new Date() > new Date(workspace.esbFlow.authCodeExpiresAt)) {
      console.error('[ESB] Authorization code expired for workspace:', workspace._id);
      
      // ✅ VALIDATE STATE TRANSITION: any valid state → failed
      const currentState = workspace.esbFlow.status || 'not_started';
      if (!validateESBStateTransition(currentState, 'failed')) {
        console.error(`[ESB State Machine] Cannot transition to failed from: ${currentState}`);
      }
      
      workspace.esbFlow.status = 'failed';
      workspace.esbFlow.failureReason = 'Authorization code expired. Code is valid for 10 minutes only.';
      workspace.esbFlow.failedAt = new Date();
      await workspace.save();
      
      // Return clear error with recovery action
      return res.status(410).json({
        success: false,
        message: 'Authorization code expired',
        code: 'CODE_EXPIRED',
        reason: 'The authorization code is only valid for 10 minutes. Your session has expired.',
        action: 'restart_flow',
        actionMessage: 'Please click "Start WhatsApp Setup" again to begin a fresh signup flow.',
        recoveryUrl: '/onboarding/esb'
      });
    }

    // Step 1: Exchange code for access token
    const callbackUrl = `${process.env.APP_URL || 'http://localhost:5000'}/api/onboarding/esb/callback`;
    const tokenResult = await metaAutomationService.exchangeCodeForToken(code, callbackUrl);

    // Step 2: Extract the system user token that Meta created in ESB
    // ⚠️ CRITICAL: Meta's ESB creates a system user and token automatically
    // We need to find this system user and extract its token
    const businessAccountId = metaBusinessId || tokenResult.userInfo?.businessAccounts?.[0]?.id;
    const systemUserToken = await metaAutomationService.getSystemUserToken(
      tokenResult.accessToken,
      businessAccountId
    );

    // Step 3: Store everything in database
    if (!workspace.esbFlow) {
      workspace.esbFlow = {};
    }

    // ✅ VALIDATE STATE TRANSITION: only valid transitions allowed
    const currentState = workspace.esbFlow.status || 'not_started';
    const targetState = 'token_exchanged';
    if (!validateESBStateTransition(currentState, targetState)) {
      console.error(`[ESB State Machine] Invalid transition: ${currentState} → ${targetState}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid ESB flow state. Please restart the signup process.',
        code: 'INVALID_STATE_TRANSITION'
      });
    }

    // Encrypt and save all tokens
    const { encrypt } = require('../utils/encryption');
    const workspaceId = workspace._id.toString();
    
    workspace.esbFlow.status = targetState; // Use validated state
    workspace.esbFlow.authCode = code; // No need to encrypt code, it's single-use
    
    // Encrypt tokens before storage
    workspace.esbFlow.adminAccessToken = whatsappToken ? encrypt(whatsappToken, workspaceId) : encrypt(tokenResult.accessToken, workspaceId);
    workspace.esbFlow.userAccessToken = encrypt(tokenResult.accessToken, workspaceId);
    
    // ✅ GAP 4: Handle missing refresh tokens gracefully
    if (tokenResult.refreshToken) {
      workspace.esbFlow.userRefreshToken = encrypt(tokenResult.refreshToken, workspaceId);
      workspace.esbFlow.hasRefreshToken = true;
    } else {
      workspace.esbFlow.userRefreshToken = null;
      workspace.esbFlow.hasRefreshToken = false;
      console.warn(`[ESB] ⚠️ No refresh token provided by Meta for workspace ${workspace._id}. Token refresh may require manual intervention after 60 days.`);
    }
    
    workspace.esbFlow.tokenExpiry = new Date(Date.now() + (tokenResult.expiresIn * 1000));

    // ✅ KEY: Save the encrypted system user token
    workspace.esbFlow.systemUserToken = encrypt(systemUserToken.token, workspaceId);
    workspace.esbFlow.systemUserTokenExpiry = new Date(Date.now() + (systemUserToken.expiresIn * 1000));
    workspace.esbFlow.systemUserId = systemUserToken.userId;
    
    // ✅ VALIDATE STATE TRANSITION: token_exchanged → completed
    const completionState = 'completed';
    if (!validateESBStateTransition(targetState, completionState)) {
      console.error(`[ESB State Machine] Invalid transition: ${targetState} → ${completionState}`);
      workspace.esbFlow.status = 'failed';
      workspace.esbFlow.failureReason = 'State machine validation failed';
      await workspace.save();
      return res.status(500).json({
        success: false,
        message: 'Failed to complete ESB flow due to state validation'
      });
    }
    
    workspace.esbFlow.status = completionState; // Use validated state
    
    console.log(`[ESB] ✅ Tokens encrypted and stored for workspace ${workspace._id}`);

    // ✅ VALIDATE WABA & PHONE OWNERSHIP
    const wabaId = metaWabaId || tokenResult.userInfo?.wabaAccounts?.[0]?.id;
    const phoneData = tokenResult.userInfo?.phoneNumbers?.[0];
    
    if (!wabaId || !phoneData) {
      console.error('[ESB] ❌ Missing WABA or phone number in token response');
      workspace.esbFlow.status = 'failed';
      workspace.esbFlow.failureReason = 'Invalid WABA or phone number from Meta';
      await workspace.save();
      return res.status(400).json({
        success: false,
        message: 'Failed to retrieve valid WABA or phone number',
        code: 'INVALID_WABA_PHONE'
      });
    }

    // ✅ VALIDATE phone belongs to the WABA
    if (phoneData.wabaId && phoneData.wabaId !== wabaId) {
      console.error(`[ESB] ❌ Phone number does not belong to selected WABA. Phone WABA: ${phoneData.wabaId}, Selected WABA: ${wabaId}`);
      workspace.esbFlow.status = 'failed';
      workspace.esbFlow.failureReason = 'Phone number does not belong to the selected WABA';
      await workspace.save();
      return res.status(400).json({
        success: false,
        message: 'Phone number validation failed: number does not belong to your WABA',
        code: 'PHONE_WABA_MISMATCH'
      });
    }

    // ✅ VALIDATE phone is verified/active (if Meta provides verification status)
    if (phoneData.verified_name && phoneData.verified_name.length === 0) {
      console.warn(`[ESB] ⚠️ Phone number not yet verified in Meta: ${phoneData.id}`);
      // Warn but don't fail - phone may be pending verification
    }

    // Save business and WABA info
    workspace.businessAccountId = businessAccountId;
    workspace.wabaId = wabaId;
    workspace.whatsappPhoneNumberId = phoneData.id;
    workspace.whatsappPhoneNumber = phoneData.display_phone_number;
    
    // Store validation metadata for auditing
    workspace.esbFlow.phoneValidation = {
      validatedAt: new Date(),
      phoneId: phoneData.id,
      wabaId: wabaId,
      ownershipVerified: true
    };

    // Mark as completed
    workspace.esbFlow.callbackReceived = true;
    workspace.esbFlow.callbackReceivedAt = new Date();
    workspace.esbFlow.callbackData = tokenResult.userInfo;
    workspace.esbFlow.completedAt = new Date();
    workspace.connectedAt = new Date();

    // Update legacy fields for backward compatibility (also encrypted)
    workspace.whatsappAccessToken = encrypt(systemUserToken.token, workspaceId);

    // Persist configured Meta identifiers for downstream automation
    workspace.esbFlow.metaBusinessId = businessAccountId;
    workspace.esbFlow.parentWabaId = workspace.wabaId;

    await workspace.save();

    // 🔒 Lock plan limits after ESB success
    try {
      const messageLimitsByPlan = {
        free: 1000,
        basic: 10000,
        premium: 100000,
        enterprise: -1 // unlimited
      };

      const templateLimitsByPlan = {
        free: 5,
        basic: 25,
        premium: 100,
        enterprise: -1 // unlimited
      };

      const planName = workspace.plan || 'free';
      workspace.messagingLimits = {
        daily: messageLimitsByPlan[planName] || 1000,
        monthly: messageLimitsByPlan[planName] * 30 || 30000,
        plan: planName,
        appliedAt: new Date()
      };

      workspace.templateLimits = {
        max: templateLimitsByPlan[planName] || 5,
        plan: planName,
        appliedAt: new Date()
      };

      await workspace.save();
      console.log(`[ESB] 🔒 Plan limits locked for workspace: ${workspace._id}, plan: ${planName}`);
    } catch (limitErr) {
      console.warn('[ESB] Warning: Failed to lock plan limits:', limitErr.message);
      // Don't fail the entire ESB flow if limits fail
    }

    console.log(`[ESB] ✅ Onboarding completed for workspace: ${workspace._id}`);

    // ✅ TRIGGER: Generate personalized starter templates (non-blocking)
    // Templates are generated asynchronously to avoid blocking the ESB callback response
    try {
      const templateGenerationService = require('../services/templateGenerationService');
      
      // Generate in background - don't await, don't block response
      templateGenerationService.generateAndSubmitTemplates(workspace).then(result => {
        if (result.success) {
          console.log(`[Templates] ✅ Auto-templates generated for workspace ${workspace._id}: ${result.created} templates`);
        } else {
          console.warn(`[Templates] ⚠️ Failed to generate auto-templates: ${result.reason}`);
        }
      }).catch(err => {
        console.error(`[Templates] ❌ Template generation error:`, err.message);
      });
    } catch (templateErr) {
      // Silent fail - don't block ESB if template generation service has issues
      console.warn(`[Templates] ⚠️ Could not trigger template generation:`, templateErr.message);
    }

    const result = {
      success: true,
      message: 'WhatsApp Business connected successfully!',
      data: {
        businessAccountId: workspace.businessAccountId,
        wabaId: workspace.wabaId,
        phoneNumber: workspace.whatsappPhoneNumber,
        phoneNumberId: workspace.whatsappPhoneNumberId,
        status: 'completed'
      }
    };
    
    // Store for idempotency
    storeIdempotencyResult(idempotencyKey, result);
    
    res.json(result);
  } catch (err) {
    console.error('[ESB] ❌ Callback processing error:', {
      error: err.message,
      stack: err.stack,
      workspaceId: req.user?.workspaceId,
      userId: req.user?._id,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({
      success: false,
      message: 'Failed to process ESB callback: ' + err.message
    });
  }
}

async function handleEsbCallback(req, res, next) {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('[ESB] Callback error:', error, error_description);
      const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/esb?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(error_description || error)}`;
      return res.redirect(frontendUrl);
    }

    if (!code || !state) {
      console.error('[ESB] Missing code or state in callback');
      const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/esb?error=missing_params`;
      return res.redirect(frontendUrl);
    }

    // Find workspace by state to verify it's legitimate
    const workspace = await Workspace.findOne({ 
      'esbFlow.callbackState': state,
      'esbFlow.status': 'signup_initiated'
    });

    if (!workspace) {
      console.error('[ESB] Invalid state - no matching workspace found:', state);
      const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/esb?error=invalid_state`;
      return res.redirect(frontendUrl);
    }

    // Verify state for CSRF protection
    const metaAutomationService = require('../services/metaAutomationService');
    if (!metaAutomationService.verifyCallbackState(state, workspace.esbFlow.callbackState)) {
      console.error('[ESB] State verification failed for workspace:', workspace._id);
      const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/esb?error=state_verification_failed`;
      return res.redirect(frontendUrl);
    }

    // Store code temporarily in workspace (10 minute expiry)
    workspace.esbFlow.authCode = code;
    workspace.esbFlow.authCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    workspace.esbFlow.status = 'code_received';
    workspace.esbFlow.callbackReceived = true;
    workspace.esbFlow.callbackReceivedAt = new Date();
    await workspace.save();

    console.log(`[ESB] Code received and stored for workspace ${workspace._id}`);

    // Redirect to frontend with success (code will be processed via authenticated endpoint)
    const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/esb?callback_received=true&state=${encodeURIComponent(state)}`;
    res.redirect(frontendUrl);
  } catch (err) {
    console.error('[ESB] Callback processing error:', err.message);
    const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/esb?error=processing_error`;
    res.redirect(frontendUrl);
  }
}

// Get Complete ESB Status
async function getESBStatus(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const esbStatus = workspace.esbFlow || {};
    const wabaInfo = {
      wabaId: workspace.wabaId,
      businessAccountId: workspace.businessAccountId,
      phoneNumberId: workspace.whatsappPhoneNumberId,
      phoneNumber: workspace.whatsappPhoneNumber,
      connectedAt: workspace.connectedAt
    };

    res.json({
      success: true,
      esbStatus: {
        status: esbStatus.status,
        startedAt: esbStatus.startedAt,
        completedAt: esbStatus.completedAt,
        createdBy: esbStatus.createdBy,
        callbackReceivedAt: esbStatus.callbackReceivedAt
      },
      wabaInfo: wabaInfo,
      planLimits: {
        messaging: workspace.messagingLimits,
        templates: workspace.templateLimits,
        plan: workspace.plan
      },
      onboarding: workspace.onboarding
    });
  } catch (error) {
    console.error('[ESB] ❌ Error getting ESB status:', {
      error: error.message,
      userId: req.user._id,
      timestamp: new Date().toISOString()
    });
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

// Process stored callback code (triggered by frontend after redirect)
async function processStoredCallback(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    // Check if callback was received
    if (!workspace.esbFlow?.callbackReceived || !workspace.esbFlow?.authCode) {
      return res.status(400).json({
        success: false,
        message: 'No callback code available. Please restart the signup flow.',
        code: 'NO_CALLBACK_CODE'
      });
    }

    // Check if already processed
    if (workspace.esbFlow.status === 'completed') {
      return res.json({
        success: true,
        message: 'WhatsApp Business already connected',
        data: {
          businessAccountId: workspace.businessAccountId,
          wabaId: workspace.wabaId,
          phoneNumber: workspace.whatsappPhoneNumber,
          phoneNumberId: workspace.whatsappPhoneNumberId,
          status: 'completed'
        }
      });
    }

    // Check if currently processing
    if (['token_exchanged'].includes(workspace.esbFlow.status)) {
      return res.json({
        success: true,
        message: 'Processing in progress...',
        status: workspace.esbFlow.status
      });
    }

    // Use stored code and state to process
    const code = workspace.esbFlow.authCode;
    const state = workspace.esbFlow.callbackState;

    // Process via the existing processEsbCallback logic by setting req.body
    req.body = { code, state };
    return processEsbCallback(req, res, next);

  } catch (error) {
    console.error('[ESB] ❌ Error processing stored callback:', {
      error: error.message,
      userId: req.user._id,
      timestamp: new Date().toISOString()
    });
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

// Complete Embedded Signup - Save phone number and WABA details
async function completeEmbeddedSignup(req, res, next) {
  try {
    const { phoneNumberId, wabaId } = req.body;
    
    if (!phoneNumberId || !wabaId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number ID and WABA ID are required' 
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    // Get phone number details from Meta
    let displayNumber = null;
    let verifiedName = null;
    
    if (workspace.whatsappAccessToken) {
      try {
        const metaService = require('../services/metaService');
        const phoneInfo = await metaService.getPhoneNumberInfo(
          workspace.whatsappAccessToken,
          phoneNumberId
        );
        displayNumber = phoneInfo.displayNumber;
        verifiedName = phoneInfo.verifiedName;
      } catch (phoneErr) {
        console.log('Could not get phone number details:', phoneErr.message);
      }
    }

    // Update workspace
    workspace.wabaId = wabaId;
    workspace.whatsappPhoneNumberId = phoneNumberId;
    workspace.whatsappPhoneNumber = displayNumber;
    workspace.connectedAt = new Date();

    if (!workspace.whatsappSetup) {
      workspace.whatsappSetup = {};
    }
    workspace.whatsappSetup.status = 'connected';
    workspace.whatsappSetup.completedAt = new Date();
    workspace.whatsappSetup.requestedNumber = displayNumber;

    if (!workspace.onboarding) {
      workspace.onboarding = {};
    }
    workspace.onboarding.wabaConnectionCompleted = true;
    workspace.onboarding.wabaConnectionCompletedAt = new Date();

    await workspace.save();

    console.log(`✅ Embedded signup finalized for workspace ${workspace._id}`);

    res.json({
      success: true,
      message: 'WhatsApp Business setup completed',
      data: {
        phoneNumberId: phoneNumberId,
        wabaId: wabaId,
        displayNumber: displayNumber,
        verifiedName: verifiedName,
        isConnected: true
      }
    });
  } catch (err) {
    console.error('Complete embedded signup error:', err);
    next(err);
  }
}

module.exports = {
  saveBusinessInfo,
  getOnboardingStatus,
  updateOnboardingStep,
  completeOnboarding,
  connectWhatsApp,
  verifyWhatsAppOTP,
  resendWhatsAppOTP,
  registerWhatsAppNumber,
  getWhatsAppActivationStatus,
  getVerificationStatus,
  checkFeatureAccess,
  getMetaConfig,
  handleEmbeddedSignup,
  completeEmbeddedSignup,
  // New ESB Flow
  startEmbeddedSignupFlow,
  handleEsbCallback,
  processEsbCallback,
  processStoredCallback,
  getESBStatus
};
