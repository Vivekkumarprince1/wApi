const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../utils/logger');

/**
 * Generative AI Service
 * 
 * Central wrapper for interacting with Google Gemini.
 * Used for Intent Matching, AnswerBot, and Smart Suggestions.
 */

// Initialize with environment key
const genAI = new GoogleGenerativeAI(process.env.AI_GEMINI_KEY || '');

/**
 * Generate a response using Gemini Flash (Fast & Efficient)
 */
async function generateResponse(prompt, modelName = 'gemini-1.5-flash') {
  try {
    if (!process.env.AI_GEMINI_KEY) {
      logger.warn('[GenerativeAI] AI_GEMINI_KEY missing - AI features will be disabled');
      return null;
    }

    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return JSON.parse(text);
  } catch (error) {
    logger.error('[GenerativeAI] Generation failed:', error);
    return null;
  }
}

/**
 * Perform a raw semantic classification
 */
async function classifyIntent(message, categories) {
  const prompt = `
    Analyze the following customer message on WhatsApp and classify its intent into exactly ONE of the provided categories.
    
    Categories:
    ${JSON.stringify(categories, null, 2)}
    
    Customer Message:
    "${message}"
    
    Response format (JSON only):
    {
      "matchFound": boolean,
      "categoryId": "the-id-of-the-matching-category-or-null",
      "confidence": float (0-1),
      "reasoning": "brief explanation"
    }
  `;

  return generateResponse(prompt);
}

module.exports = {
  generateResponse,
  classifyIntent
};
