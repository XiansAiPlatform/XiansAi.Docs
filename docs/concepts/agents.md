# Agents

## Build Anywhere, Manage Everywhere

Xians takes a fundamentally different approach to AI agents. We don't lock you into a proprietary framework or force you to rebuild your agents. Instead, **Xians is an agent management and operational platform** that lets you build agents with any framework you choose—Microsoft Agent Framework (MAF), LangChain, Semantic Kernel, or even raw OpenAI SDK—and provides the production-grade infrastructure to deploy, manage, and scale them.

## The Problem Xians Solves

Building an AI agent is one thing. **Operating it in production is another entirely.**

### The Challenge with Agent Frameworks

Most agent frameworks focus on the development experience:

- They help you build sophisticated reasoning loops
- They provide tools and prompt management
- They offer local testing and debugging

But when you're ready for production, you face critical questions:

- How do I deploy multiple agents across different tenants?
- How do I handle message routing and conversation state?
- How do I schedule agent tasks and manage workflows?
- How do I monitor performance and handle failures?
- How do I integrate with my existing systems via webhooks and APIs?

**This is where Xians comes in.**

## Xians: Your Agent Management Plane

Think of Xians as the **control plane for your AI agents**—the operational infrastructure that sits between your agent logic and your users, handling all the complexity of production deployment.

### What Xians Provides

**1. Agent Registration & Identity**

Your agents, built with any framework, register with Xians to get:

- Unique identity and authentication
- Tenant isolation and multi-tenancy support
- System or tenant-scoped deployment options

**2. Message & Conversation Management**

- Automatic message routing to the right agent
- Conversation threading and context management
- User message queuing and delivery guarantees

**3. Workflow Orchestration**

- Built-in workflows for common patterns
- Custom workflow definitions for complex logic
- Worker management and scaling

**4. Scheduling Infrastructure**

- Cron-based and interval schedules
- Time-based agent activation
- Automatic schedule lifecycle management

**5. Integration & Connectivity**

- Webhook triggers and callbacks
- Event streaming and notifications
- API-first architecture for external systems

## Core Architecture

### The Separation of Concerns

Xians embraces a clean architectural principle:

**Your Code (Agent Logic)**

- Build with ANY framework: MAF, LangChain, Semantic Kernel, OpenAI SDK
- Implement your AI reasoning, tools, and business logic
- Test and iterate locally with your preferred tooling

**Xians Platform (Operations)**

- Register your agent with Xians
- Define workflows and message handlers
- Configure schedules and integrations
- Deploy and scale across tenants

### Agent Registration Model

```csharp
// Initialize connection to Xians platform
var xiansPlatform = await XiansPlatform.InitializeAsync(new XiansOptions
{
    ServerUrl = "https://your-xians-instance.com",
    ApiKey = xiansApiKey  // Includes tenant context
});

// Register your agent (built with ANY framework)
var agent = xiansPlatform.Agents.Register(new XiansAgentRegistration
{
    Name = "CustomerSupportAgent",
    SystemScoped = true  // or tenant-scoped
});
```

## Quick Start: Connecting Your Agent

Here's how you connect an agent built with **any framework** to Xians:

### Step 1: Build Your Agent Logic

Use your preferred framework to implement the AI logic:

```csharp
// Your agent implementation - use ANY framework!
// This example uses OpenAI SDK, but could be MAF, LangChain, etc.
public class ConversationalAgent
{
    public static async Task<string> ProcessMessageAsync(
        IUserMessageContext context, 
        string openAiApiKey)
    {
        // Your AI logic here - framework agnostic
        var client = new OpenAIClient(openAiApiKey);
        var response = await client.GetChatCompletionAsync(
            model: "gpt-4",
            messages: BuildMessages(context)
        );
        
        return response.Content;
    }
}
```

### Step 2: Register with Xians & Define Workflows

Connect your agent to Xians operational infrastructure:

```csharp
// Register the agent
var agent = xiansPlatform.Agents.Register(new XiansAgentRegistration
{
    Name = "CustomerSupportAgent",
    SystemScoped = true
});

// Define workflow for handling user messages
var conversationalWorkflow = agent.Workflows.DefineBuiltIn(
    name: "Conversational", 
    workers: 1
);

// Connect your agent logic to the workflow
conversationalWorkflow.OnUserMessage(async (context) =>
{
    // Call YOUR agent implementation (any framework)
    var response = await ConversationalAgent.ProcessMessageAsync(
        context, 
        openAiApiKey
    );
    
    // Xians handles message delivery, threading, and state
    await context.ReplyAsync(response);
});
```

### Step 3: Add Schedules (Optional)

Enable time-based agent activation:

