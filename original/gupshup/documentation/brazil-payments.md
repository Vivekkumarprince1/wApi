# WhatsApp Brazil Payments

WhatsApp supports local payment methods in Brazil, specifically PIX and Boleto, through dedicated APIs.

## Payment Methods
- **PIX**: Supports Dynamic PIX codes via session or template messages.
- **Boleto**: Supports sending Boleto payment invoices via session or template messages.
- **Payment Link**: Generic payment links for offsite conversion.

## Implementation
- **V3 Message Type**: Use the dedicated V3 payment message endpoints.
- **Payload**: Must include regional specific details for Brazil compliance.

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/whatsapp-brazil-payments)
