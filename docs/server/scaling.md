# Scaling

The Xians platform provides flexible scaling options to handle varying workloads efficiently. You can scale both horizontally (multiple agent instances) and vertically (workers per workflow), with the platform automatically handling distribution and fault tolerance through Temporal.

Scaling is built in rather than bolted on: every workflow has its own task queue, `maxConcurrent` is set per workflow, `RunAsync()` handles `SIGTERM` for graceful shutdown, and the standard Kubernetes autoscalers - the HPA, the native KEDA Temporal scaler and Temporal Worker Deployment Versioning - work with an agent as it is. Nothing has to be added to agent code to go from one process to an auto-scaled fleet.

!!! note
    Two components scale differently. **Agents** are Temporal workers; every section from [Horizontal Scaling](#horizontal-scaling---multiple-agent-instances) to [Monitoring and Observability](#monitoring-and-observability) is about them. **xiansAi.Server** is a stateless Temporal client that scales as ordinary web replicas; it is covered in [Server Replicas + Redis](#server-replicas--redis).

## Horizontal Scaling - Multiple Agent Instances

You can spawn **any number of agent console applications**, and the platform automatically takes care of scaling and fault tolerance of agent runtimes. This is handled through Temporal workers and activity distribution.

### How It Works

When you start multiple instances of the same agent application:

1. Each instance registers as a Temporal worker for the same task queue
2. Temporal automatically distributes workflow executions and activities across all available workers
3. If one instance fails, Temporal redistributs work to healthy instances
4. No configuration changes needed - just start more instances

!!! note
    There is one task queue per workflow, named `{TenantId}:{Agent Name}:{Workflow Name}` (`{Agent Name}:{Workflow Name}` for system-scoped agents). Use this exact name when you point an autoscaler at a queue.

### Example

```bash
# Terminal 1
dotnet run --project MyAgent

# Terminal 2
dotnet run --project MyAgent

# Terminal 3
dotnet run --project MyAgent
```

All three instances will:

- Share the workload automatically
- Provide fault tolerance (if one crashes, others continue)
- Scale processing capacity linearly

### Benefits

- **Automatic Load Distribution**: Temporal handles work distribution across all instances
- **Fault Tolerance**: Failed instances don't cause workflow failures
- **Zero Configuration**: No changes to code or configuration required
- **Linear Scaling**: More instances = more processing capacity

### Production Baseline

Regardless of whether you auto scale, run **at least 2 instances** so a restart or node drain never leaves a task queue without pollers, add a `PodDisruptionBudget` (`minAvailable: 1`), and make every activity **idempotent** - Temporal guarantees at-least-once execution, so an activity running on an instance that dies will run again elsewhere.

### Worker Versioning

Agents support **Temporal Worker Deployment Versioning**. When enabled, every worker is tagged with a deployment name and a build ID, Temporal routes each workflow execution to a compatible build, and running executions finish on the version they started on (`Pinned`, the default). A new build can therefore be rolled out next to the old one and ramped up without breaking in-flight workflows or patching workflow code. It is off by default; turn it on per agent and supply the build ID from your deployment:

```csharp
var platform = await XiansPlatform.InitializeAsync(new()
{
    ServerUrl = Environment.GetEnvironmentVariable("XIANS_SERVER_URL")!,
    ApiKey    = Environment.GetEnvironmentVariable("XIANS_API_KEY")!,
    WorkerVersioning = new()
    {
        Mode    = WorkerVersioningMode.Enabled,
        BuildId = Environment.GetEnvironmentVariable("TEMPORAL_WORKER_BUILD_ID")
    }
});
```

On Kubernetes the Temporal Worker Controller injects the build ID and manages the per-version Deployments; see [KEDA Temporal Scaler](#4-keda-temporal-scaler-recommended) for how auto scaling works alongside it.

## Vertical Scaling - Workers per Workflow

Within a single agent instance, you can configure the number of **maxConcurrent per workflow** to handle concurrent executions. This is specified when defining workflows.

### Built-In Workflows

Use the `maxConcurrent` parameter in `DefineBuiltIn()`:

```csharp
// Single worker (default)
agent.Workflows.DefineBuiltIn();

// Multiple maxConcurrent for concurrent executions
agent.Workflows.DefineBuiltIn(name: "Data Processor Workflow", maxConcurrent: 200);
```

### Custom Workflows

Use the `maxConcurrent` parameter in `DefineCustom<T>()`:

```csharp
// Single worker (default)
agent.Workflows.DefineCustom<MyCustomWorkflow>();

// Multiple maxConcurrent for concurrent executions
agent.Workflows.DefineCustom<MyCustomWorkflow>(maxConcurrent: 5);
```

### Example: Multi-Workflow Agent

```csharp
var agent = platform.Agents.DefineAgent("DataPipeline");

// Low concurrency workflow
agent.Workflows.DefineBuiltIn(name: "Coordinator", maxConcurrent: 2);

// High concurrency workflow for data processing
agent.Workflows.DefineBuiltIn(name: "Processor", maxConcurrent: 20);

// Custom workflow with moderate concurrency
agent.Workflows.DefineCustom<ValidationWorkflow>(maxConcurrent: 10);

await agent.RunAsync();
```

### Choosing a Value for maxConcurrent

- **The default is 100**, not 1: a definition without `maxConcurrent` already runs up to 100 workflow tasks concurrently. Set a lower value for workflows that must not run in bulk.
- **The limit is per workflow, not per instance.** An instance hosting four workflows can have far more in flight than any single `maxConcurrent` suggests.
- **Downstream quotas bound it.** Keep `instances × maxConcurrent` within your LLM / API rate limits, or the backlog simply moves into a 429 retry loop.

## Combining Horizontal and Vertical Scaling

You can combine both scaling strategies for maximum flexibility:

```csharp
// Define agent with 10 maxConcurrent per workflow
var agent = platform.Agents.DefineAgent("HighThroughputAgent");
agent.Workflows.DefineBuiltIn(maxConcurrent: 10);

await agent.RunAsync();
```

Then spawn 5 instances:

- **Total capacity**: 5 instances × 10 maxConcurrent = 50 concurrent executions
- **Fault tolerance**: If 2 instances fail, 30 maxConcurrent still available
- **Flexible scaling**: Add/remove instances as needed

## Auto Scaling Based on Queue Metrics

For dynamic scaling scenarios, you can monitor the Temporal queue size to automatically adjust the number of workers. This approach enables responsive scaling based on actual workload demand.

### When to Auto Scale

Auto scaling pays off for bursty, queue-driven workloads and adds little but risk for steady ones. Decide from the traffic pattern first:

| Traffic pattern | What it looks like | Recommendation |
|---|---|---|
| **Flat / steady** | Chat agents with a stable user base; load varies less than 2x over the day | **Do not auto scale.** Fixed instances sized for the peak. |
| **Business hours** | Predictable daily or weekly shape | **Scheduled scaling** (KEDA cron), optionally with a CPU HPA for surprises. |
| **Bursty, queue-driven** | Batch jobs, bulk imports, enrichment runs; backlog builds within minutes | **Queue-based scaling** (KEDA Temporal scaler). The only signal that reacts before latency explodes. |
| **CPU-bound** | Agents that parse, transform or embed data locally | **CPU HPA.** Built into Kubernetes. |
| **Unknown / new agent** | No telemetry yet | **Fixed instances** for two weeks, then choose from this table. |

Then check three things: a backlog actually builds up (`task_schedule_to_start_latency` per task queue on the Temporal server is seconds, not milliseconds, at peak); the bottleneck is in your pods and not an LLM quota or third-party API, where more instances make it worse; and pods can be removed safely - every scale-in terminates a pod that may be mid-activity, so [Graceful Termination](#graceful-termination) is a prerequisite, not an optimisation.

### Monitoring Queue Size for Auto Scaling

Temporal provides metrics that allow you to monitor the backlog of pending workflow executions and activities. By tracking these metrics, you can implement auto-scaling logic to spawn or terminate agent instances based on demand.

### Implementation Approaches

#### 1. External Monitoring Service

Set up a monitoring service that:

- Queries Temporal metrics API for queue depth
- Compares against threshold values
- Triggers scaling actions (e.g., Kubernetes HPA, AWS Auto Scaling)

```bash
# Example: Query Temporal metrics (pseudo-code)
curl http://temporal:9090/metrics | grep temporal_task_queue_depth
```

#### 2. Kubernetes Horizontal Pod Autoscaler (HPA)

Use Kubernetes HPA with custom metrics:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: xians-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: xians-agent
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: temporal_task_queue_backlog
        selector:
          matchLabels:
            queue: "DataPipeline:BuiltIn Workflow"
      target:
        type: AverageValue
        averageValue: "10"  # Scale up if >10 tasks per pod
```

!!! note
    An `External` metric needs a metrics adapter in the cluster, and the queue label must be the full task queue name including the tenant prefix. Without an adapter, scale on **CPU** (`type: Resource`, `averageUtilization: 70`) or let KEDA read the backlog directly (approach 4). Avoid **memory** targets: .NET keeps memory once allocated, so the HPA never scales back in.

#### 3. Programmatic Monitoring

Implement custom auto-scaling logic:

```csharp
// Pseudo-code example
public class AutoScaler
{
    public async Task MonitorAndScale(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var queueDepth = await GetTemporalQueueDepth();
            
            if (queueDepth > 100)
            {
                // High load - signal to spawn more instances
                await ScaleUp();
            }
            else if (queueDepth < 10)
            {
                // Low load - signal to reduce instances
                await ScaleDown();
            }
            
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
        }
    }
}
```

#### 4. KEDA Temporal Scaler (Recommended)

[KEDA](https://keda.sh) ships a native Temporal scaler (since v2.17). It reads the task queue backlog from the Temporal frontend and manages an HPA for you - no Prometheus, metrics adapter or custom code required.

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: xians-agent
spec:
  scaleTargetRef:
    name: xians-agent                   # the Deployment
  minReplicaCount: 2                    # keep pollers alive; never scale to zero
  maxReplicaCount: 10
  pollingInterval: 15
  cooldownPeriod: 600
  triggers:
    - type: temporal
      metadata:
        endpoint: temporal-frontend.temporal.svc.cluster.local:7233
        namespace: default
        taskQueue: "acme:DataPipeline:Processor"
        queueTypes: "workflow,activity"
        targetQueueSize: "10"           # desired backlog per replica
```

With `targetQueueSize: 10`, a backlog of 50 tasks requests 5 replicas. Set it to roughly what one replica drains within your acceptable wait time.

- **Never scale to zero.** The backlog cannot see activities already running; a pod with an empty queue and a two-hour activity in flight would be removed.
- **Trigger on the queue that backs up** (the worker workflow, not the coordinator); with several triggers KEDA uses the highest result.
- **Business-hours load**: add a KEDA `cron` trigger (`timezone`, `start`, `end`, `desiredReplicas`) next to the backlog trigger. KEDA applies the highest replica count any trigger requests, so the schedule sets the floor during the window and the backlog trigger still handles surprises.

**With [Worker Versioning](#worker-versioning) enabled**, put the same trigger in a `WorkerResourceTemplate` instead of a `ScaledObject`; the Worker Controller then gives each version its own autoscaler, and during a rollout both versions scale independently.

### Scaling Behaviour and Policies

The metric decides *whether* to scale; the HPA `behavior` block decides *how fast* and *how far*. Kubernetes defaults (scale up immediately, remove all surplus pods after 5 minutes) are tuned for stateless web servers, not for workers with minutes-long activities. KEDA exposes the same block under `advanced.horizontalPodAutoscalerConfig.behavior`.

```yaml
# Safe default for any Temporal worker: fast out, slow and one-at-a-time in
behavior:
  scaleUp:
    stabilizationWindowSeconds: 0
    policies:
      - { type: Pods, value: 2, periodSeconds: 60 }
  scaleDown:
    stabilizationWindowSeconds: 600
    policies:
      - { type: Pods, value: 1, periodSeconds: 120 }
    selectPolicy: Min
```

**When to add which option** - start with the block above, then adjust only when you observe the symptom:

| Symptom you observe | Adjust this |
|---|---|
| Replica count oscillates every few minutes | Raise `scaleDown.stabilizationWindowSeconds` to 600-900 |
| Scale-out triggers an LLM 429 storm | Lower the `scaleUp` policy to 1 pod per minute so quota use ramps instead of jumping |
| Backlog grows for minutes before anything happens | Shorten the KEDA `pollingInterval` to 10-15 s |
| Daily batch must never shrink mid-run | Set `scaleDown.selectPolicy: Disabled` for the window, or pause the autoscaler during the run |

Do not add a policy you cannot name a symptom for.

### Best Practices for Auto Scaling

1. **Set Appropriate Thresholds**
   - Scale up before queues become too large
   - Scale down gradually to avoid thrashing
   - Consider time-of-day patterns

2. **Implement Cooldown Periods**
   - Wait before scaling again (e.g., 5 minutes)
   - Prevents rapid scaling oscillations

3. **Monitor Both Queue and Resource Utilization**
   - Don't just scale on queue depth
   - Consider CPU, memory, and network metrics

4. **Test Scaling Behavior**
   - Simulate high load scenarios
   - Verify graceful scale-down behavior
   - Ensure no workflow failures during scaling

5. **Set Min/Max Boundaries**
   - Minimum instances for availability
   - Maximum instances for cost control
   - `maxReplicas × maxConcurrent ≤ downstream quota`, halved under Worker Deployment Versioning

## Vertical Pod Autoscaling

Horizontal scaling adds pods; vertical scaling makes each pod larger or smaller. Queue wait time calls for more instances; OOM-kills, CPU throttling or pods idling far below their request call for a different pod size. Agents are memory-bound before they are CPU-bound, so the usual mistake is to answer a memory problem with more replicas.

### Sizing Rules for Agents

- **CPU: Burstable.** Low request, limit 2-4x the request so LLM / JSON bursts are not throttled.
- **Memory: limit about 2x the observed peak**, request near the steady-state working set. Raise it together with `maxConcurrent`; an OOM-kill is an ungraceful termination.

### Vertical Pod Autoscaler (VPA)

VPA is a Kubernetes add-on that observes real usage and recommends or applies new resource requests.

| `updateMode` | Behaviour | Use for agents? |
|---|---|---|
| `Off` | Recommends only (`kubectl describe vpa`) | **Yes.** Read after two weeks of traffic, copy into your Helm values, repeat quarterly. |
| `Initial` | Applies on pod creation only | Yes, if pods restart on every deploy anyway |
| `Recreate` / `Auto` | Evicts pods to apply new requests | **No.** An eviction is a scale-in with no policy; it kills in-flight activities. |

!!! warning
    Never run an active VPA and a CPU HPA on the same Deployment: HPA utilization is a percentage of the request, VPA changes the request, and each undoes the other. The supported split is VPA on memory only (`controlledResources: ["memory"]`) with HPA on CPU.

### In-Place Pod Resize

Since Kubernetes 1.33 (beta) and 1.35 (stable), CPU and memory can be changed on a running pod without recreating it. Use it for CPU during an incident; a memory change still needs a container restart to take effect for .NET, so set `resizePolicy: RestartContainer` for memory.

## Graceful Termination

Because agents are Temporal workers, no work is lost when an instance goes away: workflow state lives in Temporal and a running activity is re-dispatched elsewhere. Graceful termination adds *speed* - finishing in-flight work instead of repeating it - and is what makes scale-in safe to automate. Every scale-in, rollout and node drain ends the same way: Kubernetes sends `SIGTERM`, waits `terminationGracePeriodSeconds`, then `SIGKILL`.

### What Happens on Shutdown

Xians handles the signal for you. When `RunAsync()` is called without a cancellation token (the normal case), the platform registers handlers for `SIGTERM` and Ctrl-C that cancel the run token; every worker then:

1. **Stops polling** the task queues - no new work arrives.
2. **Completes workflow tasks** in progress - they are short, and workflow state already lives in Temporal.
3. **Lets running activities finish** within the graceful shutdown window (`GracefulShutdownTimeout`, set per workflow). Anything still running when the window ends is cancelled and Temporal retries it on another instance.

### What to Configure

**In activities** - pass the activity's cancellation token to long-running calls and heartbeat inside long loops. The platform delivers the shutdown signal through that token, so an activity that cannot finish in the window hands over to another instance in seconds instead of waiting for a timeout.

Everything else is configuration:

| Setting | Why | Typical value |
|---|---|---|
| `SIGTERM` / Ctrl-C handling | Built into `RunAsync()` | nothing to do |
| `GracefulShutdownTimeout` | How long running activities get to finish | longer than your typical activity |
| Activities honour the cancellation token | Lets an interrupted activity move to another instance at once | pass the token to long calls |
| Activity heartbeat timeout | Fast re-dispatch of an activity whose instance died | 30-60 s on activities over 1 min |
| `terminationGracePeriodSeconds` | Time for the drain before `SIGKILL`; must exceed `GracefulShutdownTimeout` | 60-120 s |

## Scaling Considerations

### Resource Limits

- **Memory and CPU**: see [Sizing Rules for Agents](#sizing-rules-for-agents); memory grows with `maxConcurrent`
- **Connections**: Each worker maintains Temporal connections - one long-poll per task queue, plus its LLM and API connections

### Temporal Configuration

Ensure your Temporal cluster can handle the load:

- Adequate history service capacity
- Sufficient matching service resources
- Properly sized persistence layer

### Node Capacity

- **Cluster Autoscaler** adds nodes to an existing pool when pods are unschedulable; start-up takes 1-3 minutes
- **Node auto-provisioning** (Karpenter, AKS NAP, GKE NAP) picks a VM size per pending pod set; better packing when agent sizes vary
- **Avoid burstable VM families** (e.g. Azure B-series) under autoscaling: credits run out exactly when you scale up

### Network Latency

- Workers in different regions may have higher latency
- Consider deploying Temporal workers close to Temporal server

### Cost Optimization

- Start with fewer workers and scale up as needed
- Monitor actual utilization vs provisioned capacity
- Use auto-scaling to optimize costs during low-traffic periods

## Monitoring and Observability

Track these metrics to optimize scaling. The Temporal server emits per-task-queue metrics and Kubernetes supplies the rest; integrate both with your monitoring stack (Prometheus, Grafana, etc.). Put these six on one dashboard per agent with a per-task-queue breakdown, and read them in the order shown - the first is the symptom, the others say which lever to pull.

| # | Signal | Source | Healthy | Investigate |
|---|---|---|---|---|
| 1 | `task_schedule_to_start_latency` (p95, per task queue) | Temporal server (matching) | < 1 s | > 30 s sustained for 5 min |
| 2 | Task queue backlog per task queue (`approximate_backlog_count`) | Temporal server | near 0 | growing for more than a few minutes |
| 3 | CPU utilization vs request; CPU throttling | Kubernetes | < 70%; no throttling | throttling rising |
| 4 | Memory working set vs limit; OOM-kill count | Kubernetes | < 80% of limit; 0 OOM | any OOM-kill |
| 5 | Workflow completion and failure rate; downstream 429 / timeout counts | Agent traces + your HTTP client | completions track starts; failures flat | failures or 429s rising together with latency |
| 6 | Autoscaler state: desired vs current replicas, time spent at `maxReplicas` | kube-state-metrics / KEDA | changes a few times a day | pinned at max, or oscillating every few minutes |

### Taking Decisions

Read signals 1-6 together; one metric on its own leads to the wrong lever.

| What you see | Meaning | Decision |
|---|---|---|
| 1 high, 2 backlog growing, 3 low | Workers are saturated on I/O, not CPU | **Scale out.** Raise replicas / `maxReplicas`, or `maxConcurrent` if memory allows |
| 1 high, 3 throttled | Pods are CPU-starved | **Scale up the pod** (CPU limit), not out |
| 1 high, 5 rising (429s, timeouts) | Downstream quota or dependency is the bottleneck | **Do not scale.** More pods make it worse; raise the quota, add rate limiting, then revisit |
| 1 high, 6 pinned at `maxReplicas` | Autoscaler is working and out of room | Raise `maxReplicas` only if 5 is flat and quotas allow; otherwise fix the downstream limit |
| 1 high, 6 flat at `minReplicas` | Autoscaler is watching the wrong signal (typically CPU on an I/O-bound agent) | Switch to backlog-based scaling (KEDA) |
| 1 normal, 6 oscillating | Behaviour too aggressive | See [Scaling Behaviour and Policies](#scaling-behaviour-and-policies) |
| 4 OOM-kills, 1 normal | Pod memory too small for `maxConcurrent` | **Vertical:** raise memory limit; never answer this with replicas |

Alert on the symptom users feel, not on the autoscaler's internals: queue latency over 30 s for 5 minutes on any task queue, workflow failures above 5%, the autoscaler sitting at `maxReplicas` for 15 minutes, and any OOM-kill.

## Server Replicas + Redis

> For the full picture of all cache providers (`memory`, `redis`, `noop`) and when to use each, see [Caching](caching.md). This section covers the Redis-specific requirements for multi-replica deployments.

The server is stateless by design - a Temporal **client**, not a worker - so it scales with a plain CPU HPA to as many replicas as your traffic needs, with none of the worker prerequisites above. Redis is the one shared dependency.

When you run **multiple `xiansAi.Server` replicas** behind a load balancer, set `Cache__Provider=redis` and provide `Cache__Redis__ConnectionString`. This is required for correct behavior across instances.

Redis is used for three concerns:

1. **ObjectCache** — shared cache for the agent cache API, tenant OIDC config, and auth handoff payloads (via `ICacheProvider`).
2. **Auth and messaging L1 invalidation bus** — when auth state or messaging caches change on one replica, invalidation events propagate to every other replica so local L1 caches are cleared without waiting for TTL expiry.
3. **Pending `/converse` coordination** — synchronous `/converse` requests that wait on one instance can be completed by an agent response handled on a different instance. Short-lived result payloads in Redis are encrypted with the same conversation encryption key used for MongoDB at-rest encryption (see [Chat message encryption](encryption.md)); completion signals carry only the request id.

Without Redis on a multi-replica deployment:

- **Stale auth** — user disable, API key revoke, activation deactivate, and similar changes may not be visible on other replicas until the cache TTL expires.
- **`/converse` timeouts** — if the HTTP waiter and the agent completer land on different instances, the request may time out because there is no cross-instance signal.

Single-instance deployments can keep the default `Cache__Provider=memory`, or use `Cache__Provider=noop` to disable caching entirely — see [Caching](caching.md) for details on all provider options.

### Production Redis security

Redis is a trusted control plane for invalidation and pending-request coordination. In production:

1. **Network isolation** — Redis must be reachable only from server replicas (private network / private endpoint), not the public internet.
2. **AUTH** — include a password in the connection string.
3. **TLS** — set `ssl=true` (or equivalent).

Startup **fails** outside Development if AUTH or TLS is missing. For local Docker Redis without AUTH/TLS, Development only warns; outside Development set `Cache__Redis__AllowInsecureConnection=true` for lab use only (never in production).

```bash
# Production
Cache__Provider=redis
Cache__Redis__ConnectionString=your-redis-host:6380,password=YOUR_PASSWORD,ssl=true

# Local / lab only (insecure Redis)
# Cache__Provider=redis
# Cache__Redis__ConnectionString=localhost:6379
# Cache__Redis__AllowInsecureConnection=true
```

See [Installation — Optional settings](installation.md#optional-settings) and the [Cache provider README](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Src/Shared/Providers/Cache/README.md) for configuration details.

## Summary

| Scaling Type | Method | Use Case | Configuration |
|--------------|--------|----------|---------------|
| **Horizontal** | Multiple instances | High availability, fault tolerance | Just spawn more processes |
| **Worker Versioning** | Versioned rollouts | Deploy new builds without breaking running workflows | `WorkerVersioning` option; Worker Controller on Kubernetes |
| **Vertical** | Workers per workflow | Concurrent executions within instance | `maxConcurrent` parameter |
| **Auto Scaling** | Queue-based scaling | Dynamic workload adaptation | KEDA Temporal scaler (`ScaledObject`), or external monitoring + orchestration |
| **Auto Scaling - Schedule** | KEDA cron scaler | Predictable business-hours load | Cron trigger plus a reactive trigger |
| **Vertical Pod Autoscaling** | VPA / in-place resize | OOM-kills, throttling, over-provisioning | VPA `Off` mode; never `Auto` alongside a CPU HPA |
| **Server** | Multiple replicas | Server availability | `Cache__Provider=redis` |

The Xians platform's integration with Temporal provides powerful, flexible scaling capabilities with minimal configuration. Start simple and scale as your workload demands.
