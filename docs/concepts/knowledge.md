# Knowledge

## Give Your Agents Domain Expertise

LLMs are smart, but they don't know **your** business. Your products, your policies, your documentation. Knowledge bases solve this through **Retrieval-Augmented Generation (RAG)** - letting agents search your content and ground their answers in your truth.

## What is Agent Knowledge?

Every agent has its own **private knowledge base** - a key-value store for information your agent needs to remember and retrieve. Think of it as your agent's memory:

- **System instructions** that users create to customize agent behavior
- **Product catalogs** for a sales agent
- **Company policies** for a support agent  
- **User preferences** for a personalization agent
- **Workflow instructions** for complex processes

Knowledge is **automatically scoped** to each agent. Agent A can't access Agent B's knowledge - perfect for multi-tenant applications.

## Managing Knowledge

### Create or Update Knowledge

```csharp
var agent = XiansContext.GetAgent(agentName); // or var agent = XiansContext.CurrentAgent;
// Create or update knowledge
await agent.Knowledge.UpdateAsync(
    knowledgeName: "welcome-message",
    content: "Welcome! How can I help you today?",
    type: "text"
);
```

**Supported knowledge types:**

- `"text"` - Plain text content
- `"markdown"` - Formatted documentation with Markdown syntax
- `"json"` - Structured data

Any other type value is treated as `"text"`.

### Retrieve Knowledge

```csharp
// Get specific knowledge
var knowledge = await agent.Knowledge.GetAsync("welcome-message");

if (knowledge != null)
{
    Console.WriteLine($"Content: {knowledge.Content}");
    Console.WriteLine($"Type: {knowledge.Type}");
}
```

### List All Knowledge

```csharp
// See everything your agent knows
var allKnowledge = await agent.Knowledge.ListAsync();

foreach (var item in allKnowledge)
{
    Console.WriteLine($"{item.Name}: {item.Type}");
}
```

### Delete Knowledge

```csharp
// Remove outdated knowledge
var deleted = await agent.Knowledge.DeleteAsync("old-policy");
// Returns true if deleted, false if not found
```

## Knowledge in Workflows

Knowledge operations work seamlessly **inside workflows** - the SDK automatically handles context switching:

```csharp
[Workflow("CustomerSupport:HandleTicket")]
public class TicketWorkflow
{
    [WorkflowRun]
    public async Task<string> RunAsync(string customerId)
    {
        // Get agent from workflow context
        var agent = XiansContext.GetAgent("SupportAgent");
        
        // Retrieve customer preferences mid-workflow
        var prefs = await agent.Knowledge.GetAsync($"customer-{customerId}");
        
        // Use knowledge to personalize response
        return $"Hello! I see you prefer {prefs?.Content}";
    }
}
```

The SDK uses **context-aware execution** to route workflow calls through Temporal activities automatically.

## Agent Isolation

Each agent's knowledge is **completely isolated**:

```csharp
// Agent 1 creates knowledge
await salesAgent.Knowledge.UpdateAsync("pricing", "Enterprise: $999/mo");

// Agent 2 cannot see Agent 1's knowledge
var leaked = await supportAgent.Knowledge.GetAsync("pricing");
// Returns null - agents are isolated by tenant and name
```

Even if two agents use the **same knowledge name**, they maintain separate copies. Perfect for multi-tenant SaaS applications.

## Best Practices

**Use descriptive names** with prefixes:
```csharp
// Good: Organized and searchable
await agent.Knowledge.UpdateAsync("config.api.timeout", "30000");
await agent.Knowledge.UpdateAsync("user-123-preferences", "dark-mode");
await agent.Knowledge.UpdateAsync("template_greeting_morning", "Good morning!");
```

**Choose appropriate types**:
```csharp
// Plain text for instructions or simple content
await agent.Knowledge.UpdateAsync(
    "onboarding-flow",
    "Step 1: Verify email\nStep 2: Set password\nStep 3: Complete profile",
    "text"
);

// Structured data for parsing
await agent.Knowledge.UpdateAsync(
    "api-config",
    "{\"timeout\":30,\"retries\":3}",
    "json"
);

// Markdown for formatted documentation
await agent.Knowledge.UpdateAsync(
    "user-guide",
    "# Getting Started\n\n## Step 1\nConnect your account...",
    "markdown"
);
```

**Handle large content**:
```csharp
// Knowledge supports large content (tested up to 10KB+)
var largeDoc = File.ReadAllText("product-catalog.md");
await agent.Knowledge.UpdateAsync("product-catalog", largeDoc, "markdown");
```

## Common Patterns

### System Instructions (User-Created)

One of the most powerful uses of knowledge is storing **system instructions** that users create to customize how their agent behaves.

```csharp
// User creates custom system instructions through your UI
var userInstructions = @"You are a friendly customer support agent.
Always greet customers warmly and ask how their day is going.
When dealing with complaints, empathize first before offering solutions.
Use casual language and avoid corporate jargon.";

// Store as agent knowledge
await agent.Knowledge.UpdateAsync(
    "system-instructions",
    userInstructions,
    "text"
);

// Later, in your message handler, retrieve and use them
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var agent = XiansContext.GetAgent("CustomerSupportAgent");
    var systemInstructions = await agent.Knowledge.GetAsync("system-instructions");
    
    // Build your LLM messages with user's custom instructions
    var messages = new List<ChatMessage>
    {
        new SystemMessage(systemInstructions?.Content ?? "Default instructions"),
        new UserMessage(context.Message.Text)
    };
    
    var response = await llm.GetCompletionAsync(messages);
    await context.Messages.ReplyAsync(response);
});
```

This lets users **fully customize their agent's personality and behavior** without code changes or redeployment.

---

### User Preferences
```csharp
// Store per-user settings
await agent.Knowledge.UpdateAsync(
    $"user-{userId}-settings",
    JsonSerializer.Serialize(userPrefs),
    "json"
);
```

### Dynamic Instructions
```csharp
// Update agent behavior without redeploying
await agent.Knowledge.UpdateAsync(
    "current-promotion",
    "Offer 20% off for new customers this week",
    "text"
);
```

### Configuration Management
```csharp
// Centralized config accessible to all agent workflows
await agent.Knowledge.UpdateAsync("feature-flags", "{'newUI': true}", "json");
```
