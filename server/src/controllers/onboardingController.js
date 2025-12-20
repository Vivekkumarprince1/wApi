const User = require('../models/User');
const Workspace = require('../models/Workspace');

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

    console.log(`[ESB] Started for user: ${user.email}, workspace: ${workspace._id}`);

    res.json({
      success: true,
      message: 'ESB flow initiated',
      esbUrl: esbResult.url,
      state: esbResult.state,
      configId: esbResult.configId
    });
  } catch (error) {
    console.error('Error starting ESB flow:', error.message);
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

    // Verify state for CSRF protection
    const metaAutomationService = require('../services/metaAutomationService');
    if (!metaAutomationService.verifyCallbackState(state, workspace.esbFlow?.callbackState)) {
      console.error('[ESB] State verification failed for workspace:', workspace._id);
      return res.status(400).json({
        success: false,
        message: 'State verification failed. This request may be fraudulent.'
      });
    }

    // Exchange code for token
    const callbackUrl = `${process.env.APP_URL || 'http://localhost:5000'}/api/onboarding/esb/callback`;
    const tokenResult = await metaAutomationService.exchangeCodeForToken(code, callbackUrl);

    // Save token and callback data
    if (!workspace.esbFlow) {
      workspace.esbFlow = {};
    }
    workspace.esbFlow.status = 'token_exchanged';
    workspace.esbFlow.authCode = code;
    workspace.esbFlow.userAccessToken = tokenResult.accessToken;
    workspace.esbFlow.userRefreshToken = tokenResult.refreshToken;
    workspace.esbFlow.tokenExpiry = new Date(Date.now() + (tokenResult.expiresIn * 1000));
    workspace.esbFlow.callbackReceived = true;
    workspace.esbFlow.callbackReceivedAt = new Date();
    workspace.esbFlow.callbackData = tokenResult.userInfo;
    await workspace.save();

    console.log(`[ESB] Token exchanged for workspace: ${workspace._id}`);

    res.json({
      success: true,
      message: 'Authorization successful',
      userInfo: tokenResult.userInfo,
      nextStep: 'business_verify'
    });
  } catch (err) {
    console.error('[ESB] Callback processing error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to process authorization: ' + err.message
    });
  }
}

