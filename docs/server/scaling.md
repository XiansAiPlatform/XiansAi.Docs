# Scaling

The Xians platform provides flexible scaling options to handle varying workloads efficiently. You can scale both horizontally (multiple agent instances) and vertically (workers per workflow), with the platform automatically handling distribution and fault tolerance through Temporal.

## Horizontal Scaling - Multiple Agent Instances

You can spawn **any number of agent console applications**, and the platform automatically takes care of scaling and fault tolerance of agent runtimes. This is handled through Temporal workers and activity distribution.

### How It Works

When you start multiple instances of the same agent application:

1. Each instance registers as a Temporal worker for the same task queue
2. Temporal automatically distributes workflow executions and activities across all available workers
3. If one instance fails, Temporal redistributs work to healthy instances
4. No configuration changes needed - just start more instances

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

### Auto Scaling Metrics to Monitor

- **Task Queue Depth**: Number of pending workflow/activity executions
- **Worker Utilization**: Percentage of busy workers
- **Execution Rate**: Workflows started vs completed per minute
- **Latency**: Time from workflow start to first activity execution

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

## Scaling Considerations

### Resource Limits

- **Memory**: Each worker consumes memory; ensure adequate RAM
- **CPU**: More workers = more CPU usage
- **Connections**: Each worker maintains Temporal connections

### Temporal Configuration

Ensure your Temporal cluster can handle the load:

- Adequate history service capacity
- Sufficient matching service resources
- Properly sized persistence layer

### Network Latency

- Workers in different regions may have higher latency
- Consider deploying Temporal workers close to Temporal server

### Cost Optimization

- Start with fewer workers and scale up as needed
- Monitor actual utilization vs provisioned capacity
- Use auto-scaling to optimize costs during low-traffic periods

## Monitoring and Observability

Track these metrics to optimize scaling:

- **Workflow Execution Rate**: Throughput per worker/instance
- **Queue Latency**: Time tasks wait before execution
- **Worker Utilization**: Percentage of workers actively processing
- **Failure Rate**: Failed executions (may indicate overload)

Use Temporal's built-in metrics and integrate with your monitoring stack (Prometheus, Grafana, etc.) for comprehensive observability.

## Server Replicas + Redis

When you run **multiple `xiansAi.Server` replicas** behind a load balancer, set `Cache__Provider=redis` and provide `Cache__Redis__ConnectionString`. This is required for correct behavior across instances.

Redis is used for three concerns:

1. **ObjectCache** — shared cache for the agent cache API, tenant OIDC config, and auth handoff payloads (via `ICacheProvider`).
2. **Auth and messaging L1 invalidation bus** — when auth state or messaging caches change on one replica, invalidation events propagate to every other replica so local L1 caches are cleared without waiting for TTL expiry.
3. **Pending `/converse` coordination** — synchronous `/converse` requests that wait on one instance can be completed by an agent response handled on a different instance. Short-lived result payloads in Redis are encrypted with the same conversation encryption key used for MongoDB at-rest encryption (see [Chat message encryption](encryption.md)); completion signals carry only the request id.

Without Redis on a multi-replica deployment:

- **Stale auth** — user disable, API key revoke, activation deactivate, and similar changes may not be visible on other replicas until the cache TTL expires.
- **`/converse` timeouts** — if the HTTP waiter and the agent completer land on different instances, the request may time out because there is no cross-instance signal.

Single-instance deployments can keep the default `Cache__Provider=memory`.

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
| **Vertical** | Workers per workflow | Concurrent executions within instance | `maxConcurrent` parameter |
| **Auto Scaling** | Queue-based scaling | Dynamic workload adaptation | External monitoring + orchestration |

The Xians platform's integration with Temporal provides powerful, flexible scaling capabilities with minimal configuration. Start simple and scale as your workload demands.
