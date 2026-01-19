/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEMPLATE VALIDATION MIDDLEWARE
 * 
 * Validates templates for Meta WhatsApp Cloud API compliance before submission.
 * Follows Interakt's validation patterns for BSP parent WABA submissions.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const { VALID_META_CATEGORIES, SUPPORTED_LANGUAGES } = require('../models/Template');

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const LIMITS = {
  // Template name
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 512,
  
  // Header
  HEADER_TEXT_MAX_LENGTH: 60,
  HEADER_VARIABLES_MAX: 1,
  
  // Body
  BODY_MIN_LENGTH: 1,
  BODY_MAX_LENGTH: 1024,
  BODY_VARIABLES_MAX: 99,
  
  // Footer
  FOOTER_MAX_LENGTH: 60,
  
  // Buttons
  BUTTONS_MAX_COUNT: 10,
  BUTTON_TEXT_MAX_LENGTH: 25,
  QUICK_REPLY_BUTTONS_MAX: 10,
  URL_BUTTONS_MAX: 2,
  PHONE_BUTTONS_MAX: 1,
  
  // URL
  URL_MAX_LENGTH: 2000,
  URL_SUFFIX_MAX_LENGTH: 500
};

// Regex patterns
const PATTERNS = {
  TEMPLATE_NAME: /^[a-z0-9_]+$/,
  VARIABLE: /\{\{(\d+)\}\}/g,
  VARIABLE_SINGLE: /\{\{(\d+)\}\}/,
  PHONE_NUMBER: /^\+[1-9]\d{1,14}$/,
  URL: /^https:\/\/.+/i,
  VALID_CHARACTERS: /^[\u0000-\uFFFF]+$/ // Basic multilingual plane
};

