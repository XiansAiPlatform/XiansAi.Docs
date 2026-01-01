# Messages

## The Communication Fabric

Think of messages as the nervous system of your AI application. They're not just text going back and forth—they're **the conversational memory** that makes your agents intelligent, contextual, and truly helpful.

## The Context Problem

Here's what breaks most AI chatbots:

**Traditional Chatbots:**
```
User: "I need help with my order"
Bot: "What order number?"
User: "The one from yesterday"
Bot: "I don't see any order" ← Forgot everything
```

**With Message Threading:**
```
User: "I need help with my order"
Bot: "I see you have order #12345 from yesterday. What do you need help with?"
User: "Change the shipping address"
Bot: "I'll update order #12345 for you" ← Remembers context
```

## Why Messages Transform AI Development

### The Challenge: Stateless LLMs
LLMs don't remember conversations. Every interaction is isolated unless you manually manage context.

### The Solution: Message Threads
Messages in Xians.ai provide:
- **Persistent Memory**: Conversations survive across sessions
- **Contextual Understanding**: Agents see the full history
- **Multi-Turn Dialogues**: Complex conversations that build on previous exchanges
- **Rich Data Exchange**: Not just text—structured data, files, actions

## Core Concepts

### Message Structure

```typescript
{
  id: "msg_abc123",
  threadId: "conv_xyz789",        // Links messages together
  role: "user" | "agent" | "system",
  content: "What's my account balance?",
  timestamp: "2024-12-29T10:30:00Z",
  metadata: {
    userId: "user_456",
    agentId: "support-agent",
    sentiment: "neutral"
  }
}
```

### Thread = Conversation

```typescript
// Same thread = shared context
const thread = await xians.createThread({
  userId: "user_123",
  metadata: { 
    channel: "web-chat",
    priority: "normal"
  }
});

// All messages share context
await agent.sendMessage({
  threadId: thread.id,
  content: "What's my order status?"  // Agent sees full history
});
```

## Message Patterns That Matter

### Pattern 1: Conversational Continuity
**Agents that remember.**

```typescript
// Message 1
await supportAgent.chat({
  threadId: "thread_123",
  message: "I can't log in"
});
// Agent response: "Let me help. What error do you see?"

// Message 2 - Agent remembers the login issue
await supportAgent.chat({
  threadId: "thread_123",  // Same thread
  message: "It says invalid password"
});
// Agent: "I'll send you a password reset for your account ending in 4567"
```

### Pattern 2: Rich Structured Messages
**Beyond plain text.**

```typescript
// Agent sends structured data
{
  role: "agent",
  content: {
    type: "order-summary",
    orderId: "12345",
    items: [...],
    total: 299.99,
    actions: [
      { label: "Track Shipment", action: "track" },
      { label: "Cancel Order", action: "cancel" }
    ]
  }
}
```

### Pattern 3: Multi-Modal Communication
**Text, files, images, data.**

```typescript
await agent.sendMessage({
  threadId: "thread_123",
  content: "Here's your monthly report",
  attachments: [
    {
      type: "pdf",
      url: "https://storage/report.pdf",
      name: "December_Report.pdf"
    }
  ],
  metadata: {
    generated: true,
    reportPeriod: "2024-12"
  }
});
```

## Why This Changes AI Development

### Without Message Management
```javascript
// You manually track everything
const conversationHistory = [];
conversationHistory.push({ role: "user", content: userInput });

const response = await openai.chat.completions.create({
  messages: conversationHistory  // Hope this doesn't exceed context window
});

conversationHistory.push({ role: "assistant", content: response });
// Manually store in database, handle pagination, prune old messages...
```

### With Xians Messages
```typescript
// Just send. Threading and context handled automatically.
const response = await agent.chat({
  message: userInput,
  threadId: conversation.id  // That's it.
});

// Access full history anytime
const history = await thread.getMessages();
```

## Smart Context Management

### Automatic Context Windows

```typescript
const agent = await xians.createAgent({
  name: "SupportAgent",
  model: "gpt-4",
  contextConfig: {
    maxMessages: 50,           // Keep last 50 messages
    maxTokens: 8000,            // Stay within token limits
    strategy: "sliding-window"  // Auto-prune old messages
  }
});
```

### Selective Context

```typescript
// Include only relevant messages
const response = await agent.chat({
  message: "Summarize my orders",
  threadId: "thread_123",
  contextFilter: {
    includeRoles: ["user", "agent"],  // Skip system messages
    sinceTimestamp: lastWeek,
    relevanceScore: 0.7  // AI filters relevant messages
  }
});
```

## Message Metadata: The Secret Sauce

### Track Everything That Matters

```typescript
await agent.sendMessage({
  threadId: "thread_123",
  content: "Issue resolved!",
  metadata: {
    // Routing
    assignedTo: "agent-456",
    priority: "high",
    
    // Analytics
    sentiment: "positive",
    resolutionTime: 180,  // seconds
    category: "billing",
    
    // Business context
    customerId: "cust_789",
    ticketId: "TKT-001",
    
    // Custom
    aiConfidence: 0.95,
    humanReview: false
  }
});
```

### Query by Metadata

```typescript
// Find all high-priority unresolved conversations
const threads = await xians.findThreads({
  metadata: {
    priority: "high",
    status: "open"
  }
});
```

## Real-World Example

### Before: Manual Context Hell

```javascript
// Store conversation manually
const sessionData = await redis.get(`session:${userId}`);
let history = JSON.parse(sessionData || '[]');

history.push({ role: 'user', content: message });

// Manually manage token limits
if (estimateTokens(history) > 6000) {
  history = history.slice(-20);  // Drop old messages
}

const response = await openai.chat.completions.create({
  messages: history
});

history.push({ role: 'assistant', content: response.content });
await redis.set(`session:${userId}`, JSON.stringify(history));
```

### After: Let Xians Handle It

```typescript
// Just chat. Context, storage, pruning handled automatically.
const response = await supportAgent.chat({
  message: userMessage,
  threadId: userSession.threadId
});
```

## Advanced Patterns

### Human Handoff

```typescript
// Agent escalates to human
await agent.sendMessage({
  threadId: "thread_123",
  content: "I'm transferring you to a specialist.",
  metadata: {
    handoff: true,
    handoffReason: "complex-issue",
    assignTo: "human-support-team"
  }
});

// Human sees full context
const context = await thread.getMessages();
```

### Multi-Agent Conversations

```typescript
// Multiple agents in one thread
await agent1.chat({ 
  threadId: "thread_123",
  message: "Analyze this customer request"
});

await agent2.chat({
  threadId: "thread_123",  // Same thread
  message: "Based on previous analysis, recommend solution"
});
```

### Branching Conversations

```typescript
// Create sub-thread for specific topic
const subThread = await thread.createBranch({
  fromMessageId: "msg_789",
  topic: "technical-details"
});
```

## Integration Points

Messages become powerful when combined with:

- **[Agents](agents.md)**: Process messages intelligently
- **[Workflows](workflows.md)**: Route messages through complex processes
- **[Webhooks](webhooks.md)**: Trigger external systems on message events
- **[Document DB](document-db.md)**: Store rich message context

---

**The Bottom Line**: Messages turn one-off LLM calls into intelligent, contextual conversations. They're the difference between a bot that answers questions and an AI assistant that actually understands your users.
