# Knowledge

## Give Your Agents Domain Expertise

LLMs are smart, but they don't know **your** business. Your products, your policies, your documentation. Knowledge bases solve this through **Retrieval-Augmented Generation (RAG)**—letting agents search your content and ground their answers in your truth.

## What is Agent Knowledge?

Every agent has its own **private knowledge base**—a key-value store for information your agent needs to remember and retrieve. Think of it as your agent's memory:

- **System instructions** that users create to customize agent behavior
- **Product catalogs** for a sales agent
- **Company policies** for a support agent  
- **User preferences** for a personalization agent
- **Workflow instructions** for complex processes

Knowledge is **automatically scoped** to each agent. Agent A can't access Agent B's knowledge—perfect for multi-tenant applications.

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

## Embedding Knowledge in Source Code

For knowledge that should be deployed with your agent (like system prompts, default instructions, or documentation), you can **embed files as resources** in your assembly and upload them automatically at startup.

### Step 1: Add Files to Your Project

Create your knowledge files in your project:

```
YourAgent/
├── Program.cs
├── YourAgent.csproj
└── Knowledge/
    ├── system-prompt.md
    ├── user-guide.md
    └── api-config.json
```

### Step 2: Configure Embedded Resources

In your `.csproj` file, use glob patterns to embed files:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <!-- ... other configuration ... -->
  
  <ItemGroup>
    <!-- Embed all .md files in the Knowledge folder -->
    <EmbeddedResource Include="Knowledge\**\*.md" />
    
    <!-- Embed all .json files in the Knowledge folder -->
    <EmbeddedResource Include="Knowledge\**\*.json" />
  </ItemGroup>
</Project>
```

**Glob Pattern Options:**

- `**` = Match any number of subdirectories (recursive)
- `*` = Match any characters in a filename
- `Knowledge\**\*.md` = All `.md` files in `Knowledge/` and subfolders
- `Knowledge\*.md` = Only `.md` files directly in `Knowledge/` (no subfolders)

### Step 3: Upload Resources at Startup

The Xians SDK includes built-in support for loading embedded resources through the `UploadEmbeddedResourceAsync` extension method.

```csharp
using Xians.Lib.Agents.Core;
using Xians.Lib.Agents.Knowledge;  // For UploadEmbeddedResourceAsync extension

// Register your agent
var agent = xiansPlatform.Agents.Register(new XiansAgentRegistration
{
    Name = "MyAgent",
    Description = "My intelligent agent",
    SystemScoped = true  // System-scoped for multi-tenant sharing
});

// Upload embedded knowledge resources
await agent.Knowledge.UploadEmbeddedResourceAsync(
    resourcePath: "Knowledge/system-prompt.md",
    knowledgeName: "system-prompt",
    knowledgeType: "markdown"
);

await agent.Knowledge.UploadEmbeddedResourceAsync(
    resourcePath: "Knowledge/user-guide.md",
    knowledgeName: "user-guide"
    // Type is auto-inferred from .md extension
);

await agent.Knowledge.UploadEmbeddedResourceAsync(
    resourcePath: "Knowledge/api-config.json"
    // Name and type are auto-inferred
);

// Continue with workflow setup...
```

**How it works:**

- The SDK automatically finds the embedded resource in your assembly
- Resource path is converted to the correct format (e.g., `Knowledge/prompt.md` → `YourAssembly.Knowledge.prompt.md`)
- File type is inferred from extension (`.md` → `"markdown"`, `.json` → `"json"`, etc.)
- If the resource is not found, you'll get a helpful error message listing all available resources

### Upload Behavior & Scoping

Knowledge uploads follow smart deduplication rules based on **content** and **scope**:

#### ✅ Same Content + Same Scope (SystemScope=true/false)

**Returns existing knowledge (no duplication)**

```csharp
// First upload
await agent.Knowledge.UpdateAsync("prompt", "You are a helpful assistant", "text", systemScoped: true);

// Second upload with same content and scope - no new version created
await agent.Knowledge.UpdateAsync("prompt", "You are a helpful assistant", "text", systemScoped: true);
// ✅ Returns existing knowledge
```

#### 🆕 Same Content + Different Scope

**Creates new version with the requested scope**

This allows **system-wide defaults** to coexist with **tenant-specific overrides**:

```csharp
// System admin creates system-scoped knowledge (shared across all tenants)
await agent.Knowledge.UpdateAsync(
    "default-greeting", 
    "Hello! How can I help?", 
    "text", 
    systemScoped: true
);

// Later, a specific tenant creates tenant-scoped version with same content
await agent.Knowledge.UpdateAsync(
    "default-greeting", 
    "Hello! How can I help?",  // Same content
    "text", 
    systemScoped: false  // Different scope
);
// 🆕 Creates tenant-specific version
```

**Multi-tenancy Pattern:**

- System-scoped knowledge exists → All tenants use it by default
- Tenant creates tenant-scoped version → That tenant uses their version
- Other tenants continue using system-scoped version

#### 🆕 Different Content

**Creates new version (regardless of scope)**

```csharp
// Original version
await agent.Knowledge.UpdateAsync("greeting", "Hello!", "text", systemScoped: true);

// Updated content - creates new version
await agent.Knowledge.UpdateAsync("greeting", "Hi there!", "text", systemScoped: true);
// 🆕 Creates new version with updated content
```

### System-Scoped vs Tenant-Scoped

**System-Scoped Knowledge** (`systemScoped: true`):

- Shared across **all tenants**
- Perfect for default prompts, common documentation, shared configurations
- Requires system-scoped agent or explicit override

**Tenant-Scoped Knowledge** (`systemScoped: false`):

- Isolated to a **specific tenant**
- Perfect for customer-specific customizations, private data
- Default for non-system-scoped agents

**Automatic Inheritance:**

```csharp
// System-scoped agent automatically creates system-scoped knowledge
var agent = xiansPlatform.Agents.Register(new XiansAgentRegistration
{
    SystemScoped = true  // Agent is system-scoped
});

await agent.Knowledge.UpdateAsync("prompt", "Default prompt", "text");
// ✅ Automatically system-scoped (inherits from agent)

// Can override if needed
await agent.Knowledge.UpdateAsync("prompt", "Tenant prompt", "text", systemScoped: false);
// 🆕 Creates tenant-scoped version
```

## Knowledge in Workflows

Knowledge operations work seamlessly **inside workflows**—the SDK automatically handles context switching:

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
    await context.ReplyAsync(response);
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