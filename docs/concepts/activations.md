# Agents & Activations (SDK)

## Why This Page Exists

An **activation** is a named, tenant-scoped instance of an agent: it carries configuration, starts that agent's *activable* workflows, and appears in workflow IDs as `idPostfix`. Agent Studio and the Admin API can create and toggle activations — and so can agents themselves, via the SDK, under certificate auth.

This page covers the **runtime APIs** for inspecting and managing agents/activations in the current tenant: checking whether another agent exists, creating and activating it, verifying status, listing activations, and deactivating. For how activation context flows when *starting* another agent's workflow, see [Cross-Agent Workflows](cross-agent-workflows.md). For the product lifecycle (template → deploy → activate), see [Multitenancy](multitenancy.md).

```mermaid
graph LR
  A["XiansAgent"] -->|".Tenant"| T["TenantAgents"]
  T -->|.Agent(name)| R["AgentReference"]
  A -->|self checks| S["GetActivationStatusAsync / ActivationExistsAsync"]
  R -->|ExistsAsync| E1["GET agents/exists"]
  R -->|status / list / create| E2["GET/POST activation"]
  R --> I["ActivationInfo"]
  I -->|ActivateAsync / DeactivateAsync| E3["POST activation/id/..."]
```

## Two Entry Points

| API | Scope | Typical use |
|-----|--------|-------------|
| `agent.GetActivationStatusAsync` / `ActivationExistsAsync` | **Self** — this agent | Confirm the current (or named) activation is active before acting |
| `agent.Tenant.Agent("Other Agent")` → `AgentReference` | **Any agent** in the certificate's tenant | Orchestrators that provision or check another agent |

The target agent does **not** need to be registered in the same process. Calls use the calling agent's HTTP client and certificate; for system-scoped callers, the acting tenant comes from context (`XiansContext.SafeTenantId`) with a fallback to the certificate tenant.

!!! important "Call from activities (or outside Temporal)"
    These methods perform HTTP I/O. Do **not** call them from deterministic workflow code. Put them in a Temporal activity (or run them from `Program` / a non-workflow path).

## Checking Your Own Activation

When running inside a workflow or activity, the activation name defaults to the current `idPostfix`:

```csharp
var agent = XiansContext.CurrentAgent;

// Current activation from context
bool active = await agent.ActivationExistsAsync();
var status = await agent.GetActivationStatusAsync(); // Active | NotFound | Deactivated

// Or pass a name explicitly (also required outside workflow/activity context)
bool euActive = await agent.ActivationExistsAsync("fraud-detection-eu");
```

| Status (`ActivationCheckStatus`) | Meaning |
|----------------------------------|---------|
| `Active` | Activation exists and is active |
| `NotFound` | No such activation for this agent in the tenant |
| `Deactivated` | Activation exists but has been deactivated |

`ActivationExistsAsync` is `true` only for `Active`. Missing or deactivated both return `false`. Real errors (missing HTTP service, 400, 5xx) still throw.

## Inspecting Another Agent

```csharp
var other = agent.Tenant.Agent("Fraud Detection Agent");

// Dedicated agent-exists endpoint (no activation name required)
bool agentExists = await other.ExistsAsync();

// Activation status for that agent
var status = await other.GetActivationStatusAsync("fraud-detection-eu");
bool activationActive = await other.ActivationExistsAsync("fraud-detection-eu");
```

| Method | Returns | Notes |
|--------|---------|--------|
| `ExistsAsync()` | `bool` | `GET /api/agent/agents/exists` — 200 → true, 404 → false |
| `GetActivationStatusAsync(name)` | `ActivationCheckStatus` | Same semantics as the self API |
| `ActivationExistsAsync(name)` | `bool` | True only when status is `Active` |

## Managing Activations (Create / Activate / List / Deactivate)

Full lifecycle against another agent (or yourself via `Tenant.Agent(agent.Name)`):

```csharp
var other = agent.Tenant.Agent("Activation Target Agent");

if (!await other.ExistsAsync())
    throw new InvalidOperationException("Target agent is not deployed in this tenant.");

// Create is inactive until you activate
var created = await other.CreateActivationAsync(
    name: "sdk-demo",
    description: "Provisioned by orchestrator");

// Starts the target's activable workflows under this activation name
await created.ActivateAsync();

// Or by id:
// await other.ActivateAsync(created.Id);

var listed = await other.ListActivationsAsync();
foreach (var a in listed)
    Console.WriteLine($"{a.Name} id={a.Id} active={a.IsActive}");

// "Remove" on the Agent API today means deactivate (cancels workflows; record remains)
await created.DeactivateAsync();
// await other.DeactivateAsync(created.Id);
```