// Category-specific rules
const CATEGORY_RULES = {
  AUTHENTICATION: {
    maxButtons: 1,
    allowedButtonTypes: ['COPY_CODE', 'URL'],
    requiresOtp: true,
    headerAllowed: false
  },
  MARKETING: {
    maxButtons: 10,
    allowedButtonTypes: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'],
    requiresOtp: false,
    headerAllowed: true
  },
  UTILITY: {
    maxButtons: 10,
    allowedButtonTypes: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'],
    requiresOtp: false,
    headerAllowed: true
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION ERRORS CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class TemplateValidationError extends Error {
  constructor(errors) {
    super('Template validation failed');
    this.name = 'TemplateValidationError';
    this.errors = errors;
    this.statusCode = 400;
  }
  
  toJSON() {
    return {
      success: false,
      message: 'Template validation failed',
      errors: this.errors
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate template name
 */
function validateName(name) {
  const errors = [];
  
  if (!name) {
    errors.push({ field: 'name', message: 'Template name is required' });
    return errors;
  }
  
  if (name.length < LIMITS.NAME_MIN_LENGTH) {
    errors.push({ field: 'name', message: 'Template name is too short' });
  }
  
  if (name.length > LIMITS.NAME_MAX_LENGTH) {
    errors.push({ field: 'name', message: `Template name cannot exceed ${LIMITS.NAME_MAX_LENGTH} characters` });
  }
  
  if (!PATTERNS.TEMPLATE_NAME.test(name)) {
    errors.push({ 
      field: 'name', 
      message: 'Template name can only contain lowercase letters, numbers, and underscores' 
    });
  }
  
  // Check for reserved prefixes
  const reservedPrefixes = ['test_', 'sample_', 'example_'];
  if (reservedPrefixes.some(prefix => name.startsWith(prefix))) {
    errors.push({ 
      field: 'name', 
      message: 'Template name cannot start with reserved prefixes (test_, sample_, example_)' 
    });
  }
  
  return errors;
}

/**
 * Validate language code
 */
function validateLanguage(language) {
  const errors = [];
  
  if (!language) {
    errors.push({ field: 'language', message: 'Language is required' });
    return errors;
  }
  
  if (!SUPPORTED_LANGUAGES[language]) {
    errors.push({ 
      field: 'language', 
      message: `Unsupported language: ${language}. Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}` 
    });
  }
  
  return errors;
}

/**
 * Validate category
 */
function validateCategory(category) {
  const errors = [];
  
  if (!category) {
    errors.push({ field: 'category', message: 'Category is required' });
    return errors;
  }
  
  if (!VALID_META_CATEGORIES.includes(category)) {
    errors.push({ 
      field: 'category', 
      message: `Invalid category: ${category}. Must be one of: ${VALID_META_CATEGORIES.join(', ')}` 
    });
  }
  
  return errors;
}

/**
 * Validate variables in text
 */
function validateVariables(text, componentName, maxVariables = LIMITS.BODY_VARIABLES_MAX) {
  const errors = [];
  
  if (!text) return errors;
  
  const matches = text.match(PATTERNS.VARIABLE) || [];
  const variableNumbers = matches.map(m => parseInt(m.replace(/[{}]/g, '')));
  
  // Check for sequential numbering starting from 1
  const sortedVars = [...variableNumbers].sort((a, b) => a - b);
  for (let i = 0; i < sortedVars.length; i++) {
    if (sortedVars[i] !== i + 1) {
      errors.push({ 
        field: componentName, 
        message: `Variables must be sequential starting from 1. Found: ${sortedVars.join(', ')}` 
      });
      break;
    }
  }
  
  // Check max variables
  if (variableNumbers.length > maxVariables) {
    errors.push({ 
      field: componentName, 
      message: `Maximum ${maxVariables} variables allowed in ${componentName}` 
    });
  }
  
  // Check for duplicates
  const uniqueVars = new Set(variableNumbers);
  if (uniqueVars.size !== variableNumbers.length) {
    errors.push({ 
      field: componentName, 
      message: 'Duplicate variables detected' 
    });
  }
  
  // Check for invalid variable formats
  const invalidFormats = text.match(/\{[^{]*\}|\{[^}]*$/g) || [];
  const validFormats = text.match(PATTERNS.VARIABLE) || [];
  if (invalidFormats.length > validFormats.length) {
    errors.push({ 
      field: componentName, 
      message: 'Invalid variable format detected. Use {{1}}, {{2}}, etc.' 
    });
  }
  
  return errors;
}

/**
 * Validate header component
 */
function validateHeader(header, category) {
  const errors = [];
  
  if (!header || !header.enabled) {
    return errors;
  }
  
  const categoryRules = CATEGORY_RULES[category];
  
  // Check if header is allowed for this category
  if (!categoryRules.headerAllowed) {
    errors.push({ 
      field: 'header', 
      message: `Header is not allowed for ${category} templates` 
    });
    return errors;
  }
  
  if (!header.format || header.format === 'NONE') {
    errors.push({ field: 'header.format', message: 'Header format is required when header is enabled' });
    return errors;
  }
  
  const validFormats = ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'];
  if (!validFormats.includes(header.format)) {
    errors.push({ 
      field: 'header.format', 
      message: `Invalid header format. Must be one of: ${validFormats.join(', ')}` 
    });
  }
  
  // Text header validation
  if (header.format === 'TEXT') {
    if (!header.text) {
      errors.push({ field: 'header.text', message: 'Header text is required for TEXT format' });
    } else {
      if (header.text.length > LIMITS.HEADER_TEXT_MAX_LENGTH) {
        errors.push({ 
          field: 'header.text', 
          message: `Header text cannot exceed ${LIMITS.HEADER_TEXT_MAX_LENGTH} characters` 
        });
      }
      
      // Validate header variables
      const varErrors = validateVariables(header.text, 'header.text', LIMITS.HEADER_VARIABLES_MAX);
      errors.push(...varErrors);
      
      // Check if example is provided for variables
      const hasVariables = PATTERNS.VARIABLE.test(header.text);
      if (hasVariables && !header.example) {
        errors.push({ 
          field: 'header.example', 
          message: 'Example value is required for header variables' 
        });
      }
    }
  }
  
  // Media header validation
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format)) {
    if (!header.mediaUrl && !header.mediaHandle) {
      errors.push({ 
        field: 'header.media', 
        message: 'Media URL or handle is required for media headers' 
      });
    }
    
    // Validate media URL format
    if (header.mediaUrl && !PATTERNS.URL.test(header.mediaUrl)) {
      errors.push({ 
        field: 'header.mediaUrl', 
        message: 'Media URL must be a valid HTTPS URL' 
      });
    }
  }
  
  return errors;
}

/**
 * Validate body component
 */
function validateBody(body) {
  const errors = [];
  
  if (!body || !body.text) {
    errors.push({ field: 'body.text', message: 'Body text is required' });
    return errors;
  }
  
  // Length validation
  if (body.text.length < LIMITS.BODY_MIN_LENGTH) {
    errors.push({ field: 'body.text', message: 'Body text is too short' });
  }
  
  if (body.text.length > LIMITS.BODY_MAX_LENGTH) {
    errors.push({ 
      field: 'body.text', 
      message: `Body text cannot exceed ${LIMITS.BODY_MAX_LENGTH} characters` 
    });
  }
  
  // Variable validation
  const varErrors = validateVariables(body.text, 'body.text', LIMITS.BODY_VARIABLES_MAX);
  errors.push(...varErrors);
  
  // Check if examples are provided for variables
  const matches = body.text.match(PATTERNS.VARIABLE) || [];
  const variableCount = matches.length;
  
  if (variableCount > 0) {
    if (!body.examples || body.examples.length < variableCount) {
      errors.push({ 
        field: 'body.examples', 
        message: `Example values required for all ${variableCount} variables` 
      });
    }
  }
  
  // Check for prohibited content patterns
  const prohibitedPatterns = [
    { pattern: /\b(free|win|winner|prize|congratulations)\b/i, message: 'Avoid spam-triggering words' },
    { pattern: /https?:\/\/bit\.ly/i, message: 'URL shorteners are not recommended' },
    { pattern: /\b(click here|act now|limited time)\b/i, message: 'Avoid urgency phrases that may trigger rejection' }
  ];
  
  for (const { pattern, message } of prohibitedPatterns) {
    if (pattern.test(body.text)) {
      errors.push({ 
        field: 'body.text', 
        message: `Warning: ${message}`,
        severity: 'warning'
      });
    }
  }
  
  return errors;
}

/**
 * Validate footer component
 */
function validateFooter(footer) {
  const errors = [];
  
  if (!footer || !footer.enabled) {
    return errors;
  }
  
  if (!footer.text) {
    errors.push({ field: 'footer.text', message: 'Footer text is required when footer is enabled' });
    return errors;
  }
  
  if (footer.text.length > LIMITS.FOOTER_MAX_LENGTH) {
    errors.push({ 
      field: 'footer.text', 
      message: `Footer text cannot exceed ${LIMITS.FOOTER_MAX_LENGTH} characters` 
    });
  }
  
  // Footer cannot have variables
  if (PATTERNS.VARIABLE.test(footer.text)) {
    errors.push({ 
      field: 'footer.text', 
      message: 'Variables are not allowed in footer' 
    });
  }
  
  return errors;
}

/**
 * Validate buttons component
 */
function validateButtons(buttons, category) {
  const errors = [];
  
  if (!buttons || !buttons.enabled || !buttons.items || buttons.items.length === 0) {
    return errors;
  }
  
  const categoryRules = CATEGORY_RULES[category];
  
  // Count button types
  const buttonCounts = {
    QUICK_REPLY: 0,
    URL: 0,
    PHONE_NUMBER: 0,
    COPY_CODE: 0
  };
  
  // Validate total count
  if (buttons.items.length > categoryRules.maxButtons) {
    errors.push({ 
      field: 'buttons', 
      message: `Maximum ${categoryRules.maxButtons} buttons allowed for ${category} templates` 
    });
  }
  
  // Validate each button
  buttons.items.forEach((button, index) => {
    const fieldPrefix = `buttons.items[${index}]`;
    
    // Check button type is valid
    if (!button.type) {
      errors.push({ field: `${fieldPrefix}.type`, message: 'Button type is required' });
      return;
    }
    
    if (!categoryRules.allowedButtonTypes.includes(button.type)) {
      errors.push({ 
        field: `${fieldPrefix}.type`, 
        message: `Button type ${button.type} is not allowed for ${category} templates` 
      });
    }
    
    buttonCounts[button.type]++;
    
    // Validate button text
    if (!button.text) {
      errors.push({ field: `${fieldPrefix}.text`, message: 'Button text is required' });
    } else if (button.text.length > LIMITS.BUTTON_TEXT_MAX_LENGTH) {
      errors.push({ 
        field: `${fieldPrefix}.text`, 
        message: `Button text cannot exceed ${LIMITS.BUTTON_TEXT_MAX_LENGTH} characters` 
      });
    }
    
    // Type-specific validation
    switch (button.type) {
      case 'URL':
        if (!button.url) {
          errors.push({ field: `${fieldPrefix}.url`, message: 'URL is required for URL buttons' });
        } else {
          if (!PATTERNS.URL.test(button.url)) {
            errors.push({ field: `${fieldPrefix}.url`, message: 'URL must be a valid HTTPS URL' });
          }
          if (button.url.length > LIMITS.URL_MAX_LENGTH) {
            errors.push({ field: `${fieldPrefix}.url`, message: 'URL is too long' });
          }
        }
        
        // Check for dynamic URL suffix
        if (button.urlSuffix) {
          if (button.urlSuffix.length > LIMITS.URL_SUFFIX_MAX_LENGTH) {
            errors.push({ field: `${fieldPrefix}.urlSuffix`, message: 'URL suffix is too long' });
          }
          if (!button.example) {
            errors.push({ field: `${fieldPrefix}.example`, message: 'Example is required for dynamic URL' });
          }
        }
        break;
        
      case 'PHONE_NUMBER':
        if (!button.phoneNumber) {
          errors.push({ field: `${fieldPrefix}.phoneNumber`, message: 'Phone number is required' });
        } else if (!PATTERNS.PHONE_NUMBER.test(button.phoneNumber)) {
          errors.push({ 
            field: `${fieldPrefix}.phoneNumber`, 
            message: 'Phone number must be in international format (e.g., +1234567890)' 
          });
        }
        break;
        
      case 'COPY_CODE':
        if (!button.example) {
          errors.push({ field: `${fieldPrefix}.example`, message: 'Example OTP code is required' });
        }
        break;
        
      case 'QUICK_REPLY':
        // Quick reply only needs text, which is already validated
        break;
    }
  });
  
  // Validate button type counts
  if (buttonCounts.QUICK_REPLY > LIMITS.QUICK_REPLY_BUTTONS_MAX) {
    errors.push({ 
      field: 'buttons', 
      message: `Maximum ${LIMITS.QUICK_REPLY_BUTTONS_MAX} quick reply buttons allowed` 
    });
  }
  
  if (buttonCounts.URL > LIMITS.URL_BUTTONS_MAX) {
    errors.push({ 
      field: 'buttons', 
      message: `Maximum ${LIMITS.URL_BUTTONS_MAX} URL buttons allowed` 
    });
  }
  
  if (buttonCounts.PHONE_NUMBER > LIMITS.PHONE_BUTTONS_MAX) {
    errors.push({ 
      field: 'buttons', 
      message: `Maximum ${LIMITS.PHONE_BUTTONS_MAX} phone number button allowed` 
    });
  }
  
  // Mixed button types validation
  if (buttonCounts.QUICK_REPLY > 0 && (buttonCounts.URL > 0 || buttonCounts.PHONE_NUMBER > 0)) {
    // This is actually allowed, but warn for UX
    errors.push({
      field: 'buttons',
      message: 'Mixing quick reply with URL/phone buttons may affect user experience',
      severity: 'warning'
    });
  }
  
  return errors;
}

/**
 * Validate authentication template specific rules
 */
function validateAuthenticationTemplate(template) {
  const errors = [];
  
  if (template.category !== 'AUTHENTICATION') {
    return errors;
  }
  
  // Authentication templates have special requirements
  
  // Must have OTP code variable in body
  if (!template.body?.text?.includes('{{1}}')) {
    errors.push({ 
      field: 'body.text', 
      message: 'Authentication templates must include {{1}} for the OTP code' 
    });
  }
  
  // Should have COPY_CODE button or URL button
  if (template.buttons?.enabled) {
    const hasCopyCode = template.buttons.items?.some(b => b.type === 'COPY_CODE');
    const hasUrlButton = template.buttons.items?.some(b => b.type === 'URL');
    
    if (!hasCopyCode && !hasUrlButton) {
      errors.push({ 
        field: 'buttons', 
        message: 'Authentication templates should have a Copy Code or URL button',
        severity: 'warning'
      });
    }
  }
  
  // Header not allowed
  if (template.header?.enabled) {
    errors.push({ 
      field: 'header', 
      message: 'Header is not allowed in authentication templates' 
    });
  }
  
  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN VALIDATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate entire template
 * @param {Object} template - Template data to validate
 * @returns {Object} - { valid: boolean, errors: [], warnings: [] }
 */
function validateTemplate(template) {
  const errors = [];
  const warnings = [];
  
  // Basic validations
  errors.push(...validateName(template.name));
  errors.push(...validateLanguage(template.language));
  errors.push(...validateCategory(template.category));
  
  // Component validations
  errors.push(...validateHeader(template.header, template.category));
  errors.push(...validateBody(template.body));
  errors.push(...validateFooter(template.footer));
  errors.push(...validateButtons(template.buttons, template.category));
  
  // Category-specific validations
  if (template.category === 'AUTHENTICATION') {
    errors.push(...validateAuthenticationTemplate(template));
  }
  
  // Separate warnings from errors
  const actualErrors = errors.filter(e => e.severity !== 'warning');
  const actualWarnings = errors.filter(e => e.severity === 'warning');
  
  return {
    valid: actualErrors.length === 0,
    errors: actualErrors,
    warnings: actualWarnings
  };
}

/**
 * Build Meta API payload from validated template
 */
function buildMetaPayload(template, namespacedName) {
  const components = [];
  
  // Header
  if (template.header?.enabled && template.header.format !== 'NONE') {
    const headerComponent = {
      type: 'HEADER',
      format: template.header.format
    };
    
    if (template.header.format === 'TEXT') {
      headerComponent.text = template.header.text;
      
      // Add example if variables present
      const hasVariables = PATTERNS.VARIABLE.test(template.header.text);
      if (hasVariables && template.header.example) {
        headerComponent.example = {
          header_text: [template.header.example]
        };
      }
    } else if (template.header.mediaHandle) {
      headerComponent.example = {
        header_handle: [template.header.mediaHandle]
      };
    }
    
    components.push(headerComponent);
  }
  
  // Body (required)
  const bodyComponent = {
    type: 'BODY',
    text: template.body.text
  };
  
  // Add body examples if variables present
  const bodyMatches = template.body.text.match(PATTERNS.VARIABLE) || [];
  if (bodyMatches.length > 0 && template.body.examples?.length > 0) {
    bodyComponent.example = {
      body_text: [template.body.examples]
    };
  }
  
  components.push(bodyComponent);
  
  // Footer
  if (template.footer?.enabled && template.footer.text) {
    components.push({
      type: 'FOOTER',
      text: template.footer.text
    });
  }
  
  // Buttons
  if (template.buttons?.enabled && template.buttons.items?.length > 0) {
    const buttons = template.buttons.items.map(btn => {
      const button = {
        type: btn.type,
        text: btn.text
      };
      
      switch (btn.type) {
        case 'URL':
          button.url = btn.url;
          if (btn.urlSuffix) {
            button.url = `${btn.url}{{1}}`;
            button.example = [btn.example];
          }
          break;
        case 'PHONE_NUMBER':
          button.phone_number = btn.phoneNumber;
          break;
        case 'COPY_CODE':
          button.example = btn.example;
          break;
      }
      
      return button;
    });
    
    components.push({
      type: 'BUTTONS',
      buttons
    });
  }
  
  return {
    name: namespacedName,
    language: template.language,
    category: template.category,
    components
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Middleware to validate template before creation
 */
function validateTemplateCreate(req, res, next) {
  const { name, language, category, header, body, footer, buttons } = req.body;
  
  const template = { name, language, category, header, body, footer, buttons };
  const result = validateTemplate(template);
  
  if (!result.valid) {
    return res.status(400).json({
      success: false,
      message: 'Template validation failed',
      errors: result.errors,
      warnings: result.warnings
    });
  }
  
  // Attach warnings to request for logging
  req.templateWarnings = result.warnings;
  next();
}

/**
 * Middleware to validate template before submission to Meta
 */
function validateTemplateSubmit(req, res, next) {
  // Template will be loaded in controller, this just checks the request
  next();
}

/**
 * Middleware to validate template update
 */
function validateTemplateUpdate(req, res, next) {
  const { name, language, category, header, body, footer, buttons } = req.body;
  
  // Build template object for validation (only include provided fields)
  const template = {};
  if (name !== undefined) template.name = name;
  if (language !== undefined) template.language = language;
  if (category !== undefined) template.category = category;
  if (header !== undefined) template.header = header;
  if (body !== undefined) template.body = body;
  if (footer !== undefined) template.footer = footer;
  if (buttons !== undefined) template.buttons = buttons;
  
  // Partial validation for updates
  const errors = [];
  
  if (template.name) errors.push(...validateName(template.name));
  if (template.language) errors.push(...validateLanguage(template.language));
  if (template.category) errors.push(...validateCategory(template.category));
  
  const actualErrors = errors.filter(e => e.severity !== 'warning');
  
  if (actualErrors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Template validation failed',
      errors: actualErrors
    });
  }
  
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Main validation function
  validateTemplate,
  
  // Individual validators
  validateName,
  validateLanguage,
  validateCategory,
  validateVariables,
  validateHeader,
  validateBody,
  validateFooter,
  validateButtons,
  validateAuthenticationTemplate,
  
  // Payload builder
  buildMetaPayload,
  
  // Express middlewares
  validateTemplateCreate,
  validateTemplateUpdate,
  validateTemplateSubmit,
  
  // Error class
  TemplateValidationError,
  
  // Constants
  LIMITS,
  PATTERNS,
  CATEGORY_RULES
};
