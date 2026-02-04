# Webhooks

Webhooks enable external systems to trigger and interact with your agent workflows in real-time. Think of them as HTTP callbacks that let third-party services (payment processors, CRMs, monitoring systems, etc.) push events directly into your agent ecosystem.

## Quick Start

### 1. Register a Webhook Handler

Built-in workflows can handle webhooks using the `OnWebhook()` method. You can use either a **synchronous** or **async** handler:

#### Synchronous Handler (for simple, non-async operations)

```csharp
using DotNetEnv;
using System.Net;
using Xians.Lib.Agents.Core;
using Xians.Lib.Agents.Messaging;

// Load environment variables
Env.Load();

var serverUrl = Environment.GetEnvironmentVariable("XIANS_SERVER_URL") 
    ?? throw new InvalidOperationException("XIANS_SERVER_URL not found");
var xiansApiKey = Environment.GetEnvironmentVariable("XIANS_API_KEY") 
    ?? throw new InvalidOperationException("XIANS_API_KEY not found");

// Initialize platform
var xiansPlatform = await XiansPlatform.InitializeAsync(new()
{
    ServerUrl = serverUrl,
    ApiKey = xiansApiKey
});

// Register agent (system-scoped can handle webhooks across all tenants)
var xiansAgent = xiansPlatform.Agents.Register(new()
{
    Name = "WebhookTestAgent",
    IsTemplate = true
});

// Define built-in workflow
var integratorWorkflow = xiansAgent.Workflows.DefineBuiltIn(name: "Integrator");

// Handle incoming webhooks (synchronous)
integratorWorkflow.OnWebhook((context) =>
{
    // Your webhook processing logic here
    Console.WriteLine($"Received: {context.Webhook.Name}");
    context.Respond(new { status = "success" });
});

// Start the agent
await xiansAgent.RunAllAsync();
```

#### Async Handler (when you need async operations)

Use the async version when you need to perform async operations like database calls, HTTP requests, etc.:

```csharp
// Handle incoming webhooks (async)
integratorWorkflow.OnWebhook(async (context) =>
{
    // Perform async operations
    var result = await ProcessWebhookAsync(context.Webhook.Payload);
    context.Respond(new { status = "success", result });
});
```

### 2. Call Your Webhook

Once your agent is running, send POST requests to:

```
POST {SERVER_URL}/api/user/webhooks/builtin
```

#### Required Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `apikey` | Your Xians API key | `sk-Xnai-abc123...` |
| `agentName` | The target agent name | `WebhookTestAgent` |
| `workflowName` | The target workflow name | `Integrator` |
| `webhookName` | Any identifier for this webhook event | `Email Received` |
| `participantId` | Any User/participant identifier | `user@example.com` |

#### Optional Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `timeoutSeconds` | Request timeout (default: 30s) | `60` |
| `scope` | Custom scope for context (same as Chat messages) | `tenant-123` |
| `authorization` | Auth token for your logic | `Bearer jwt-token` |

#### Request Body

Send your webhook payload as JSON in the request body:

```json
{
  "orderId": "12345",
  "amount": 99.99,
  "status": "completed"
}
```

#### Complete Example

```bash
curl -X POST "http://localhost:5005/api/user/webhooks/builtin?apikey=sk-Xnai-zSsUNO5KaeyHefrWEyQvvyOBmX0&timeoutSeconds=30&agentName=WebhookTestAgent&workflowName=Integrator&webhookName=OrderCompleted&scope=tenant-123&authorization=Bearer-token&participantId=customer@example.com" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "12345", "amount": 99.99, "status": "completed"}'
```

### 3. Monitor Webhooks in the UI

All webhook messages are visible in the **Messaging Playground** in the Xians UI, just like chat and data messages. This provides full visibility into webhook execution, timing, and metadata.

![Webhook Messages in Messaging Playground](../assets/images/webhook-ui.png)

In the Messaging Playground, you can:

- **View webhook messages** alongside other message types in the conversation view
- **Inspect message details** including:
  - Message Type: `Webhook`
  - Webhook name and participant ID
  - Request ID for tracking
  - Scope and authorization data
  - Complete payload data
  - Execution status and timing
- **Track conversations** created by webhook invocations
- **Debug webhook flows** by observing the complete message history

This makes it easy to monitor, debug, and audit webhook integrations without needing to add custom logging.

## Extracting Webhook Information

The `WebhookContext` provides access to all webhook data through the `Webhook` property:

```csharp
integratorWorkflow.OnWebhook((context) =>
{
    // Extract webhook metadata
    var webhookName = context.Webhook.Name;           // "OrderCompleted"
    var participantId = context.Webhook.ParticipantId; // "customer@example.com"
    var scope = context.Webhook.Scope;                // "tenant-123"
    var authorization = context.Webhook.Authorization; // "Bearer-token"
    var requestId = context.Webhook.RequestId;        // Unique request ID
    var tenantId = context.Webhook.TenantId;          // Tenant context
    
    // Extract payload (from POST body)
    var payload = context.Webhook.Payload;
    
    // For typed access, cast or deserialize:
    if (payload is JsonElement jsonElement)
    {
        var orderId = jsonElement.GetProperty("orderId").GetString();
        var amount = jsonElement.GetProperty("amount").GetDecimal();
        var status = jsonElement.GetProperty("status").GetString();
        
        Console.WriteLine($"Processing order {orderId} for ${amount}");
    }
});
```

