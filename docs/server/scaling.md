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

Within a single agent instance, you can configure the number of **workers per workflow** to handle concurrent executions. This is specified when defining workflows.

### Built-In Workflows

Use the `workers` parameter in `DefineBuiltIn()`:

```csharp
// Single worker (default)
agent.Workflows.DefineBuiltIn();

// Multiple workers for concurrent executions
agent.Workflows.DefineBuiltIn(name: "DataProcessor", workers: 10);
```

### Custom Workflows

Use the `workers` parameter in `DefineCustom<T>()`:

```csharp
// Single worker (default)
agent.Workflows.DefineCustom<MyCustomWorkflow>();

// Multiple workers for concurrent executions
agent.Workflows.DefineCustom<MyCustomWorkflow>(workers: 5);
```

### Example: Multi-Workflow Agent

```csharp
var agent = platform.Agents.DefineAgent("DataPipeline");

// Low concurrency workflow
agent.Workflows.DefineBuiltIn(name: "Coordinator", workers: 2);

// High concurrency workflow for data processing
agent.Workflows.DefineBuiltIn(name: "Processor", workers: 20);

// Custom workflow with moderate concurrency
agent.Workflows.DefineCustom<ValidationWorkflow>(workers: 10);

await agent.RunAsync();
```

## Combining Horizontal and Vertical Scaling

You can combine both scaling strategies for maximum flexibility:

```csharp
// Define agent with 10 workers per workflow
var agent = platform.Agents.DefineAgent("HighThroughputAgent");
agent.Workflows.DefineBuiltIn(workers: 10);

await agent.RunAsync();
```

Then spawn 5 instances:

- **Total capacity**: 5 instances × 10 workers = 50 concurrent executions
- **Fault tolerance**: If 2 instances fail, 30 workers still available
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

## Summary

| Scaling Type | Method | Use Case | Configuration |
|--------------|--------|----------|---------------|
| **Horizontal** | Multiple instances | High availability, fault tolerance | Just spawn more processes |
| **Vertical** | Workers per workflow | Concurrent executions within instance | `workers` parameter |
| **Auto Scaling** | Queue-based scaling | Dynamic workload adaptation | External monitoring + orchestration |

The Xians platform's integration with Temporal provides powerful, flexible scaling capabilities with minimal configuration. Start simple and scale as your workload demands.

