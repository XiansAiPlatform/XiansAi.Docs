# Knowledge

## Give Your Agents Domain Expertise

LLMs are smart, but they don't know **your** business. Your products, your policies, your documentation. Knowledge bases solve this through **Retrieval-Augmented Generation (RAG)**—letting agents search your content and ground their answers in your truth.

## What is Agent Knowledge?

Every agent has its own **private knowledge base**—a key-value store for information your agent needs to retrieve. Think of it as your agent's memory:

- **System instructions** that customize agent behavior
- **Product catalogs** for a sales agent
- **Company policies** for a support agent  
- **User preferences** for a personalization agent
- **Workflow instructions** for complex processes

Knowledge is **automatically scoped** to each agent. Agent A can't access Agent B's knowledge—perfect for multi-tenant applications.

## Retrieving Knowledge

### Get Specific Knowledge

```csharp
var agent = XiansContext.GetAgent(agentName); // or var agent = XiansContext.CurrentAgent;

// Get specific knowledge by name
var knowledge = await agent.Knowledge.GetAsync("welcome-message");

if (knowledge != null)
{
    Console.WriteLine($"Content: {knowledge.Content}");
    Console.WriteLine($"Type: {knowledge.Type}");
}
```

**Supported knowledge types:**

- `"text"` - Plain text content
- `"markdown"` - Formatted documentation with Markdown syntax
- `"json"` - Structured data

### List All Knowledge

```csharp
// See everything your agent knows
var allKnowledge = await agent.Knowledge.ListAsync();

foreach (var item in allKnowledge)
{
    Console.WriteLine($"Name: {item.Name}");
    Console.WriteLine($"Type: {item.Type}");
    Console.WriteLine($"Content: {item.Content}");
    Console.WriteLine($"System Scoped: {item.SystemScoped}");
    Console.WriteLine();
}
```

## Knowledge in Workflows

Knowledge retrieval works seamlessly **inside workflows**—the SDK automatically handles context switching:

```csharp
[Workflow("CustomerSupport:HandleTicket")]
public class TicketWorkflow
{
    [WorkflowRun]
    public async Task<string> RunAsync(string customerId)
    {
        // Get agent from workflow context
        var agent = XiansContext.GetAgent("SupportAgent");
        
        // Retrieve knowledge - automatically uses progressive fallback
        // Checks: instance-specific → tenant-specific → system default
        var instructions = await agent.Knowledge.GetAsync("system-instructions");
        
        // Use the most specific version available
        return $"Processing ticket with instructions: {instructions?.Content}";
    }
}
```

The SDK uses **context-aware execution** to route workflow calls through Temporal activities automatically, and the server applies the progressive fallback to find the most specific knowledge for this agent run.

## Progressive Knowledge Retrieval

The Xians platform uses a **progressive fallback mechanism** when retrieving knowledge, allowing you to override defaults at multiple levels:

### Fallback Hierarchy

When you call `GetAsync("knowledge-name")`, the server checks for knowledge in this order:

1. **Instance-Scoped** (`tenant/agent/activation`) - Most specific to this agent run
2. **Tenant-Scoped** (`tenant/agent`) - Specific to this tenant's agent
3. **System-Scoped** (`system/agent`) - Template/default knowledge shared across all tenants

The server returns the **first match found**, making knowledge progressively more specific.

### How It Works

```csharp
var knowledge = await agent.Knowledge.GetAsync("greeting");
```

### Benefits

✅ **Defaults for all** - System-scoped knowledge provides baseline behavior  
✅ **Tenant customization** - Each tenant can override with their branding/rules  
✅ **Instance personalization** - Individual agent runs can be further customized  
✅ **Efficient storage** - Only store overrides, not duplicate defaults

## Caching

Knowledge reads are **cached** for better performance. The cache is invalidated automatically when you update or delete knowledge.

Cache duration is configurable via `XiansOptions.Cache.Knowledge.TtlMinutes`:

```csharp
var platform = await XiansPlatform.InitializeAsync(new XiansOptions
{
    ApiKey = yourApiKey,
    Cache = new CacheOptions
    {
        Knowledge = new CacheAspectOptions
        {
            Enabled = true,
            TtlMinutes = 10   // Default: 10 minutes
        }
    }
});
```

## Agent Isolation

Each agent's knowledge is **completely isolated**:

```csharp
// Sales agent retrieves its knowledge
var salesPricing = await salesAgent.Knowledge.GetAsync("pricing");

// Support agent cannot see Sales agent's knowledge
var leaked = await supportAgent.Knowledge.GetAsync("pricing");
// Returns null - agents are isolated by tenant and name
```

Even if two agents use the **same knowledge name**, they maintain separate copies. Perfect for multi-tenant SaaS applications.

## Common Usage Patterns

### Retrieving System Instructions

```csharp
// In your message handler, retrieve system instructions
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var agent = XiansContext.GetAgent("CustomerSupportAgent");
    var systemInstructions = await agent.Knowledge.GetAsync("system-instructions");
    
    // Build your LLM messages with the retrieved instructions
    var messages = new List<ChatMessage>
    {
        new SystemMessage(systemInstructions?.Content ?? "Default instructions"),
        new UserMessage(context.Message.Text)
    };
    
    var response = await llm.GetCompletionAsync(messages);
    await context.ReplyAsync(response);
});
```

### Loading Configuration

```csharp
// Retrieve configuration at runtime
var config = await agent.Knowledge.GetAsync("api-config");
if (config != null && config.Type == "json")
{
    var settings = JsonSerializer.Deserialize<ApiSettings>(config.Content);
    // Use settings...
}
```

### Accessing Product Catalogs

```csharp
// Retrieve product information
var catalog = await agent.Knowledge.GetAsync("product-catalog");
if (catalog != null)
{
    // Use catalog content in your agent logic
    Console.WriteLine($"Product catalog: {catalog.Content}");
}
```