async function handleEsbCallback(req, res, next) {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('[ESB] Callback error:', error, error_description);
      // Redirect to frontend callback page with error
      const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding/esb/callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(error_description || error)}`;
      return res.redirect(frontendUrl);
    }

    if (!code || !state) {
      const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding/esb/callback?error=missing_params`;
      return res.redirect(frontendUrl);
    }

    // For now, we'll store the code/state in a temporary session
    // In production, you might want to use Redis or a database to store this temporarily
    const tempSessionKey = `esb_${state}`;
    // Store code and state temporarily (you'd use Redis in production)
    global.tempESBSessions = global.tempESBSessions || {};
    global.tempESBSessions[tempSessionKey] = { code, state, timestamp: Date.now() };

    // Redirect to frontend with success
    const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding/esb/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    res.redirect(frontendUrl);
  } catch (err) {
    console.error('[ESB] Callback processing error:', err.message);
    const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding/esb/callback?error=processing_error`;
    res.redirect(frontendUrl);
  }
}

// Step 3: Verify Business Account and Get/Create WABA
async function verifyBusinessAndWABA(req, res, next) {
  try {
    const { businessAccountId, businessData } = req.body;

    if (!businessAccountId || !businessData) {
      return res.status(400).json({
        success: false,
        message: 'Business account ID and business data are required'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace || !workspace.esbFlow?.userAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'ESB flow not initiated or token expired. Please start again.'
      });
    }

    const metaAutomationService = require('../services/metaAutomationService');
    const verifyResult = await metaAutomationService.verifyBusinessAccount(
      workspace.esbFlow.userAccessToken,
      businessAccountId,
      businessData
    );

    // Update workspace
    workspace.businessAccountId = verifyResult.businessAccountId;
    workspace.wabaId = verifyResult.wabaId;
    workspace.esbFlow.status = 'business_verified';
    workspace.esbFlow.businessAccountId = businessAccountId;
    await workspace.save();

    console.log(`[ESB] Business verified for workspace: ${workspace._id}`);

    res.json({
      success: true,
      message: 'Business verified successfully',
      businessAccountId: verifyResult.businessAccountId,
      wabaId: verifyResult.wabaId,
      nextStep: 'register_phone'
    });
  } catch (error) {
    console.error('Error verifying business:', error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

// Step 4: Register Phone Number and Request OTP
async function registerPhoneAndSendOTP(req, res, next) {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace || !workspace.esbFlow?.userAccessToken || !workspace.wabaId) {
      return res.status(400).json({
        success: false,
        message: 'ESB flow not in correct state. Please start from beginning.'
      });
    }

    const metaAutomationService = require('../services/metaAutomationService');

    // Register phone number
    const phoneRegResult = await metaAutomationService.requestPhoneNumberRegistration(
      workspace.esbFlow.userAccessToken,
      workspace.wabaId,
      phoneNumber
    );

    // Send OTP
    const otpResult = await metaAutomationService.sendPhoneNumberOTP(
      workspace.esbFlow.userAccessToken,
      phoneRegResult.phoneNumberId
    );

    // Update workspace
    workspace.esbFlow.status = 'otp_sent';
    workspace.esbFlow.phoneNumberIdForOTP = phoneRegResult.phoneNumberId;
    workspace.esbFlow.phoneOTPExpiry = new Date(Date.now() + 600000); // 10 minutes
    workspace.whatsappPhoneNumber = phoneNumber;
    await workspace.save();

    console.log(`[ESB] Phone registered and OTP sent for workspace: ${workspace._id}`);

    res.json({
      success: true,
      message: 'Phone number registered. OTP sent via SMS.',
      phoneNumberId: phoneRegResult.phoneNumberId,
      displayNumber: phoneRegResult.displayNumber,
      expiresIn: 600,
      nextStep: 'verify_otp'
    });
  } catch (error) {
    console.error('Error registering phone:', error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

// Step 5: Verify OTP Code
async function verifyPhoneOTP(req, res, next) {
  try {
    const { otpCode } = req.body;

    if (!otpCode) {
      return res.status(400).json({
        success: false,
        message: 'OTP code is required'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace || !workspace.esbFlow?.userAccessToken || !workspace.esbFlow.phoneNumberIdForOTP) {
      return res.status(400).json({
        success: false,
        message: 'OTP verification not initiated. Please register phone first.'
      });
    }

    // Check OTP expiry
    if (new Date() > new Date(workspace.esbFlow.phoneOTPExpiry)) {
      workspace.esbFlow.status = 'otp_expired';
      await workspace.save();
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Check attempts
    workspace.esbFlow.phoneOTPAttempts = (workspace.esbFlow.phoneOTPAttempts || 0) + 1;
    if (workspace.esbFlow.phoneOTPAttempts > 5) {
      workspace.esbFlow.status = 'otp_failed';
      await workspace.save();
      return res.status(400).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new OTP.'
      });
    }

    const metaAutomationService = require('../services/metaAutomationService');
    const verifyResult = await metaAutomationService.verifyPhoneNumberCode(
      workspace.esbFlow.userAccessToken,
      workspace.esbFlow.phoneNumberIdForOTP,
      otpCode
    );

    // Update workspace
    workspace.esbFlow.status = 'otp_verified';
    workspace.esbFlow.phoneOTPVerifiedAt = new Date();
    workspace.esbFlow.phoneOTPCode = null; // Clear OTP
    workspace.esbFlow.phoneOTPExpiry = null;
    workspace.esbFlow.phoneOTPAttempts = 0;
    workspace.whatsappPhoneNumberId = verifyResult.phoneNumberId;
    await workspace.save();

    console.log(`[ESB] Phone OTP verified for workspace: ${workspace._id}`);

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      phoneNumberId: verifyResult.phoneNumberId,
      displayPhone: verifyResult.displayPhone,
      verifiedName: verifyResult.verifiedName,
      nextStep: 'create_system_user'
    });
  } catch (error) {
    console.error('Error verifying OTP:', error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

// Step 6: Create System User for Token Generation
async function createSystemUserAndToken(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace || !workspace.esbFlow?.userAccessToken || !workspace.businessAccountId) {
      return res.status(400).json({
        success: false,
        message: 'ESB flow not in correct state'
      });
    }

    const metaAutomationService = require('../services/metaAutomationService');
    const systemUserResult = await metaAutomationService.createSystemUser(
      workspace.esbFlow.userAccessToken,
      workspace.businessAccountId,
      `system_user_${workspace.name.replace(/\s+/g, '_')}_${Date.now()}`
    );

    // Update workspace
    workspace.esbFlow.status = 'system_user_created';
    workspace.esbFlow.systemUserId = systemUserResult.systemUserId;
    workspace.esbFlow.systemUserToken = systemUserResult.accessToken;
    workspace.esbFlow.systemUserTokenExpiry = new Date(Date.now() + (systemUserResult.expiresIn * 1000));
    await workspace.save();

    console.log(`[ESB] System user created for workspace: ${workspace._id}`);

    res.json({
      success: true,
      message: 'System user created and token generated',
      systemUserId: systemUserResult.systemUserId,
      systemUserToken: systemUserResult.accessToken,
      expiresIn: systemUserResult.expiresIn,
      nextStep: 'activate_waba'
    });
  } catch (error) {
    console.error('Error creating system user:', error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

// Step 7: Activate WABA - Update Settings
async function activateWABA(req, res, next) {
  try {
    const { displayName, about } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workspace = await Workspace.findById(user.workspace);
    if (!workspace || !workspace.esbFlow?.userAccessToken || !workspace.wabaId) {
      return res.status(400).json({
        success: false,
        message: 'ESB flow not in correct state'
      });
    }

    const metaAutomationService = require('../services/metaAutomationService');
    const wabaResult = await metaAutomationService.updateWABASettings(
      workspace.esbFlow.userAccessToken,
      workspace.wabaId,
      {
        displayName: displayName || workspace.name,
        about: about || 'Welcome to our business',
        industry: workspace.industry
      }
    );

    // Get complete onboarding status
    const statusResult = await metaAutomationService.getOnboardingStatus(
      workspace.esbFlow.userAccessToken,
      workspace.businessAccountId,
      workspace.wabaId
    );

    // Update workspace - Mark ESB as completed
    workspace.esbFlow.status = 'waba_activated';
    workspace.esbFlow.completedAt = new Date();
    workspace.connectedAt = new Date();

    // Update legacy fields for backwards compatibility
    if (workspace.esbFlow.systemUserToken) {
      workspace.whatsappAccessToken = workspace.esbFlow.systemUserToken;
    }

    // Mark onboarding complete
    if (!workspace.onboarding) {
      workspace.onboarding = {};
    }
    workspace.onboarding.wabaConnectionCompleted = true;
    workspace.onboarding.wabaConnectionCompletedAt = new Date();
    workspace.onboarding.completed = true;
    workspace.onboarding.completedAt = new Date();

    await workspace.save();

    console.log(`[ESB] WABA activated and onboarding completed for workspace: ${workspace._id}`);

    res.json({
      success: true,
      message: 'WABA activated successfully. Onboarding complete!',
      wabaStatus: wabaResult,
      onboardingStatus: statusResult,
      phoneNumbers: statusResult.phoneNumbers,
      ready: statusResult.ready
    });
  } catch (error) {
    console.error('Error activating WABA:', error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
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
        createdBy: esbStatus.createdBy
      },
      wabaInfo: wabaInfo,
      onboarding: workspace.onboarding
    });
  } catch (error) {
    console.error('Error getting ESB status:', error.message);
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
  verifyBusinessAndWABA,
  registerPhoneAndSendOTP,
  verifyPhoneOTP,
  createSystemUserAndToken,
  activateWABA,
  getESBStatus
};
