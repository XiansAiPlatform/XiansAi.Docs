# Temporal Workflows

Use Temporal workflows to run durable, fault-tolerant business processes with Xians. Workflows orchestrate **activities**—units of work that can call external APIs, access databases, or perform other non-deterministic operations.

This guide shows a minimal setup: one workflow, one activity, and all configuration in `Program.cs`.

---

## Prerequisites

- .NET 9 SDK
- Xians platform instance (server URL and agent certificate)
- See [Quick Start](quick-start.md) for project creation and Xians connection

---

## Project Setup

Add the required packages:

```bash
dotnet add package DotNetEnv
dotnet add package Xians.Lib
```

Add a project reference to Xians.Lib if using a local build, or the NuGet package as shown above.

---

## 1. Create the Activity Class

Activities perform the actual work. They can call APIs, access databases, or do any I/O. Mark methods with `[Activity]`:

**`GreetingActivities.cs`**

```csharp
using Temporalio.Activities;

public class GreetingActivities
{
    [Activity]
    public Task<string> BuildGreetingAsync(string name)
    {
        return Task.FromResult($"Hello, {name}!");
    }
}
```

---

## 2. Create the Workflow Class

Workflows orchestrate activities. They must be deterministic (no direct I/O, no `DateTime.UtcNow`, etc.). Use `Workflow.ExecuteActivityAsync` to call activities:

**`GreetingWf.cs`**

```csharp
using Temporalio.Exceptions;
using Temporalio.Workflows;

[Workflow("MyAgent:Greeting Workflow")]
public class GreetingWf
{
    private static readonly ActivityOptions Options = new()
    {
        StartToCloseTimeout = TimeSpan.FromMinutes(1),
        RetryPolicy = new RetryPolicy { MaximumAttempts = 3, BackoffCoefficient = 2 },
    };

    [WorkflowRun]
    public async Task<string> RunAsync(string name)
    {
        try
        {
            var greeting = await Workflow.ExecuteActivityAsync(
                (GreetingActivities a) => a.BuildGreetingAsync(name),
                Options);
            return greeting;
        }
        catch (Exception ex)
        {
            Workflow.Logger.LogError($"Greeting workflow failed: {ex.Message}", ex);
            throw new ApplicationFailureException($"Greeting workflow failed: {ex.Message}");
        }
    }
}
```

Key points:

- `[Workflow("AgentName:Workflow Name")]` — Must match the agent name you register.
- `[WorkflowRun]` — Marks the workflow entry point.
- `Workflow.ExecuteActivityAsync` — Invokes an activity; use lambda syntax for type-safe calls.

---

## 3. Set Up Program.cs

Initialize the platform, register the agent, define the workflow with its activities, and start the worker:

**`Program.cs`**

```csharp
using DotNetEnv;
using Microsoft.Extensions.Logging;
using Xians.Lib.Agents.Core;

Env.Load();

var serverUrl = Environment.GetEnvironmentVariable("XIANS_SERVER_URL")
    ?? throw new InvalidOperationException("XIANS_SERVER_URL required");
var apiKey = Environment.GetEnvironmentVariable("XIANS_API_KEY")
    ?? throw new InvalidOperationException("XIANS_API_KEY required");

// Initialize Xians Platform
var xiansPlatform = await XiansPlatform.InitializeAsync(new()
{
    ServerUrl = serverUrl,
    ApiKey = apiKey,
    ConsoleLogLevel = LogLevel.Information,
    ServerLogLevel = LogLevel.Information,
});

// Register agent
var agent = xiansPlatform.Agents.Register(new()
{
    Name = "MyAgent",
    IsTemplate = false,
});

// Define workflow and attach activities
agent.Workflows
    .DefineCustom<GreetingWf>(new WorkflowOptions { Activable = true })
    .AddActivity(new GreetingActivities());

// Start the agent (connects to Temporal and runs workers)
Console.WriteLine("Starting agent...");
await agent.RunAllAsync(CancellationToken.None);
```

---

## 4. Configure Environment

Create a `.env` file:

```bash
XIANS_SERVER_URL=https://your-xians-server.com
XIANS_API_KEY=your-agent-certificate
```

---

## How It Works

1. **XiansPlatform.InitializeAsync** — Connects to the Xians server and fetches Temporal configuration.
2. **Agents.Register** — Registers your agent with the platform.
3. **DefineCustom&lt;GreetingWf&gt;** — Registers the workflow type; `Activable = true` allows users to start it from the UI.
4. **AddActivity** — Binds the activity instance to the workflow so Temporal can execute it.
5. **RunAllAsync** — Starts Temporal workers that poll for and execute workflow tasks.

Workflows run in Temporal’s durable execution environment. If a worker crashes or restarts, workflows resume from the last successful activity. Activities can retry on failure based on `RetryPolicy`.

---

## Further Reading

- **[Unit Testing Temporal Workflows](../concepts/unit-tests.md)** — Test workflows in isolation with Temporal's time-skipping environment and Xians Local Mode. Includes setup, embedding knowledge, and running tests.
- **[Scheduling Workflows](../concepts/scheduling.md)** — Run workflows on a schedule (cron, interval, or one-shot). Configure schedules per workflow and manage them programmatically or via the platform UI.

See also [Logging](../concepts/logging.md) for workflow and activity logging.