### Available Webhook Properties

| Property | Type | Description |
|----------|------|-------------|
| `Name` | `string` | Webhook name from query parameter |
| `ParticipantId` | `string` | Participant identifier |
| `Payload` | `object?` | Request body data (JSON) |
| `Scope` | `string?` | Optional scope context |
| `Authorization` | `string?` | Optional auth token |
| `RequestId` | `string` | Unique request identifier |
| `TenantId` | `string` | Tenant context |

## Responding to Webhooks

You have three ways to respond, all with full control over HTTP status codes, headers, and content.

### Option 1: Simple Object Response

Perfect for straightforward JSON responses:

```csharp
integratorWorkflow.OnWebhook((context) =>
{
    // Process webhook...
    
    // Respond with an object (auto-serialized to JSON)
    context.Respond(new 
    { 
        message = "Success", 
        processedAt = DateTime.UtcNow 
    });
});
```

### Option 2: Full Control Response

For custom status codes, headers, and content types:

```csharp
integratorWorkflow.OnWebhook((context) =>
{
    context.Response = new WebhookResponse
    {
        StatusCode = HttpStatusCode.OK,
        Content = "{\"message\": \"Success\", \"id\": \"12345\"}",
        ContentType = "application/json",
        Headers = new Dictionary<string, string[]>
        {
            ["X-Custom-Header"] = new[] { "CustomValue" },
            ["X-Request-Id"] = new[] { context.Webhook.RequestId }
        }
    };
});
```

### Option 3: Static Factory Methods

Convenient helpers for common responses:

```csharp
integratorWorkflow.OnWebhook(async (context) =>
{
    try
    {
        // Process webhook...
        var result = await ProcessOrderAsync(context.Webhook.Payload);
        
        // Success response
        context.Response = WebhookResponse.Ok(new 
        { 
            success = true, 
            orderId = result.OrderId 
        });
    }
    catch (ValidationException ex)
    {
        // Bad request (400)
        context.Response = WebhookResponse.BadRequest(ex.Message);
    }
    catch (NotFoundException ex)
    {
        // Not found (404)
        context.Response = WebhookResponse.NotFound(ex.Message);
    }
    catch (Exception ex)
    {
        // Internal server error (500)
        context.Response = WebhookResponse.InternalServerError(
            $"Failed to process webhook: {ex.Message}");
    }
});
```

### Available Factory Methods

| Method | Status Code | Description |
|--------|-------------|-------------|
| `WebhookResponse.Ok(object)` | 200 | Success with JSON data |
| `WebhookResponse.Ok(string)` | 200 | Success with custom content |
| `WebhookResponse.BadRequest(message)` | 400 | Validation/client error |
| `WebhookResponse.NotFound(message)` | 404 | Resource not found |
| `WebhookResponse.InternalServerError(message)` | 500 | Server error |
| `WebhookResponse.Error(code, message)` | Custom | Custom status code |

## Common Patterns

### Authentication & Authorization

```csharp
integratorWorkflow.OnWebhook(async (context) =>
{
    // Verify authorization token
    var authToken = context.Webhook.Authorization;
    if (string.IsNullOrEmpty(authToken) || !await ValidateTokenAsync(authToken))
    {
        context.Response = WebhookResponse.Error(
            HttpStatusCode.Unauthorized, 
            "Invalid or missing authorization token");
        return;
    }
    
    // Process authenticated webhook
    // ...
});
```

### Payload Validation

```csharp
integratorWorkflow.OnWebhook((context) =>
{
    if (context.Webhook.Payload is not JsonElement payload)
    {
        context.Response = WebhookResponse.BadRequest("Invalid payload format");
        return;
    }
    
    if (!payload.TryGetProperty("orderId", out var orderIdElement))
    {
        context.Response = WebhookResponse.BadRequest("Missing required field: orderId");
        return;
    }
    
    // Continue processing...
});
```

### Async Processing

```csharp
integratorWorkflow.OnWebhook(async (context) =>
{
    var webhookName = context.Webhook.Name;
    var payload = context.Webhook.Payload;
    
    // Start async processing
    _ = Task.Run(async () => 
    {
        await ProcessLongRunningTaskAsync(webhookName, payload);
    });
    
    // Respond immediately
    context.Respond(new 
    { 
        status = "accepted", 
        message = "Processing started",
        requestId = context.Webhook.RequestId
    });
});
```

## Important Notes

- **Error Handling**: Always wrap webhook logic in try-catch blocks to provide meaningful error responses
- **Timeouts**: Default timeout is 30 seconds; adjust via `timeoutSeconds` parameter for long-running operations
- **Security**: Use the `authorization` parameter to pass and validate tokens in your webhook handler
- **Request IDs**: Use `context.Webhook.RequestId` for logging and tracking webhook requests

## Next Steps

- Learn about [Agents & Workflows](./agents.md) for built-in workflows and system-scoped agents
- Explore [Replying to Users](./messaging-replying.md) for more messaging capabilities
- Check out [SDK Patterns](./sdk-patterns.md) for common implementation patterns
