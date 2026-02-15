# Unit Testing Temporal Workflows with Xians

Run your Temporal workflows in isolation—no server, no network, just fast, deterministic tests. This guide shows you how to combine **Temporal's time-skipping test environment** with **Xians Local Mode** to unit test workflows that use knowledge.

---

## Why This Matters

Workflows orchestrate activities, retries, and long-running logic. Testing them end-to-end against a real Temporal server is slow and flaky. Unit testing with Temporal's built-in **time-skipping** environment lets you:

- Execute workflows **in-process** with mocked time
- Resolve **knowledge** from embedded resources (no server calls)
- Assert on workflow results in milliseconds
- Run in CI without Docker or external services

> **Note:** Unit testing currently supports **Logs** and **Knowledge** usage out of the box. If your workflows or activities use other Xians functionality—such as DocumentDb, Tasks, or Messaging—you must abstract those dependencies behind interfaces and mock them in tests. Inject the abstractions into your activities so tests can supply fake implementations.

---

## Architecture at a Glance

```text
┌─────────────────────────────────────────────────────────────────┐
│  Test Class (IClassFixture<EnvFixture>)                         │
│  ├── EnvFixture: XiansPlatform.InitializeForTestsAsync()        │
│  ├── EnvFixture: Register agent + Upload workflow definitions   │
│  └── Temporal: WorkflowEnvironment.StartTimeSkippingAsync()     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  TemporalWorker                                                 │
│  ├── AddWorkflow<YourWorkflow>()                                │
│  └── AddAllActivities(new YourActivities(...))                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│  YourWorkflow  ──►  YourActivities  ──►  XiansContext.CurrentAgent │
│                                              .Knowledge.GetAsync() │
│                                              (from embedded DLLs)  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Quick Setup: A Minimal Example

We'll use a **greeting workflow** that reads a greeting template from Xians knowledge and returns a personalized message.

### 1. Embed Knowledge in Your Main Project

Knowledge is loaded by **searching inside DLLs**. Xians looks for embedded resources in loaded assemblies using naming conventions. You must embed your knowledge files in the agent project's output assembly.

**In your agent `.csproj`** (e.g. `my-agent.csproj`):

```xml
<ItemGroup>
  <!-- Embed JSON and Markdown for knowledge lookup -->
  <EmbeddedResource Include="**\*.json" />
  <EmbeddedResource Include="**\*.md" />
</ItemGroup>
```

Place your knowledge file under a folder, e.g. `Knowledge/greeting-config.json`:

```json
{
  "greeting": "Hello",
  "punctuation": "!"
}
```

The embedded resource will be named something like `my_agent.Knowledge.greeting-config.json`. Xians' Local Mode searches all non-system assemblies for manifest resources matching either:

- **Strict convention:** `{AgentName}.Knowledge.{KnowledgeName}.{extension}`
- **Fallback:** Any resource ending with `.{normalized-name}.{extension}` (e.g. `.greeting-config.json`)

So as long as your file name matches the knowledge name you use in code (normalized: spaces → hyphens, lowercased), it will be found.

---

### 2. Define the Workflow and Activity

**`GreetingWorkflow.cs`**

```csharp
using Temporalio.Exceptions;
using Temporalio.Workflows;

[Workflow("MyAgent:Greeting Workflow")]
public class GreetingWorkflow
{
    private static readonly ActivityOptions Options = new()
    {
        StartToCloseTimeout = TimeSpan.FromMinutes(1),
    };

    [WorkflowRun]
    public async Task<string> RunAsync(string userName)
    {
        var template = await Workflow.ExecuteActivityAsync(
            (GreetingActivities a) => a.GetGreetingTemplateAsync(),
            Options);

        return $"{template} {userName}!";
    }
}
```

**`GreetingActivities.cs`**

```csharp
using Temporalio.Activities;
using Xians.Lib.Agents.Core;

public class GreetingActivities
{
    [Activity]
    public async Task<string> GetGreetingTemplateAsync()
    {
        var knowledge = await XiansContext.CurrentAgent.Knowledge.GetAsync("Greeting Config");
        if (knowledge == null)
            throw new ApplicationFailureException("Greeting Config not found in knowledge base.");

        var config = JsonSerializer.Deserialize<GreetingConfig>(knowledge.Content);
        return config?.Greeting ?? "Hello";
    }
}

public record GreetingConfig(string Greeting, string Punctuation);
```

Your knowledge name `"Greeting Config"` normalizes to `greeting-config`, so a file `greeting-config.json` will be matched by the fallback.

---

### 3. Create the Test Fixture

**`EnvFixture.cs`** (shared across workflow test classes):

```csharp
using DotNetEnv;
using Temporalio.Testing;
using Xians.Lib.Agents.Core;

public class EnvFixture : IDisposable, Xunit.IAsyncLifetime
{
    public EnvFixture() => LoadEnv();

