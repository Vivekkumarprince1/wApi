# Automation & Workflow Engine

The Automation Engine is responsible for executing business logic based on real-time events. It supports a visual flow-based graph structure.

## 1. Trigger System

Workflows are triggered by events emitted by other services:
- `message_received`: Fired by `WebhookProcessor` when a new message arrives.
- `conversation_opened`: Fired when a new chat starts.
- `contact_tagged`: Fired when a tag is added to a contact.

## 2. Execution Logic (`FlowExecutorService`)

The engine traverses the graph using a while-loop and a "visited" set to prevent infinite loops.

### Graph Traversal Process:
1. **Fetch Configuration**: Retrieves the `nodes` and `edges` from the `AutomationRule`.
2. **Safety Checks**: Before executing any node, `SafetyGuards` checks if the workspace has exceeded its rate limits or if this specific contact is in a "cool-down" period.
3. **Node Execution**: Each node type has a specific handler:
   - **`messageNode`**: Resolves variables (e.g., `{{contact.name}}`) and calls `WabaService.sendTextMessage`.
   - **`logicNode`**: Evaluates conditions using operators like `equals`, `contains`, `startsWith`, or `exists`. It determines which `sourceHandle` (`true` or `false`) to follow next.
   - **`addTagNode`**: Updates the `Contact` document in MongoDB.
   - **`assignConversationNode`**: Changes the `assignedTo` field on the `Conversation` model.
4. **Resumability**: For "Wait" or "Human Takeover" nodes, the execution state is persisted, and a timeout/webhook triggers the resumption.

## 3. Data Flow & Context

Each execution maintains a **Context Object** that is passed through the nodes:
```json
{
  "contact": { "id": "...", "name": "John", "phone": "..." },
  "conversation": { "id": "..." },
  "messageBody": "Hello",
  "variables": { "custom_var": "value" }
}
```
Variables can be accessed in text nodes using double curly braces: `Hello {{contact.name}}`.

## 4. Safety & Rate Limiting

- **Infinite Loop Prevention**: A set of `visited` node IDs is maintained during a single execution.
- **Spam Control**: The `SafetyGuards` service monitors the frequency of automated messages to a single contact to ensure compliance with WhatsApp policies.
- **Dry Run Support**: Flows can be executed in `isDryRun` mode where actions are logged but not actually dispatched to external APIs.

## 5. Execution Logging

Every run is recorded in the `AutomationExecution` collection, storing:
- The path taken through the graph.
- Results (Success/Failure) of each node.
- Duration of execution.
- Any error messages encountered.
