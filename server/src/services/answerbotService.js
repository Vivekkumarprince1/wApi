const FAQ = require('../models/FAQ');
const AnswerBotSource = require('../models/AnswerBotSource');
const Workspace = require('../models/Workspace');

/**
 * Generate FAQs from a website URL
 * In production, this would use a real web crawler + AI
 * For now, we'll use a mock implementation
 */
async function generateFAQsFromWebsite(workspace, websiteUrl) {
  try {
    // Validate workspace
    const workspaceDoc = await Workspace.findById(workspace);
    if (!workspaceDoc) {
      return {
        success: false,
        error: 'Workspace not found'
      };
    }

    // Check plan limits (Sandbox = 1 website only)
    if (workspaceDoc.plan === 'free') {
      const existingSourceCount = await AnswerBotSource.countDocuments({
        workspace,
        crawlStatus: { $in: ['completed', 'in_progress'] }
      });

      if (existingSourceCount >= 1) {
        return {
          success: false,
          error: 'Free plan limited to 1 website. Upgrade to create another.'
        };
      }
    }

    // Check if URL already crawled (prevent duplicates)
    let source = await AnswerBotSource.findOne({
      workspace,
      websiteUrl,
      deletedAt: null
    });

    if (source && source.crawlStatus === 'completed') {
      // Return existing FAQs
      const faqs = await FAQ.find({
        answerBotSource: source._id,
        deletedAt: null
      });

      return {
        success: true,
        faqs,
        source
      };
    }

    // Create or update source
    if (!source) {
      source = await AnswerBotSource.create({
        workspace,
        websiteUrl,
        crawlStatus: 'in_progress'
      });
    } else {
      source.crawlStatus = 'in_progress';
      await source.save();
    }

    try {
      // MOCK: Simulate website crawling + FAQ generation
      // In production, this would:
      // 1. Use a web crawler (cheerio, puppeteer, etc.)
      // 2. Extract FAQs from page content
      // 3. Use AI (GPT) to generate variations and answers
      // 4. Parse common FAQ formats (schema.org FAQ, custom HTML, etc.)

      const mockFAQs = generateMockFAQs(websiteUrl);

      // Delete old FAQs for this source
      await FAQ.updateMany(
        { answerBotSource: source._id },
        { deletedAt: new Date() }
      );

      // Create new FAQs as DRAFT
      const createdFAQs = await FAQ.insertMany(
        mockFAQs.map(faq => ({
          workspace,
          question: faq.question,
          answer: faq.answer,
          variations: faq.variations,
          status: 'draft',
          source: 'answerbot',
          answerBotSource: source._id
        }))
      );

      // Update source
      source.crawlStatus = 'completed';
      source.faqCount = createdFAQs.length;
      source.metadata.questionsFound = createdFAQs.length;
      source.metadata.lastCrawledAt = new Date();
      source.completedAt = new Date();
      await source.save();

      return {
        success: true,
        faqs: createdFAQs,
        source,
        message: `Generated ${createdFAQs.length} FAQs`
      };
    } catch (crawlErr) {
      // Mark source as failed
      source.crawlStatus = 'failed';
      source.errorMessage = crawlErr.message;
      await source.save();

      return {
        success: false,
        error: `Failed to crawl website: ${crawlErr.message}`,
        source
      };
    }
  } catch (err) {
    console.error('[AnswerBot] Error generating FAQs:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * MOCK: Generate sample FAQs from website
 * In production, use actual crawler + AI
 */
function generateMockFAQs(websiteUrl) {
  // Extract domain for context
  const domain = new URL(websiteUrl).hostname;

  return [
    {
      question: `What is ${domain}?`,
      answer: `${domain} is a leading platform providing innovative solutions to businesses worldwide. We are committed to delivering exceptional service and value to our customers.`,
      variations: [
        'Tell me about this website',
        `Who is ${domain}?`,
        'What do you do?',
        'What is your company?'
      ]
    },
    {
      question: 'How can I contact support?',
      answer: 'You can reach our support team via email at support@company.com, phone at +1-800-123-4567, or through our contact form on the website. We typically respond within 24 hours.',
      variations: [
        'How do I contact support?',
        'Contact support',
        'I need help',
        'Where is your contact information?',
        'Customer support'
      ]
    },
    {
      question: 'What are your business hours?',
      answer: 'We are available Monday through Friday, 9:00 AM to 6:00 PM EST. Weekend and holiday hours are limited. For urgent matters, please call our emergency line.',
      variations: [
        'When are you open?',
        'What are your hours?',
        'Business hours',
        'Are you open now?',
        'When can I reach you?'
      ]
    },
    {
      question: 'Do you offer free trials?',
      answer: 'Yes! We offer a 14-day free trial of our full platform. No credit card required. Simply sign up on our website and start exploring all features.',
      variations: [
        'Free trial',
        'Can I try for free?',
        'Trial period',
        'How long is the free trial?',
        'Is there a trial version?'
      ]
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards (Visa, Mastercard, American Express), bank transfers, PayPal, and cryptocurrency payments. All transactions are secure and encrypted.',
      variations: [
        'Payment options',
        'How can I pay?',
        'Do you accept credit cards?',
        'Payment methods',
        'Ways to pay'
      ]
    }
  ];
}

/**
 * Get all FAQs for a workspace
 */
async function getFAQs(workspace, filters = {}) {
  const query = {
    workspace,
    deletedAt: null
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.source) {
    query.source = filters.source;
  }

  const faqs = await FAQ.find(query)
    .sort({ createdAt: -1 })
    .limit(1000);

  return faqs;
}

/**
 * Approve FAQs (mark as approved for use in auto-replies)
 */
async function approveFAQs(workspace, faqIds) {
  if (!Array.isArray(faqIds) || faqIds.length === 0) {
    return {
      success: false,
      error: 'At least one FAQ must be selected'
    };
  }

  try {
    // Update FAQs to approved status
    const result = await FAQ.updateMany(
      {
        _id: { $in: faqIds },
        workspace
      },
      {
        status: 'approved',
        updatedAt: new Date()
      }
    );

    return {
      success: true,
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} FAQs approved`
    };
  } catch (err) {
    console.error('[AnswerBot] Error approving FAQs:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Check if an inbound message matches any approved FAQ
 * Returns matching FAQ if found
 */
async function matchFAQ(messageBody, workspace) {
  if (!messageBody || !workspace) {
    return null;
  }

  try {
    const lowerMessage = messageBody.toLowerCase().trim();

    // Get all approved FAQs for workspace
    const faqs = await FAQ.find({
      workspace,
      status: 'approved',
      deletedAt: null
    });

    // Try to match against question or variations
    for (const faq of faqs) {
      const questionMatch = matchText(lowerMessage, faq.question.toLowerCase());

      if (questionMatch) {
        // Update match count
        faq.matchCount = (faq.matchCount || 0) + 1;
        faq.lastMatchedAt = new Date();
        await faq.save();

        return faq;
      }

      // Check variations
      if (faq.variations && faq.variations.length > 0) {
        for (const variation of faq.variations) {
          const variationMatch = matchText(lowerMessage, variation.toLowerCase());
          if (variationMatch) {
            faq.matchCount = (faq.matchCount || 0) + 1;
            faq.lastMatchedAt = new Date();
            await faq.save();

            return faq;
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error('[AnswerBot] Error matching FAQ:', err);
    return null;
  }
}

/**
 * Simple text matching algorithm
 * Matches if key words are found (not full text matching)
 */
function matchText(messageText, questionText) {
  const messageWords = messageText
    .split(/\s+/)
    .filter(w => w.length > 2); // Ignore short words like 'a', 'is', etc.

  const questionWords = questionText
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (questionWords.length === 0) {
    return false;
  }

  // Check if at least 60% of question words appear in message
  const matchedWords = questionWords.filter(qw => messageWords.includes(qw));
  const matchPercentage = matchedWords.length / questionWords.length;

  return matchPercentage >= 0.6;
}

/**
 * Delete FAQ (soft delete)
 */
async function deleteFAQ(workspace, faqId) {
  try {
    const result = await FAQ.findByIdAndUpdate(
      faqId,
      {
        deletedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!result) {
      return {
        success: false,
        error: 'FAQ not found'
      };
    }

    return {
      success: true,
      message: 'FAQ deleted'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Get AnswerBot sources for workspace
 */
async function getAnswerBotSources(workspace) {
  return await AnswerBotSource.find({
    workspace,
    deletedAt: null
  }).sort({ createdAt: -1 });
}

module.exports = {
  generateFAQsFromWebsite,
  getFAQs,
  approveFAQs,
  matchFAQ,
  deleteFAQ,
  getAnswerBotSources
};
