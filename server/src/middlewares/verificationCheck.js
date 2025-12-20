const Workspace = require('../models/Workspace');

/**
 * Middleware to check if business is verified before allowing access to protected features.
 * Allows access only if business is verified by Meta.
 */
async function verificationCheck(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    
    if (!workspace) {
      return res.status(403).json({ 
        message: 'Workspace not found',
        requiresVerification: true 
      });
    }

    const verificationStatus = workspace.businessVerification?.status || 'not_submitted';
    const isVerified = verificationStatus === 'verified';

    // Allow access only if verified
    if (isVerified) {
      req.isVerified = true;
      return next();
    }


    
    // Block access and return verification required message
    return res.status(403).json({
      message: 'Business verification required',
      requiresVerification: true,
      verificationStatus: verificationStatus,
      action: 'Please complete business verification with GST/MSME/PAN to access this feature.',
      redirectTo: '/onboarding/business-info'
    });
  } catch (err) {
    console.error('Verification check error:', err);
    return res.status(500).json({ message: 'Error checking verification status' });
  }
}

/**
 * Soft verification check - doesn't block but adds verification info to request
 */
async function softVerificationCheck(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    
    if (workspace) {
      const verificationStatus = workspace.businessVerification?.status || 'not_submitted';
      req.isVerified = verificationStatus === 'verified';
      req.verificationStatus = verificationStatus;
    }
    
    next();
  } catch (err) {
    console.error('Soft verification check error:', err);
    next();
  }
}

module.exports = {
  verificationCheck,
  softVerificationCheck
};
