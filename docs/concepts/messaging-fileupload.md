# File Upload Messaging

File uploads allow client applications to send files (documents, images, etc.) to agent workflows. The SDK routes file uploads to dedicated `OnFileUpload` handlers when messages use the **`File`** message type—a first-class type with the base64-encoded file in the `data` payload.

> **Important:** File uploads use `type: "File"` (not `Chat`, `Webhook` or `Data`). The `File` type routes directly to `OnFileUpload` handlers.

## Listening for File Uploads on the Agent

Register a file upload handler on your built-in workflow using `OnFileUpload()`:

```csharp
var conversationalWorkflow = xiansAgent.Workflows.DefineBuiltIn(name: "Conversational");

conversationalWorkflow.OnFileUpload(async (context) =>
{
    string base64Content;
    string? fileName = null;

    if (context.Message.Data is System.Text.Json.JsonElement jsonElement)
    {
        base64Content = jsonElement.TryGetProperty("content", out var contentProp)
            ? contentProp.GetString() ?? ""
            : jsonElement.GetString() ?? "";
        if (jsonElement.TryGetProperty("fileName", out var fn))
            fileName = fn.GetString();
    }
    else
    {
        base64Content = context.Message.Data?.ToString() ?? "";
        fileName = context.Message.Text;
    }

    if (string.IsNullOrEmpty(base64Content))
    {
        await context.ReplyAsync("No file data received.");
        return;
    }

    try
    {
        var fileBytes = Convert.FromBase64String(base64Content);
        await context.ReplyAsync(
            $"File received! Processed {fileBytes.Length} bytes. Name: {fileName ?? "uploaded-file"}");
    }
    catch (FormatException)
    {
        await context.ReplyAsync("Invalid file format. Please ensure the file is base64 encoded.");
    }
});
```

### Handler Context

The handler receives a `UserMessageContext` (same as `OnUserChatMessage` and `OnUserDataMessage`). Key properties:

| Property | Description |
|----------|-------------|
| `context.Message.Data` | The base64 encoded file content (string or object containing it) |
| `context.Message.Text` | Optional text (e.g., caption, filename) if sent by client |
| `context.Message.ParticipantId` | User identifier who sent the file |
| `context.Message.RequestId` | Request tracking ID |
| `context.Message.TenantId` | Tenant context |
| `context.Message.Metadata` | Optional metadata (e.g., fileName, contentType) if sent by client |

### Accessing Metadata

Clients may send an object in `data` with both the file content and metadata:

```json
{
  "content": "base64EncodedFileContentHere...",
  "fileName": "report.pdf",
  "contentType": "application/pdf"
}
```

In your handler, extract the content and metadata accordingly:

```csharp
conversationalWorkflow.OnFileUpload(async (context) =>
{
    string base64Content;
    string? fileName = null;
    string? contentType = null;

    if (context.Message.Data is System.Text.Json.JsonElement jsonElement)
    {
        base64Content = jsonElement.GetProperty("content").GetString() ?? "";
        if (jsonElement.TryGetProperty("fileName", out var fn))
            fileName = fn.GetString();
        if (jsonElement.TryGetProperty("contentType", out var ct))
            contentType = ct.GetString();
    }
    else
    {
        base64Content = context.Message.Data?.ToString() ?? "";
    }

    var fileBytes = Convert.FromBase64String(base64Content);
    // Process with optional fileName, contentType...
});
```

### Replying to the User

Use the same reply methods as other message handlers:

- `await context.ReplyAsync("Thank you for the file.")`
- `await context.SendDataAsync(new { status = "processed", size = fileBytes.Length })`
- `await context.GetChatHistoryAsync()` to access conversation history

---

## Sending File Uploads from Client Applications

Use the **Messaging Admin API** to send file upload messages from your client application.

### Endpoint

```
POST /api/v1/admin/tenants/{tenantId}/messaging/send
```

### Required Request Body Fields

| Field | Type | Description |
|-------|------|-------------|
| `agentName` | string | Name of the target agent |
| `activationName` | string | Name of the activation (workflow instance) |
| `participantId` | string | Identifier of the user sending the file |
| `type` | string | Must be **`"File"`** |
| `data` | string or object | The base64 encoded file content |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Optional caption or filename |
| `workflowType` | string | Workflow type (default: `"Supervisor Workflow"`). Use `"Conversational"` for agents with conversational workflows. |
| `topic` | string | Scope/topic for organizing the message thread |
| `requestId` | string | Custom request ID (auto-generated if omitted) |
| `hint` | string | Hint for the agent |
| `authorization` | string | Auth token (or use `Authorization` header) |

### Request Format

The workflow ID is derived as:  
`{tenantId}:{agentName}:{workflowType}:{activationName}`

### Example: Minimal Format (Base64 String in Data)

```bash
curl -X POST "https://your-server/api/v1/admin/tenants/default/messaging/send" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "DocumentAgent",
    "activationName": "DocumentAgent - Default",
    "participantId": "user@example.com",
    "type": "File",
    "data": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL1RGIDggVGYKMTAwIDcwMCBUZAooVGhpcyBpcyBhIFBERiB0ZXN0KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMzkgMDAwMDAgbiAKMDAwMDAwMDIwOCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDUKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjI5NQolJUVPRgo="
  }'
```

### Example: Rich Format (Object with Metadata)

```bash
curl -X POST "https://your-server/api/v1/admin/tenants/default/messaging/send" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "DocumentAgent",
    "activationName": "DocumentAgent - Default",
    "participantId": "user@example.com",
    "type": "File",
    "text": "invoice.pdf",
    "data": {
      "content": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAo...",
      "fileName": "invoice.pdf",
      "contentType": "application/pdf",
      "fileSize": 1024
    },
    "topic": "document-uploads"
  }'
```

### Tenant ID

Provide the tenant ID in one of these ways:

- **URL path**: `/api/v1/admin/tenants/default/messaging/send`
- **Header**: `X-Tenant-Id: default`

---

## Summary

| Aspect | Detail |
|--------|--------|
| **Agent registration** | `workflow.OnFileUpload(async context => { ... })` |
| **Message type** | `File` |
| **Data field** | Base64 encoded file (string or object with `content` and optional metadata) |
| **Text field** | Optional (caption, filename) |
| **API endpoint** | `POST /api/v1/admin/tenants/{tenantId}/messaging/send` |
| **Required API fields** | `agentName`, `activationName`, `participantId`, `type: "File"`, `data` |
