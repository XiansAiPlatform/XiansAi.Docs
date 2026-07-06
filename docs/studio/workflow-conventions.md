# Workflow Naming Conventions

The Agent Studio relies on **well-known workflow names** to connect to an agent's built-in workflows. When an agent follows these conventions, the Studio can wire up chat and webhooks automatically — no extra configuration required.

| Workflow name | Studio feature | SDK shorthand |
| --- | --- | --- |
| `Supervisor Workflow` | Chat — user conversations with the agent | `xiansAgent.Workflows.DefineSupervisor()` |
| `Integrator Workflow` | Webhooks — inbound HTTP integrations | `xiansAgent.Workflows.DefineIntegrator()` |

---

## Supervisor Workflow

By default, when a user opens a chat with an agent in the Studio, the Studio connects to the agent's built-in workflow named **`Supervisor Workflow`**. If the agent does not define a workflow with this exact name, the default chat experience cannot reach the agent.

Define it with the `DefineSupervisor()` shorthand and handle incoming messages with `OnUserChatMessage`:

```csharp
var conversationalWorkflow = xiansAgent.Workflows.DefineSupervisor();

conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    await context.ReplyAsync("Hello from the agent!");
});
```

`DefineSupervisor()` is equivalent to `DefineBuiltIn(name: "Supervisor Workflow")` — the shorthand exists so you never mistype the well-known name.

## Integrator Workflow

The Studio's default webhook endpoint routes inbound requests to the agent's built-in workflow named **`Integrator Workflow`**. Define it with the `DefineIntegrator()` shorthand and handle requests with `OnWebhook`:

```csharp
var webhookWorkflow = xiansAgent.Workflows.DefineIntegrator();

webhookWorkflow.OnWebhook((context) =>
{
    Console.WriteLine($"Received: {context.Webhook.Name}");
    context.Respond(new { status = "success" });
});
```

`DefineIntegrator()` is equivalent to `DefineBuiltIn(name: "Integrator Workflow")`.

---

## Complete Example

A minimal agent that supports both the Studio's default chat and default webhook:

```csharp
using Xians.Lib.Agents.Core;
using DotNetEnv;

Env.Load();

var serverUrl = Environment.GetEnvironmentVariable("XIANS_SERVER_URL")
    ?? throw new InvalidOperationException("XIANS_SERVER_URL environment variable is not set");
var xiansApiKey = Environment.GetEnvironmentVariable("XIANS_API_KEY")
    ?? throw new InvalidOperationException("XIANS_API_KEY environment variable is not set");

// Initialize the Xians Platform
var xiansPlatform = await XiansPlatform.InitializeAsync(new ()
{
    ServerUrl = serverUrl,
    ApiKey = xiansApiKey
});

// Register the agent
var xiansAgent = xiansPlatform.Agents.Register(new ()
{
    Name = "My Simple Agent"
});

// "Supervisor Workflow" — the Studio connects here for user chat
var conversationalWorkflow = xiansAgent.Workflows.DefineSupervisor();
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    await context.ReplyAsync($"You said: {context.Message.Text}");
});

// "Integrator Workflow" — the Studio's default webhook connects here
var webhookWorkflow = xiansAgent.Workflows.DefineIntegrator();
webhookWorkflow.OnWebhook((context) =>
{
    Console.WriteLine($"Received: {context.Webhook.Name}");
    context.Respond(new { status = "success" });
});

// Start the agent and all workflows
await xiansAgent.RunAllAsync();
```

## Notes

- The well-known names are defined in the SDK as constants: `WorkflowConstants.WorkflowTypes.Supervisor` (`"Supervisor Workflow"`) and `WorkflowConstants.WorkflowTypes.Integrator` (`"Integrator Workflow"`).
- Built-in workflow names are combined with the agent name internally (format: `{AgentName}:{WorkflowName}`), so different agents can each define their own Supervisor and Integrator workflows without conflict.
- These are **defaults** — the Studio can be configured to target other workflows, but following the conventions gives you chat and webhook support out of the box.
