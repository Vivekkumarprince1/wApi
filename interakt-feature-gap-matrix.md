# Interakt Feature Gap Matrix

Date: 2026-04-11

## Summary

This notes how the current wApi inbox stack compares with the public Interakt product buckets that were visible from Interakt Academy, the resource center, public blog posts, FAQ pages, and the automation training webinar.

## Yes/No Matrix

| Interakt bucket | Public Interakt signal | Current wApi status | Wired with inbox? |
| --- | --- | --- | --- |
| WhatsApp CRM / Shared Team Inbox | Shared team inbox, live chat tool, support and delight content | Shared inbox, conversation detail, notes, labels, assignment, timeline | Yes |
| WhatsApp Automation & Workflows | Automation training, custom auto-replies, no-code chatbot, workflows | Automation engine, rule matcher, action executor, event bus | Yes |
| Auto reply | Custom auto-replies, support content, automation training | Inbound webhook checks auto-reply first, then sends reply | Yes |
| AI instant matching / AI agents | WhatsApp AI Agents, AI-enabled automation, instant sales/support | AI intent matcher fallback in automation engine | Yes, via automation layer |
| AnswerBot / FAQ bot | FAQ-style support, chatbot builders, support and delight | AnswerBot service, FAQ matching, escalation to human agent | Yes |
| Team features | Shared inbox, multi-agent support | Team-scoped assignment, availability, max concurrency, auto-assign | Yes |
| WhatsApp Forms / Flows | Flow-style automation and lead capture messaging | Send-flow action, response capture, lead creation | Partial |
| WhatsApp Commerce | Commerce-focused academy content, sell and convert paths | Campaigns, CRM hooks, order/support messaging, but not a full commerce engine | Partial |
| Instagram Inbox | Instagram Inbox bucket in resource center | No confirmed matching inbox flow in current code review | No |
| Notifications library / templating | Notifications library, AI-generated templates | Template and campaign messaging exists | Partial |

## What Is Properly Wired

- Shared inbox and team assignment.
- Inbox inbound processing to auto-reply and AnswerBot.
- Automation events for conversation lifecycle and message events.
- AI intent matching as an automation fallback.
- Team auto-assignment behavior.
- Conversation and contact tag sync for campaign segmentation.

## What Is Partially Wired

- WhatsApp Forms/Flows: present as an automation action and lead capture path, but not clearly inbox-native.
- Commerce: present in adjacent campaign/CRM flows, but not a fully separated commerce workflow like Interakt’s bucket.
- Notifications/templates: messaging exists, but the public Interakt positioning suggests a more productized library and template discovery flow.

## What Is Missing Or Unclear

- Instagram inbox support.
- A distinct, inbox-integrated WhatsApp Forms experience.
- Publicly visible product-level separation for commerce workflows.
- Deeper AI-agent packaging beyond automation fallback and AnswerBot behavior.

## Interakt Public Sources Used

- https://www.interakt.shop/resource-center/
- https://www.interakt.shop/interakt-academy/
- https://www.interakt.shop/interakt-academy/support-and-delight/
- https://www.interakt.shop/blog/choose-the-best-whatsapp-live-chat-tool/
- https://www.interakt.shop/blog/whatsapp-ai-agents-holiday-queries-bookings-sales/
- https://www.interakt.shop/whatsapp-business-api-live-demo/
- https://www.interakt.shop/whatsapp-notifications-library/
- https://us06web.zoom.us/webinar/register/WN_UXvnwTDfQ02LTRFpBbVRHg

## Recommended Next Steps

1. Decide whether WhatsApp Forms should become inbox-native or stay as an automation action.
2. Add a clearer commerce workflow if commerce is a target product bucket.
3. Confirm whether Instagram inbox support is in scope.
4. Keep AI instant matching as an automation fallback, but consider a more explicit AI agent layer if you want to mirror Interakt more closely.
