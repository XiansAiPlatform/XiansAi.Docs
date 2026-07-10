# Cross-Agent Workflows and Activations

## Why This Page Exists

In multi-agent systems, one agent's workflow often needs to run another agent's workflow — an invoicing agent delegating to a fraud-detection agent, for example. Routing "just works" (the target agent is derived from the workflow type `"AgentName:WorkflowName"`, so the call reaches the right worker automatically), but **activations don't cross agent boundaries**: the caller's activation belongs to the caller's agent and means nothing to the target agent. This page explains how activation context propagates, how to target a specific activation, and how the SDK protects you from starting workflows nobody is listening for.

For the core `XiansContext.Workflows` API (start, execute, signal within one agent), see [Workflows](workflows.md).

## How Activation Context Propagates

When starting a child workflow, its activation postfix (`idPostfix`) is resolved by these rules:

| Scenario | Child's activation context |
|----------|---------------------------|
| Explicit `activationName` passed | That activation — always wins (same-agent or cross-agent); carried in workflow ID, memo, and search attributes |
| Same-agent child, no `activationName` | Inherits the caller's `idPostfix` |
| Cross-agent child, no `activationName` | **None** — the caller's activation doesn't exist for the target agent |

```csharp
// Cross-agent child under a specific activation of the target agent
var result = await XiansContext.Workflows.ExecuteAsync<FraudDetectionWorkflow, string>(
    new object[] { invoiceId },
    uniqueKey: invoiceId,
    activationName: "fraud-detection-eu");

// Cross-agent child with no activation context (default)
var result2 = await XiansContext.Workflows.ExecuteAsync<FraudDetectionWorkflow, string>(
    new object[] { invoiceId },
    uniqueKey: invoiceId);
```

!!! warning "Always pass a `uniqueKey` for cross-agent children without an activation"
    With no activation postfix in the workflow ID, two concurrent parents would generate the **same child workflow ID** and collide. Use the entity being processed (invoice ID, order ID, ...) as the `uniqueKey`.

The system-scoped flag used for task queue routing is resolved from the target agent when it's registered in the same process, and inherited from the parent workflow otherwise.

## Activation Validation

### Why validate?

If you start a workflow under an activation that doesn't exist (or is deactivated) in the acting tenant, Temporal happily accepts it — and the workflow sits **orphaned on a task queue no worker polls**. To prevent this, when you pass an explicit `activationName` to `StartAsync`, `ExecuteAsync`, or `SignalWithStartAsync`, the SDK checks with the server that the activation exists and is active *before* starting anything.

(`SignalAsync` skips validation — it never starts a workflow, so a missing activation just means the target isn't running and the signal fails with Temporal's normal not-found error.)

### What you get

- **Typed exceptions**: `ActivationNotFoundException` (doesn't exist) or `ActivationDeactivatedException` (exists but deactivated). Both derive from `InvalidOperationException` and expose `AgentName` and `ActivationName` (plus `TenantId` for not-found).
- **Works everywhere**: inside a workflow the check runs through a system activity (workflows can't make HTTP calls) that returns the status as a value; the SDK converts a negative status into the typed exception. A plain `catch` works in all contexts, and Temporal logs no failed-activity warnings for an expected "not found".
- **Fail fast if uncaught**: Xians workers register both exception types as workflow failure types, so an uncaught validation error fails the workflow instead of suspending it on retries.
- **Tenant-aware**: for system-scoped agents, the activation is validated in the tenant running the action, not the tenant of the agent's certificate.
- **Local mode**: when no HTTP service is available, the check is skipped.

```csharp
using Xians.Lib.Agents.Workflows;

try
{
    await XiansContext.Workflows.ExecuteAsync<string>(
        "Fraud Detection Agent:Fraud Detection Workflow",
        new object[] { invoiceId },
        uniqueKey: invoiceId,
        activationName: "fraud-detection-eu");
}
catch (ActivationNotFoundException ex)
{
    // Activation doesn't exist in this tenant — ex.AgentName, ex.ActivationName, ex.TenantId
}
catch (ActivationDeactivatedException ex)
{
    // Activation exists but is deactivated
}
```

## Signaling a Workflow Under a Specific Activation

Workflows started with an explicit `activationName` carry that activation in their workflow ID, so the default `SignalAsync` overloads (which build the ID from the caller's context) can't reach them. Use the overloads that take an activation name:

```csharp
// By workflow class
await XiansContext.Workflows.SignalAsync<FraudDetectionWorkflow>(
    "review-completed",
    new object[] { reviewResult },
    activationName: "fraud-detection-eu");

// By type string (when the class isn't available)
await XiansContext.Workflows.SignalAsync(
    "Fraud Detection Agent:Fraud Detection Workflow",
    "review-completed",
    new object[] { reviewResult },
    activationName: "fraud-detection-eu");
```

The signal name must match a `[WorkflowSignal]` handler on the target. The call returns when the server accepts the signal, not when it's processed.

`SignalWithStartAsync` also accepts `activationName` — and because it can *create* a workflow, the activation is validated up front exactly like `StartAsync`/`ExecuteAsync`:

```csharp
await XiansContext.Workflows.SignalWithStartAsync<FraudDetectionWorkflow>(
    workflowArgs: new object[] { invoiceId },
    signalName: "review-requested",
    uniqueKey: invoiceId,
    activationName: "fraud-detection-eu",
    signalArgs: new object[] { reviewRequest });
```

For same-agent signaling, see [Signaling Workflows](workflows.md#signaling-workflows).

## Cross-Agent Workflow ID Generation

IDs follow `{tenantId}:{agentName}:{workflowName}[:{idPostfix}][:{uniqueKey}]` (see [How Workflow IDs Are Generated](workflows.md#how-workflow-ids-are-generated)). For cross-agent children, only an explicit `activationName` adds an activation postfix:

```csharp
// Cross-agent child — parent's idPostfix NOT inherited
// Result: tenant1:OtherAgent:Scan:order-456
await XiansContext.Workflows.StartAsync<ScanWorkflow>(
    Array.Empty<object>(), uniqueKey: "order-456");

// With explicit activation of the target agent
// Result: tenant1:OtherAgent:Scan:scan-activation-eu:order-456
await XiansContext.Workflows.StartAsync<ScanWorkflow>(
    Array.Empty<object>(), uniqueKey: "order-456", activationName: "scan-activation-eu");
```

## Related

- [Workflows](workflows.md) — the core `XiansContext.Workflows` API and same-agent patterns
- [Multitenancy](multitenancy.md) — what activations are and how they're created
