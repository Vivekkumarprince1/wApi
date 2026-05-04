# Flow Management APIs

WhatsApp Flows allow for structured interactions (lead gen, product recommendations, etc.) within messaging threads.

## Implementation Steps
1. **Create Flow**: Initialize a flow in "Draft" status.
2. **Components**: Define form elements. Use [Meta Playground](https://developers.facebook.com/docs/whatsapp/flows/playground) for a UI builder, then export the JSON.
3. **Update JSON**: Attach the `.json` component file to the flow.
4. **Preview**: Use the Preview URL API to test before publishing.
5. **Publish**: Make the flow live. **Note**: Published flows cannot be edited.

## Sending Flows
- **Session Message**: Send via Individual message type.
- **Template Message**: Send as a structured template.

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/get-started-guide-with-gupshup-flow-management-apis)