```csharp
// Define a custom workflow for scheduled tasks
var scheduledWorkflow = agent.Workflows.DefineCustom<DailyReportWorkflow>(
    workers: 1
);

// Xians automatically provides schedule infrastructure
// Your workflow can create schedules using built-in activities:
await scheduledWorkflow.Schedules
    .Create("daily-report")
    .WithCronSchedule("0 9 * * *")  // 9 AM daily
    .StartAsync();
```

### Step 4: Run Your Agent

```csharp
// Start all workflows - Xians handles message routing, 
// scaling, and operational concerns
await agent.RunAllAsync();
```

## Deployment Patterns

### Pattern 1: Multi-Workflow Agent

**One agent, multiple specialized workflows.**

```csharp
// Single agent with different workflows for different use cases
var agent = xiansPlatform.Agents.Register(new XiansAgentRegistration
{
    Name = "CustomerServiceHub",
    SystemScoped = true
});

// Conversational workflow for chat interactions
var chatWorkflow = agent.Workflows.DefineBuiltIn("Conversational", workers: 3);

// Web workflow for web-based interactions
var webWorkflow = agent.Workflows.DefineBuiltIn("Web", workers: 2);

// Custom workflow for background research
var researchWorkflow = agent.Workflows.DefineCustom<ResearchWorkflow>(workers: 1);
```

**Use Case**: Different interaction patterns for the same logical agent (chat, web, scheduled tasks).

### Pattern 2: Multi-Tenant Deployment

**Same agent logic, isolated per tenant.**

```csharp
// System-scoped agent serves ALL tenants
var agent = xiansPlatform.Agents.Register(new XiansAgentRegistration
{
    Name = "SharedAssistant",
    SystemScoped = true  // Xians handles tenant isolation
});

// Each tenant gets isolated conversations, data, and context
// Your agent logic remains the same
conversationalWorkflow.OnUserMessage(async (context) =>
{
    // context.TenantId automatically provided by Xians
    var response = await ProcessWithTenantContext(context);
    await context.ReplyAsync(response);
});
```

**Use Case**: SaaS applications where each customer needs their own agent instance.

### Pattern 3: Framework Agnostic

**Mix and match frameworks in the same deployment.**

```csharp
// One workflow using Microsoft Agent Framework
var mafWorkflow = agent.Workflows.DefineBuiltIn("MAF-Powered", workers: 1);
mafWorkflow.OnUserMessage(async (context) =>
{
    var response = await MyMAFAgent.ProcessAsync(context);
    await context.ReplyAsync(response);
});

// Another workflow using LangChain
var langchainWorkflow = agent.Workflows.DefineBuiltIn("LangChain-Powered", workers: 1);
langchainWorkflow.OnUserMessage(async (context) =>
{
    var response = await MyLangChainAgent.ProcessAsync(context);
    await context.ReplyAsync(response);
});
```

**Use Case**: Evaluate different frameworks or use the best tool for each specific task.

## Why This Architecture Matters

### The Old Way: DIY Everything

```text
Agent Logic + Message Queues + State Management + Scheduling + 
Tenant Isolation + Monitoring + Scaling + Deployment + ...
```

**Result**: Months building infrastructure instead of agent capabilities.

### The Xians Way: Focus on Your Agent

```text
Your Agent Logic (any framework) → Xians Platform (handles everything else)
```

**Result**: Production-ready deployment in hours, not months.

## Real-World Example

### Before Xians: The Infrastructure Nightmare

```csharp
// Build your agent
var agent = new MyAIAgent();

// Now build everything else...
var messageQueue = await SetupRabbitMQ();
var stateStore = await SetupRedis();
var scheduler = await SetupHangfire();

// Handle message routing manually
await messageQueue.Subscribe("user-messages", async msg =>
{
    // Parse tenant context
    var tenantId = ExtractTenant(msg);
    
    // Load conversation state
    var state = await stateStore.GetConversationState(msg.ThreadId);
    
    // Process with agent
    var response = await agent.Process(msg, state);
    
    // Save state
    await stateStore.SaveConversationState(msg.ThreadId, state);
    
    // Send response
    await SendToUser(response, tenantId);
});

// Setup scheduled tasks manually
await scheduler.Schedule(() => 
{
    // Figure out which tenant, which agent, which context...
    await agent.PerformScheduledTask();
}, "0 9 * * *");

// And we haven't even touched deployment, scaling, monitoring...
```

### With Xians: Focus on Agent Logic