### `CreateActivationAsync` parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | yes | Activation name (`idPostfix`) |
| `description` | no | Human-readable description |
| `participantId` | no | Participant the activation runs as |
| `workflows` | no | Optional `WorkflowConfig` list (workflow type + input name/value pairs) |

Create returns an `ActivationInfo` that is **bound** to the `AgentReference`, so you can call `ActivateAsync` / `DeactivateAsync` on the handle without juggling ids.

### `ActivationInfo` (handle)

| Member | Description |
|--------|-------------|
| `Id` | Server id used by activate/deactivate routes |
| `Name` | Activation name (`idPostfix`) |
| `AgentName`, `TenantId`, `Description`, `ParticipantId` | Identity metadata |
| `IsActive` / `Active` | Effective / stored active flag |
| `WorkflowIds` | Temporal workflow ids started for this activation |
| `WorkflowConfiguration` | Configured workflows and inputs |
| `ActivateAsync(...)` / `DeactivateAsync()` | Bound handle methods |

Optional workflow configuration can also be passed at activate time:

```csharp
await created.ActivateAsync(workflowConfiguration:
[
    new WorkflowConfig
    {
        WorkflowType = "Activation Target Agent:Heartbeat Workflow",
        Inputs = [new WorkflowInputValue { Name = "region", Value = "eu" }]
    }
]);
```

!!! note "No delete on the Agent API yet"
    Certificate-auth Agent API supports list / create / activate / deactivate. Permanent deletion remains an Admin API concern. Deactivate cancels running workflows and marks the activation inactive; the activation record can be re-activated later.

## End-to-End Pattern (Activity)

```csharp
[Activity]
public async Task ProvisionAsync()
{
    var manager = XiansContext.CurrentAgent;
    var target = manager.Tenant.Agent("Activation Target Agent");

    if (!await target.ExistsAsync())
        throw new InvalidOperationException("Target agent missing.");

    var activation = (await target.ListActivationsAsync())
        .FirstOrDefault(a => a.Name == "sdk-demo")
        ?? await target.CreateActivationAsync("sdk-demo");

    if (!activation.IsActive)
        activation = await activation.ActivateAsync();

    if (!await target.ActivationExistsAsync("sdk-demo"))
        throw new InvalidOperationException("Activation did not become active.");
}
```

A runnable two-agent sample (manager provisions a target's activation, waits while the target heartbeats, then deactivates) lives in the `Xians.Examples/ActivationManagement` project.

## Relation to Cross-Agent Workflow Starts

| Goal | API |
|------|-----|
| Ensure another agent/activation is present and active before work | `Tenant.Agent(...).ExistsAsync` / `ActivationExistsAsync` / create+activate |
| Start a workflow *under* that activation | `XiansContext.Workflows.ExecuteAsync(..., activationName: "...")` — see [Cross-Agent Workflows](cross-agent-workflows.md) |

Passing `activationName` to start/execute validates that the activation is active (or throws `ActivationNotFoundException` / `ActivationDeactivatedException`). Use the management APIs on this page when you need to **provision** that activation first.

## API Reference

### `XiansAgent` (self)

| Member | Description |
|--------|-------------|
| `Tenant` | Accessor for other agents in the tenant |
| `GetActivationStatusAsync(activationName?)` | Status for self; name defaults to context `idPostfix` |
| `ActivationExistsAsync(activationName?)` | `true` when status is `Active` |

### `TenantAgents` / `AgentReference`

| Member | Description |
|--------|-------------|
| `Tenant.Agent(agentName)` | Returns an `AgentReference` |
| `ExistsAsync()` | Whether the agent exists in the tenant |
| `GetActivationStatusAsync(activationName)` | Activation status |
| `ActivationExistsAsync(activationName)` | Convenience for `Active` |
| `ListActivationsAsync()` | All activations for that agent |
| `CreateActivationAsync(...)` | Create inactive activation |
| `ActivateAsync(activationId, ...)` / `DeactivateAsync(activationId)` | Lifecycle by id |

## Related

- [Multitenancy](multitenancy.md) — template → deploy → activate product model
- [Cross-Agent Workflows](cross-agent-workflows.md) — starting/signaling workflows under an activation
- [Agents](agents.md) — registering agents and activable custom workflows
- [Messaging – Webhooks](webhook.md) — self activation checks before managing webhooks
