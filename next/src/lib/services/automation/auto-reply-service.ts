/**
 * AUTO-REPLY SERVICE
 * 
 * Handles keyword-based automated responses.
 * Implements 24h throttling, variable resolution, and session optimization.
 */

import { AutoReply, IAutoReplyDocument } from "@/lib/models/automation/AutoReply";
import { AutoReplyLog } from "@/lib/models/automation/AutoReplyLog";
import { IContactDocument } from "@/lib/models/messaging/Contact";
import { WabaService } from "../messaging/waba-service";
import { checkThrottle, isWithinBusinessHoursLegacy } from "./safety-guards";
import { Workspace } from "@/lib/models";
import { Types } from "mongoose";

export class AutoReplyService {
  /**
   * Check for a matching auto-reply for an inbound message
   */
  static async findMatch(messageBody: string, workspaceId: string | Types.ObjectId): Promise<IAutoReplyDocument | null> {
    const autoReplies = await AutoReply.find({ workspace: workspaceId, enabled: true }).populate('template');
    
    const lowerBody = (messageBody || '').toLowerCase().trim();
    if (!lowerBody) return null;

    // Sort priority: keyword > outside_business_hours > always
    const sorted = autoReplies.sort((a, b) => {
      const priority = { 'keyword': 1, 'outside_business_hours': 2, 'always': 3 };
      return priority[a.triggerType] - priority[b.triggerType];
    });

    for (const rule of sorted) {
      let matches = false;

      if (rule.triggerType === 'keyword') {
        matches = this.matchKeywords(lowerBody, rule.keywords, rule.matchMode);
      } else if (rule.triggerType === 'outside_business_hours') {
        const workspace = await Workspace.findById(workspaceId).select('settings').lean() as any;
        matches = !isWithinBusinessHoursLegacy(workspace?.settings);
      } else if (rule.triggerType === 'always') {
        matches = true;
      }

      if (matches) return rule;
    }

    return null;
  }

  /**
   * Process and send the auto-reply
   */
  static async handleMatch(rule: IAutoReplyDocument, contact: IContactDocument, conversationId: Types.ObjectId): Promise<boolean> {
    try {
      // 1. Throttle Check (24h Rule)
      const lastLog = await AutoReplyLog.findOne({
        autoReply: rule._id,
        contact: contact._id
      }).sort({ sentAt: -1 });

      if (lastLog && !(await checkThrottle(lastLog.sentAt))) {
        console.log(`[AutoReply] Throttled: Rule ${rule._id} recently sent to ${contact.phone}`);
        return false;
      }

      // 2. Prepare Message
      const isSessionOpen = await WabaService.canSendSessionMessage(rule.workspace, contact.phone);

      if (rule.replyType === 'text' && isSessionOpen) {
        // Option A: Send Text (if session window is open)
        const resolvedText = this.resolveVariables(rule.textMessage || '', contact);
        await WabaService.sendTextMessage(rule.workspace, contact.phone, resolvedText, {
          contactId: contact._id as Types.ObjectId,
          conversationId,
          metadata: { autoReplyId: rule._id }
        });
      } else {
        // Option B: Send Template (fallback or forced template)
        if (!rule.templateName) throw new Error('TEMPLATE_NAME_MISSING');

        // Resolve variables for template
        const resolvedVars: string[] = [];
        if (rule.variableMapping?.length > 0) {
          const sortedMappings = [...rule.variableMapping].sort((a, b) => parseInt(a.variable) - parseInt(b.variable));
          for (const m of sortedMappings) {
            resolvedVars.push(String(this.getNestedField(contact, m.contactField) || m.fallbackValue || ''));
          }
        }

        await WabaService.sendTemplateMessage(
          rule.workspace,
          contact.phone,
          rule.templateName,
          'en', // Default language
          [{ type: 'body', parameters: resolvedVars.map(v => ({ type: 'text', text: v })) }],
          {
            contactId: contact._id as Types.ObjectId,
            conversationId,
            metadata: { autoReplyId: rule._id }
          }
        );
      }

      // 3. Log & Update Stats
      await AutoReplyLog.create({
        workspace: rule.workspace,
        autoReply: rule._id,
        contact: contact._id,
        sentAt: new Date()
      });

      rule.totalRepliesSent += 1;
      rule.lastSentAt = new Date();
      await rule.save();

      return true;
    } catch (err: any) {
      console.error(`[AutoReply] Failed to send: ${err.message}`);
      return false;
    }
  }

  private static matchKeywords(body: string, keywords: string[], mode: string): boolean {
    return keywords.some(k => {
      const kw = k.toLowerCase().trim();
      if (mode === 'exact') return body === kw;
      if (mode === 'starts_with') return body.startsWith(kw);
      return body.includes(kw); // contains
    });
  }

  private static resolveVariables(text: string, contact: any): string {
    return text.replace(/\{\{([^{}]+)\}\}/g, (match, field) => {
      return this.getNestedField(contact, field.trim()) || match;
    });
  }

  private static getNestedField(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return null;
      if (current instanceof Map) {
        current = current.get(part);
      } else {
        current = current[part];
      }
    }
    return current;
  }
}