```csharp
// 1. Build your agent with ANY framework
public class MyAgent
{
    public static async Task<string> ProcessAsync(
        IUserMessageContext context,
        string apiKey)
    {
        // Your AI logic here - use MAF, LangChain, whatever you want
        return await YourFramework.Process(context.Message);
    }
}

// 2. Connect to Xians
var xians = await XiansPlatform.InitializeAsync(options);
var agent = xians.Agents.Register(new XiansAgentRegistration
{
    Name = "MyAgent",
    SystemScoped = true
});

// 3. Define workflow and connect your logic
var workflow = agent.Workflows.DefineBuiltIn("Conversational", workers: 1);
workflow.OnUserMessage(async (context) =>
{
    // Xians automatically provides:
    // - Tenant context (context.TenantId)
    // - Conversation threading (context.ThreadId)
    // - Message delivery guarantees
    // - State management
    
    var response = await MyAgent.ProcessAsync(context, apiKey);
    await context.ReplyAsync(response);
});

// 4. Run it
await agent.RunAllAsync();

// That's it. Xians handles:
// ✅ Message routing and queuing
// ✅ Conversation state and threading
// ✅ Tenant isolation
// ✅ Scaling and worker management
// ✅ Scheduled task infrastructure
// ✅ Webhook integration
// ✅ Monitoring and health checks
```

## Framework Compatibility

Xians is **100% framework agnostic**. Build with:

### Microsoft Agent Framework (MAF)

```csharp
// Your MAF agent
var mafAgent = new AgentBuilder()
    .WithModel("gpt-4")
    .WithTools(...)
    .Build();

// Connect to Xians
workflow.OnUserMessage(async (context) =>
{
    var response = await mafAgent.ExecuteAsync(context.Message);
    await context.ReplyAsync(response);
});
```

### LangChain

```python
# Your LangChain agent
from langchain.agents import create_openai_functions_agent

agent = create_openai_functions_agent(llm, tools, prompt)

# Connect to Xians via SDK
@workflow.on_user_message
async def handle(context):
    response = await agent.ainvoke({"input": context.message})
    await context.reply(response)
```

### Semantic Kernel

```csharp
// Your SK agent
var kernel = Kernel.CreateBuilder()
    .AddOpenAIChatCompletion(...)
    .Build();

// Connect to Xians
workflow.OnUserMessage(async (context) =>
{
    var response = await kernel.InvokeAsync(context.Message);
    await context.ReplyAsync(response);
});
```

### Raw OpenAI SDK

```csharp
// Direct OpenAI calls
var openAI = new OpenAIClient(apiKey);

workflow.OnUserMessage(async (context) =>
{
    var response = await openAI.GetChatCompletionAsync(...);
    await context.ReplyAsync(response.Content);
});
```

## Best Practices

**✅ DO:**

- **Choose the right framework** for your agent logic—Xians supports them all
- **Use SystemScoped** for multi-tenant deployments
- **Leverage workflows** to separate concerns (chat vs. scheduled tasks vs. web interactions)
- **Let Xians manage state** instead of building your own infrastructure
- **Use built-in schedules** for time-based agent activation
- **Test locally** with your framework, then deploy to Xians for production

**❌ DON'T:**

- **Build your own message queues**—Xians provides production-ready infrastructure
- **Mix operational concerns with agent logic**—keep them separate
- **Ignore tenant context**—always use `context.TenantId` for isolation
- **Hardcode credentials**—use environment variables and Xians authentication
- **Skip error handling** in your agent logic—Xians handles delivery, but your logic should be robust

## Key Benefits of the Xians Approach

### 🎨 **Framework Freedom**

Build with MAF today, switch to LangChain tomorrow. Xians doesn't care—it manages operations, not your AI logic.

### 🏗️ **Production Infrastructure**

Message routing, state management, scheduling, tenant isolation—all handled by Xians out of the box.

### 📈 **Built-in Scaling**

Configure worker counts per workflow. Xians automatically manages load distribution and scaling.

### 🔒 **Multi-Tenancy by Default**

Deploy once, serve many tenants with complete data isolation and security.

### ⚡ **Rapid Development**

Focus on agent capabilities, not infrastructure. Get to production in hours, not months.

## Going Deeper

Your agents become even more powerful when you leverage Xians' full operational platform:

- **[Workflows](workflows.md)**: Orchestrate complex agent processes with built-in and custom workflows
- **[Messages](messages.md)**: Rich, stateful communication with automatic threading and context management
- **[Knowledge](knowledge.md)**: Connect agents to your data with the document database
- **Schedules**: Time-based agent activation with cron and interval schedules
- **[Webhooks](webhooks.md)**: Trigger agents from external events and systems
- **[Tenants](tenants.md)**: Multi-tenant deployment with complete isolation

---

**The Bottom Line**: Xians is not an agent framework—it's the **operational platform** that makes your agents production-ready. Build with any framework you love, deploy with infrastructure you trust.
