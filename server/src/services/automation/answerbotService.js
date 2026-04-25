const { FAQ, AnswerBotSource, Workspace, AiIntentMatchLog } = require('../../models');
const bspMessagingService = require('../bsp/bspMessagingService');

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

    // Check plan limits (Growth/Free = 4, Advanced/Premium = 6)
    const plan = workspaceDoc.plan || 'free';
    const limit = (plan === 'free' || plan === 'trial') ? 4 : 6;

    const existingSourceCount = await AnswerBotSource.countDocuments({
      workspace,
      deletedAt: null
    });

    if (existingSourceCount >= limit) {
      return {
        success: false,
        error: `Limit reached (${existingSourceCount}/${limit}). Upgrade your plan to add more Knowledge Base sources.`
      };
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
      // Try to scrape website using cheerio
      const mockFAQs = await scrapeFAQs(websiteUrl);

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

const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrape FAQs from website URL
 */
async function scrapeFAQs(websiteUrl) {
  const domain = new URL(websiteUrl).hostname;
  const faqs = [];
  
  try {
    const { data } = await axios.get(websiteUrl, { timeout: 10000 });
    const $ = cheerio.load(data);
    
    // 1. Look for Definition Lists (dl, dt, dd)
    $('dl').each((i, dl) => {
      const questions = $(dl).find('dt');
      const answers = $(dl).find('dd');
      
      questions.each((j, dt) => {
        const question = $(dt).text().trim();
        const answer = $(answers[j]).text().trim();
        if (question && answer && question.length < 150) {
          faqs.push({
            question,
            answer,
            variations: [question.toLowerCase()]
          });
        }
      });
    });

    // 2. Look for H2/H3 elements ending with '?' followed by a paragraph
    $('h2, h3, h4, .faq-question').each((i, h) => {
      const text = $(h).text().trim();
      if (text.endsWith('?')) {
        const nextElem = $(h).next();
        if (nextElem.is('p') || nextElem.is('div')) {
           const answer = nextElem.text().trim();
           if (answer && answer.length > 5) {
             faqs.push({
               question: text,
               answer: answer,
               variations: [text.toLowerCase()]
             });
           }
        }
      }
    });

  } catch (error) {
    console.error('[AnswerBot] Scrape failed:', error.message);
  }

  // Fallback to basic mock if we failed or found nothing
  if (faqs.length === 0) {
    faqs.push(
      {
        question: `What is ${domain}?`,
        answer: `${domain} is a leading platform providing innovative solutions. We are committed to delivering exceptional service.`,
        variations: [`Tell me about ${domain}`, 'What is your company?']
      },
      {
        question: 'How can I contact support?',
        answer: 'You can reach out to our team using the contact forms on our website. We are here to help.',
        variations: ['Contact support', 'I need help', 'Where is your contact info?']
      },
      {
        question: 'What are your business hours?',
        answer: 'We are available Monday through Friday during regular business hours.',
        variations: ['When are you open?', 'What are your hours?', 'Business hours']
      },
      {
        question: 'Do you offer a free trial?',
        answer: 'Please check our pricing page on the website for current offers, including trials if available.',
        variations: ['Free trial', 'Can I try for free?', 'Trial period']
      }
    );
  }

  return faqs;
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
async function matchFAQ(messageBody, workspace, conversation = null) {
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
      const matchResult = matchText(lowerMessage, faq.question);

      if (matchResult.matched) {
        return finalizeMatch(faq, conversation, messageBody, matchResult.score);
      }

      // Check variations
      if (faq.variations && faq.variations.length > 0) {
        for (const variation of faq.variations) {
          const varMatch = matchText(lowerMessage, variation);
          if (varMatch.matched) {
            return finalizeMatch(faq, conversation, messageBody, varMatch.score);
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
 * High-level function to process bot response and handle escalation
 */
async function processBotResponse(messageBody, workspaceId, conversation) {
  if (!conversation || conversation.botMetadata?.isBotPaused) {
    return null;
  }

  const matchedFaq = await matchFAQ(messageBody, workspaceId, conversation);

  if (matchedFaq) {
    // ══════════════════════════════════════════════════════════════════════════
    // BUG FIX: Actually send the response! (Previously it only matched)
    // ══════════════════════════════════════════════════════════════════════════
    const contactPhone = conversation.contact?.phone || (await conversation.populate('contact')).contact?.phone;
    
    if (matchedFaq.interactive && matchedFaq.interactive.buttons?.length > 0) {
      // Send Interactive Message (Quick Replies)
      await bspMessagingService.sendInteractiveMessage(
        workspaceId,
        contactPhone,
        {
          type: 'button',
          header: matchedFaq.interactive.header ? { type: 'text', text: matchedFaq.interactive.header } : undefined,
          body: { text: matchedFaq.interactive.body || matchedFaq.answer },
          footer: matchedFaq.interactive.footer ? { text: matchedFaq.interactive.footer } : undefined,
          action: {
            buttons: matchedFaq.interactive.buttons.map(btn => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title }
            }))
          }
        },
        { contactId: conversation.contact._id, conversationId: conversation._id }
      );
    } else {
      // Send Text Response
      await bspMessagingService.sendTextMessage(
        workspaceId,
        contactPhone,
        matchedFaq.answer,
        { contactId: conversation.contact._id, conversationId: conversation._id }
      );
    }
    
    return matchedFaq;
  }

  // No match - increment failed intents
  conversation.botMetadata = conversation.botMetadata || { failedIntents: 0, isBotPaused: false };
  conversation.botMetadata.failedIntents = (conversation.botMetadata.failedIntents || 0) + 1;
  conversation.botMetadata.lastBotInteractionAt = new Date();

  console.log(`[AnswerBot] Failed intent for conv ${conversation._id}. Current count: ${conversation.botMetadata.failedIntents}`);

  if (conversation.botMetadata.failedIntents >= 3) {
    conversation.botMetadata.isBotPaused = true;
    console.log(`[AnswerBot] 🚨 Escalating to human agent for conv ${conversation._id}`);

    // Notify human agents via Socket
    try {
      const inboxSocketService = require('../messaging/inboxSocketService');
      await inboxSocketService.emitBotEscalation(workspaceId, conversation);
    } catch (err) {
      console.error('[AnswerBot] Failed to emit escalation socket:', err.message);
    }
  }

  await conversation.save();
  return null;
}

/**
 * Smart text matching algorithm (Token Overlap + Fuzzy Coefficient)
 */
function matchText(messageText, questionText) {
  // 1. Normalize and tokenize
  const tokenize = (str) => str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const messageTokens = tokenize(messageText);
  const questionTokens = tokenize(questionText);

  if (questionTokens.length === 0) return { matched: false, score: 0 };

  // 2. Count matches (Exact or Fuzzy)
  let matchCount = 0;
  for (const qToken of questionTokens) {
    let bestTokenScore = 0;
    
    for (const mToken of messageTokens) {
      if (qToken === mToken) {
        bestTokenScore = 1;
        break;
      }
      
      // Fuzzy check for abbreviations (e.g. "sub" matching "subscription")
      if (qToken.startsWith(mToken) || mToken.startsWith(qToken)) {
        // Only if length match is decent (min 3 chars)
        const minLen = Math.min(qToken.length, mToken.length);
        if (minLen >= 3) {
          bestTokenScore = Math.max(bestTokenScore, 0.8 * (minLen / Math.max(qToken.length, mToken.length)));
        }
      }
    }
    matchCount += bestTokenScore;
  }

  // 3. Calculate score
  // Threshold: 0.5 (matches 50% of keywords, accounting for fuzzy bits)
  const score = matchCount / questionTokens.length;
  
  return {
    matched: score >= 0.5,
    score: score
  };
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

/**
 * Update stats and log match for the FAQ
 */
async function finalizeMatch(faq, conversation, queryText, confidence) {
  // Update match count
  faq.matchCount = (faq.matchCount || 0) + 1;
  faq.lastMatchedAt = new Date();
  await faq.save();

  // Reset failed intents if matched
  if (conversation) {
    conversation.botMetadata = conversation.botMetadata || {};
    conversation.botMetadata.failedIntents = 0;
    conversation.botMetadata.lastBotInteractionAt = new Date();
    await conversation.save().catch(err => console.error('[AnswerBot] Failed to save conversation metadata:', err));
  }

  // Log intent match
  try {
    await AiIntentMatchLog.create({
      workspace: faq.workspace,
      queryText: queryText,
      matchedRule: faq._id, // Reuse Rule field for FAQ
      confidence: confidence,
      conversation: conversation?._id,
      contact: conversation?.contact?._id || conversation?.contact,
      aiMetadata: {
        model: 'wapi-fuzzy-v2',
        intentDetected: faq.question
      }
    });
  } catch (err) {
    console.error('[AnswerBot] Failed to log intent match:', err.message);
  }

  return faq;
}

module.exports = {
  generateFAQsFromWebsite,
  getFAQs,
  approveFAQs,
  matchFAQ,
  processBotResponse,
  deleteFAQ,
  getAnswerBotSources
};