    public async Task InitializeAsync()
    {
        var xiansPlatform = await XiansPlatform.InitializeForTestsAsync();
        var agent = xiansPlatform.Agents.Register(new XiansAgentRegistration
        {
            Name = "MyAgent",
            IsTemplate = false,
        });
        await agent.UploadWorkflowDefinitionsAsync();
    }

    private static void LoadEnv()
    {
        // Load .env from project root or sibling for API keys if needed
        var baseDir = AppContext.BaseDirectory;
        var envPath = Path.Combine(baseDir, "..", "..", "..", ".env");
        if (File.Exists(Path.GetFullPath(envPath)))
            Env.Load(Path.GetFullPath(envPath));
    }

    public async Task<(WorkflowEnvironment Env, string TaskQueue)> CreateTemporalEnvAsync()
    {
        var env = await WorkflowEnvironment.StartTimeSkippingAsync();
        return (env, $"task-queue-{Guid.NewGuid()}");
    }

    public void Dispose() => GC.SuppressFinalize(this);
}
```

---

### 4. Write the Unit Test

**`GreetingWorkflowTests.cs`**

```csharp
using Temporalio.Client;
using Temporalio.Testing;
using Temporalio.Worker;
using Xians.Lib.Common.Infrastructure;
using Xunit;

[Trait("Category", "Workflow")]
public class GreetingWorkflowTests : IClassFixture<EnvFixture>, IDisposable
{
    private readonly WorkflowEnvironment _env;
    private readonly string _taskQueue;
    private readonly TemporalWorker _worker;

    public GreetingWorkflowTests(EnvFixture fixture)
    {
        var (env, taskQueue) = fixture.CreateTemporalEnvAsync().GetAwaiter().GetResult();
        _env = env;
        _taskQueue = taskQueue;
        _worker = new TemporalWorker(
            env.Client,
            new TemporalWorkerOptions(taskQueue)
            {
                LoggerFactory = LoggerFactory.CreateLoggerFactoryWithApiLogging(enableApiLogging: false),
            }
                .AddWorkflow<GreetingWorkflow>()
                .AddAllActivities(new GreetingActivities()));
    }

    [Fact]
    public async Task RunAsync_WithUserName_ReturnsGreeting()
    {
        await _worker.ExecuteAsync(async () =>
        {
            var result = await _env.Client.ExecuteWorkflowAsync(
                (GreetingWorkflow wf) => wf.RunAsync("Alice"),
                new(id: $"wf-{Guid.NewGuid()}", taskQueue: _taskQueue));

            Assert.Equal("Hello Alice!", result);
        });
    }

    public void Dispose()
    {
        _worker.Dispose();
        _env.DisposeAsync().AsTask().GetAwaiter().GetResult();
        GC.SuppressFinalize(this);
    }
}
```

---

## How Knowledge Discovery Works

When your activity calls `XiansContext.CurrentAgent.Knowledge.GetAsync("Greeting Config")` in **Local Mode**:

1. **XiansPlatform.InitializeForTestsAsync()** sets `LocalMode = true`, so no HTTP or Temporal server is used.
2. The **LocalKnowledgeProvider** resolves knowledge by:
   - Searching the **in-memory store** first (for knowledge uploaded via `UploadEmbeddedResourceAsync` during setup).
   - Falling back to **embedded resources** in all loaded assemblies.
3. It scans `Assembly.GetManifestResourceNames()` in each non-system assembly.
4. It matches resources by:
   - **Strict:** `{AgentName}.Knowledge.{KnowledgeName}.{ext}`
   - **Fallback:** any resource ending with `.{normalized-name}.{ext}` (e.g. `.greeting-config.json`).

Because your test project references your agent project, the agent DLL is loaded and its embedded resources are searchable. Embedding in the **agent** `.csproj` ensures the knowledge travels with the assembly.

- **`"Greeting Config"`** → normalizes to `greeting-config` → matches `*.greeting-config.json`
- **`"Article Extraction Schema"`** → normalizes to `article-extraction-schema` → matches `*.article-extraction-schema.json`

---

## Checklist

- [ ] Add `<EmbeddedResource Include="**\*.json" />` (and `**\*.md` if needed) to your **agent** `.csproj`.
- [ ] Use `XiansPlatform.InitializeForTestsAsync()` in your fixture's `InitializeAsync`.
- [ ] Register the agent and call `UploadWorkflowDefinitionsAsync()`.
- [ ] Create a Temporal time-skipping env with `WorkflowEnvironment.StartTimeSkippingAsync()`.
- [ ] Build a `TemporalWorker` with your workflow and activities.
- [ ] Run `ExecuteWorkflowAsync` inside `_worker.ExecuteAsync`.
- [ ] Dispose the worker and environment in `Dispose`.

---

## Running Tests

```bash
# All workflow tests
dotnet test --filter "Category=Workflow"

# Specific test class
dotnet test --filter "FullyQualifiedName~GreetingWorkflowTests"
```

---

## See Also

- [Knowledge](knowledge.md) – Managing agent knowledge in production
