# Observability

XiansAi Server and agents can export **traces**, **metrics**, and **logs** using [OpenTelemetry](https://opentelemetry.io/) (OTLP). Telemetry is **off by default**. Turn it on only when you have a collector (or a local viewer such as the Aspire Dashboard) ready to receive data.

Typical production path (for example Agentri):

```text
Agent (Xians.Lib)                 XiansAi.Server
  OpenTelemetry (opt-in)            OpenTelemetry (opt-in)
  W3C traceparent on HTTP  ──────►  continues the same trace
  OTLP                              OTLP
           \                       /
            └────► OTel Collector ───► Application Insights
                   (or another backend)
```

Agent workflow logs still upload to MongoDB for Agent Studio. When a trace is active, agents also send `traceId` / `spanId` with those logs so you can correlate Studio logs with Application Insights.

## What gets exported

| Signal | Server | Agent (Xians.Lib) |
| --- | --- | --- |
| Traces | ASP.NET Core, HttpClient, MongoDB, Temporal, custom sources | Temporal workflows/activities (when SDK enabled) |
| Metrics | ASP.NET Core, HttpClient, Runtime | — (traces/logs first) |
| Logs | `ILogger` via OTLP | `ILogger` via OTLP when enabled (Mongo upload unchanged) |

## Server configuration

Set these on the Server (Docker env / App Service settings):

| Variable | Default | Description |
| --- | --- | --- |
| `OpenTelemetry__Enabled` | `false` | Master switch. Leave `false` unless a collector endpoint is reachable. |
| `OpenTelemetry__ServiceName` | `XiansAi.Server` | Service name shown in your observability backend. |
| `OpenTelemetry__OtlpEndpoint` | — | OTLP **gRPC** endpoint, e.g. `http://otel-collector:4317` or `http://aspire-dashboard:18889` for local Aspire. |
| `OpenTelemetry__IncludeUserIdentity` | `false` | If `true`, adds user identity fields to spans. **PII** — enable only in trusted environments. |
| `OPENTELEMETRY_TENANT_TAG_NAME` | `tenant.id` | Attribute name used for tenant id on spans/logs. |
| `OpenTelemetry__MongoDB__ExcludedCommands` | — | Optional comma-separated Mongo commands to skip (e.g. `getMore,ping`). |
| `OpenTelemetry__MongoDB__CaptureCommandText` | `false` | If `true`, includes raw Mongo command text on spans (can contain sensitive data). |

Example (production collector):

```bash
OpenTelemetry__Enabled=true
OpenTelemetry__ServiceName=XiansAi.Server
OpenTelemetry__OtlpEndpoint=http://otel-collector:4317
```

Example (local Aspire Dashboard):

```bash
OpenTelemetry__Enabled=true
OpenTelemetry__ServiceName=XiansAi.Server
OpenTelemetry__OtlpEndpoint=http://localhost:18889
```

```bash
docker run --rm -p 18888:18888 -p 18889:18889 \
  mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

Open the UI at `http://localhost:18888`.

!!! tip "Fail-safe"
    If the endpoint is missing or OpenTelemetry fails to start, the Server keeps running and only skips export.

## Agent configuration (Xians.Lib)

Agents use the same style of flags. Set them on the agent host process:

| Variable | Default | Description |
| --- | --- | --- |
| `OpenTelemetry__Enabled` | off | Turn on the agent OpenTelemetry SDK. |
| `OpenTelemetry__OtlpEndpoint` | — | Same collector URL the Server uses (required when enabled). |
| `OpenTelemetry__ServiceName` | `Xians.Agent` | Optional; use a specific name per agent if helpful. |

```bash
OpenTelemetry__Enabled=true
OpenTelemetry__ServiceName=Xians.Agent
OpenTelemetry__OtlpEndpoint=http://otel-collector:4317
```

When enabled:

- Temporal workflow/activity spans are exported over OTLP.
- Agent `ILogger` records are also sent to the collector.
- Outbound agent → Server HTTP calls include W3C **`traceparent`** so the Server continues the same distributed trace.

MongoDB log upload (`SERVER_LOG_LEVEL` / Studio logs) is unchanged. See [Logging](../concepts/logging.md).

## Continuous tracing

1. Agent starts (or continues) a trace in Temporal / HTTP.
2. Agent HTTP to the Server carries `traceparent`.
3. Server ASP.NET Core instrumentation joins that trace.
4. Agent logs stored in Mongo can include `trace_id` / `span_id` for correlation with App Insights.

## Collector → Application Insights

The apps speak **OTLP only**. They do not read `APPLICATIONINSIGHTS_CONNECTION_STRING` directly. Deploy an OpenTelemetry Collector that receives OTLP and exports to Azure Monitor / Application Insights.

Sample collector config:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:

exporters:
  azuremonitor:
    connection_string: "${APPLICATIONINSIGHTS_CONNECTION_STRING}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [azuremonitor]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [azuremonitor]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [azuremonitor]
```

Use a collector distribution that includes the **Azure Monitor** exporter (for example `otel/opentelemetry-collector-contrib`).

### Operator checklist

1. Create an Application Insights resource and copy the connection string.
2. Deploy the collector (sidecar, Container Apps, ACI, etc.) with that connection string.
3. Point Server and agents at the collector (`OpenTelemetry__OtlpEndpoint`).
4. Set `OpenTelemetry__Enabled=true` on Server and agents.
5. Restart and confirm data in Application Insights (Transaction search / Logs).

Keep the collector **private** (VNet / internal only). Do not expose OTLP to the public internet.

## Correlation in Application Insights

| Signal | How to correlate |
| --- | --- |
| Agent → Server HTTP | W3C `traceparent` |
| Agent logs in Mongo / Studio | `trace_id` / `span_id` on the log document |
| App Insights | Same operation / trace id across requests, dependencies, traces, exceptions |

Sample Kusto (field names may vary by workspace):

```kusto
union traces, requests, dependencies, exceptions
| where timestamp > ago(1h)
| where operation_Id == "<trace-id>"
| order by timestamp asc
```

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| No data in App Insights | Collector running? Connection string set? Apps pointed at collector, not at App Insights directly? |
| Server starts but no export | `OpenTelemetry__Enabled=true` and `OpenTelemetry__OtlpEndpoint` set? Look for OpenTelemetry init lines in Server logs. |
| Agent has no traces | Same env vars on the agent host; restart after changing them. |
| Broken end-to-end trace | Confirm agent HTTP includes `traceparent` (needs an active Activity / OTel SDK). |
| Console-only logs | Expected when OpenTelemetry is disabled — that is the default. |

## Related docs

- [Server installation](installation.md) — full env reference and Docker run
- [Logging (SDK)](../concepts/logging.md) — workflow/activity logging and Studio upload
- [Metrics (SDK)](../concepts/metrics.md) — business/usage metrics API
- [Scaling](scaling.md) — multi-instance considerations
