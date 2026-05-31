# Typing & Read Indicators

Typing indicators and read markings enhance the messaging experience by providing real-time UI feedback to the user.

## How it Works
1. **Receive Message**: Your webhook receives a message with a unique `id`.
2. **Action**: Use the Partner API to trigger either a `read` status or a `typing` indicator for that specific `id`.

## Best Practices
- **Typing Duration**: Automatically dismissed after the response is sent or after 25 seconds (whichever is earlier).
- **Negligible Delay**: Do not trigger typing indicators if the response delay is less than 1 second.
- **Spam**: Avoid sending multiple redundant typing indicators to the same user.

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/mark-message-as-readtyping-indicator)
