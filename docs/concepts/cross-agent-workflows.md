# Cross-Agent Workflows and Activations

This page covers the advanced patterns involved when a workflow starts, executes, or signals a child workflow that belongs to a **different agent**, and how **activations** propagate across those boundaries.

For the core `XiansContext.Workflows` API (fire-and-forget, wait-for-result, and same-agent signaling), see [Workflows](workflows.md).

## Cross-Agent Sub-Workflows and Activations

Child workflows can belong to a **different agent** than the caller. The target agent is always derived from the workflow type (`"AgentName:WorkflowName"`), so task queue routing works across agents automatically—no extra parameters are needed to reach another agent's worker.

Activations, however, are **agent-specific**. The caller's activation name (`idPostfix`) therefore propagates to child workflows as follows:

1. **Explicit `activationName`** — always wins, for both same-agent and cross-agent children. The child's workflow ID, memo, and search attributes all carry this activation.
2. **Same-agent child (no `activationName`)** — the caller's `idPostfix` is inherited, preserving the activation context.
3. **Cross-agent child (no `activationName`)** — the caller's `idPostfix` is **not** inherited. The caller's activation does not exist for the target agent, so the child gets no activation context.

```csharp
// Cross-agent child under a specific activation of the target agent
var result = await XiansContext.Workflows.ExecuteAsync<FraudDetectionWorkflow, string>(
    new object[] { invoiceId },
    uniqueKey: invoiceId,
    activationName: "fraud-detection-eu"
);

// Cross-agent child with no activation context (default)
var result2 = await XiansContext.Workflows.ExecuteAsync<FraudDetectionWorkflow, string>(
    new object[] { invoiceId },
    uniqueKey: invoiceId
);
```

**Important:** When starting cross-agent children without an `activationName`, always provide a `uniqueKey` (e.g. the entity ID being processed). Since no activation postfix is added to the workflow ID, concurrent parents would otherwise produce the same child workflow ID.

The system-scoped flag used for task queue routing is resolved from the **target agent** when it is registered in the same process, and inherited from the parent workflow otherwise.

## Activation Validation

When an explicit `activationName` is passed to `StartAsync`, `ExecuteAsync`, or `SignalWithStartAsync`, the SDK validates against the server that the activation exists and is active for the target agent in the acting tenant **before** starting the workflow. This prevents orphaned Temporal workflows sitting on a task queue no worker listens on (e.g. when the agent is not activated in that tenant). `SignalAsync` performs no such validation—it never starts a workflow, so a missing activation simply means the target workflow is not running and the signal fails with Temporal's own not-found error.

- A failed validation throws a typed exception: `ActivationNotFoundException` (activation does not exist) or `ActivationDeactivatedException` (exists but deactivated). Both derive from `InvalidOperationException` and expose `AgentName`, `ActivationName` (and `TenantId` for not-found).
- The same typed exceptions are thrown in **all contexts**. Inside a workflow the check runs through a system activity (workflows cannot make HTTP calls) that reports the activation status as a value; the SDK converts a negative status into the typed exception, so a plain catch works everywhere. Because the activity completes successfully even for a negative result, Temporal does not log failed-activity warning traces for an expected "not found" outcome.
- If the exception is **not caught** inside a workflow, the workflow fails (Xians workers register both types as workflow failure exception types) instead of suspending on workflow task retries.
- For **system-scoped agents**, the activation is validated in the tenant running the action (resolved from the workflow context), not the tenant of the agent's certificate.
- When no HTTP service is available (local mode), the check is skipped.

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
    // Target activation does not exist in this tenant
    // ex.AgentName, ex.ActivationName, ex.TenantId
}
catch (ActivationDeactivatedException ex)
{
    // Target activation exists but is deactivated
}
```

## Signaling a Workflow Under a Specific Activation

Workflows started with an explicit `activationName` (typically cross-agent) carry that activation in their workflow ID, so the default `SignalAsync` overloads cannot reach them. Use the overloads that take an activation name:

```csharp
// Signal a cross-agent workflow running under a specific activation (by workflow class)
await XiansContext.Workflows.SignalAsync<FraudDetectionWorkflow>(
    "review-completed",
    new object[] { reviewResult },
    activationName: "fraud-detection-eu"
);

// Same, by workflow type string (useful when the workflow class isn't available)
await XiansContext.Workflows.SignalAsync(
    "Fraud Detection Agent:Fraud Detection Workflow",
    "review-completed",
    new object[] { reviewResult },
    activationName: "fraud-detection-eu"
);
```

**Note:** The signal name must match a handler with `[WorkflowSignal]` on the target workflow. The call returns when the server accepts the signal; it does not wait for the workflow to process it.

`SignalWithStartAsync` also accepts an optional `activationName`. Because signal-with-start can create a new workflow, an explicit activation is validated up front exactly like `StartAsync`/`ExecuteAsync` (see [Activation Validation](#activation-validation)):

```csharp
// Signal-with-start targeting a specific activation of the target agent (client-only, by workflow class)
await XiansContext.Workflows.SignalWithStartAsync<FraudDetectionWorkflow>(
    workflowArgs: new object[] { invoiceId },
    signalName: "review-requested",
    uniqueKey: invoiceId,
    activationName: "fraud-detection-eu",
    signalArgs: new object[] { reviewRequest }
);

// Same, by workflow type string
await XiansContext.Workflows.SignalWithStartAsync(
    "Fraud Detection Agent:Fraud Detection Workflow",
    workflowArgs: new object[] { invoiceId },
    signalName: "review-requested",
    uniqueKey: invoiceId,
    activationName: "fraud-detection-eu",
    signalArgs: new object[] { reviewRequest }
);
```

For same-agent signaling, where the workflow ID is built from context only, see [Signaling Workflows](workflows.md#signaling-workflows).

## Cross-Agent Workflow ID Generation

Workflow IDs follow the format `{tenantId}:{agentName}:{workflowName}[:{idPostfix}][:{uniqueKey}]`. For cross-agent children, the `idPostfix` (activation context) is resolved per the propagation rules above—the caller's `idPostfix` is **not** inherited, and only an explicit `activationName` adds an activation postfix. See [Workflow ID Generation](workflows.md#workflow-id-generation) for the full format and same-agent examples.

```csharp
// Cross-agent child (caller is a different agent) - parent's idPostfix NOT inherited
// Result: tenant1:OtherAgent:Scan:order-456
await XiansContext.Workflows.StartAsync<ScanWorkflow>(
    Array.Empty<object>(),
    uniqueKey: "order-456"
);

// Cross-agent child with explicit activation of the target agent
// Result: tenant1:OtherAgent:Scan:scan-activation-eu:order-456
await XiansContext.Workflows.StartAsync<ScanWorkflow>(
    Array.Empty<object>(),
    uniqueKey: "order-456",
    activationName: "scan-activation-eu"
);
```

## Error Handling

In addition to the standard workflow errors (see [Error Handling](workflows.md#error-handling)), starting a workflow with an explicit `activationName` can throw activation validation failures. Handle `ActivationNotFoundException` and `ActivationDeactivatedException` as shown in [Activation Validation](#activation-validation) above.

## Related

- [Workflows](workflows.md) — core `XiansContext.Workflows` API, starting/executing/signaling same-agent workflows, and communicating with workflows.
