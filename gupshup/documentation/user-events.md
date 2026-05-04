# User Events

User events notify the partner about customer-level changes.

## Payload Object
```json
{
   "app": "DemoApp",
   "timestamp": 1580142086287,
   "version": 2,
   "type": "user-event",
   "payload": {
      "phone": "918x98xx21x4",
      "type": "sandbox-start" | "opted-in" | "opted-out"
   }
}
```

## Types of User Events
- **sandbox-start**: Customer initiated a sandbox session.
- **opted-in**: Customer opted in to receive messages.
- **opted-out**: Customer opted out of messaging.

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/user-events)
