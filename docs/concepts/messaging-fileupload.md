# File Upload Messaging

File uploads allow client applications to send files (documents, images, etc.) to agent workflows. The SDK routes file uploads to dedicated `OnFileUpload` handlers when messages use the **`File`** message type—a first-class type for sending one or more files, optionally with accompanying chat text.

> **Important:** File uploads use `type: "File"` (not `Chat`, `Webhook` or `Data`). The `File` type routes directly to `OnFileUpload` handlers.

## How Files Are Stored

Clients **send** files as base64 (see [Sending File Uploads](#sending-file-uploads-from-client-applications)). On receipt, the server writes the file bytes to **MongoDB GridFS** (bucket `message_files`, tenant-scoped) and keeps only lightweight **references** in the message and the workflow signal:

```json
{ "files": [{ "fileId": "…", "fileName": "invoice.pdf", "contentType": "application/pdf", "fileSize": 1024 }] }
```

This keeps large payloads out of the Temporal signal (which caps a single payload at ~2MB), so multiple/larger files no longer fail with `Blob data size exceeds limit`. Two consequences:

- **Agents:** `context.Message.Files` continues to expose the decoded bytes. The SDK transparently downloads referenced files before your `OnFileUpload` handler runs — no code changes required.
- **Message history / SSE:** the stored `data` now contains references (`fileId` + metadata), not base64. Download the bytes on demand from the [download endpoints](#downloading-stored-files).

## Listening for File Uploads on the Agent

Register a file upload handler on your built-in workflow using `OnFileUpload()`. The SDK automatically decodes the message payload into typed `UploadedFile` objects, available via `context.Message.Files`—no manual JSON parsing required:

```csharp
var conversationalWorkflow = xiansAgent.Workflows.DefineSupervisor();

conversationalWorkflow.OnFileUpload(async (context) =>
{
    var files = context.Message.Files;

    if (files.Count == 0)
    {
        await context.ReplyAsync("No file data received.");
        return;
    }

    foreach (var file in files)
    {
        if (!file.TryGetBytes(out var fileBytes))
        {
            await context.ReplyAsync(
                $"Invalid file format for '{file.FileName ?? "uploaded-file"}'. " +
                "Please ensure the file is base64 encoded.");
            return;
        }

        // Process the file...
        await context.ReplyAsync(
            $"File received! {file.FileName ?? "uploaded-file"} " +
            $"({fileBytes!.Length} bytes{(file.ContentType != null ? $", {file.ContentType}" : "")})");
    }
});
```

### The `UploadedFile` Type

Each entry in `context.Message.Files` is an `UploadedFile` with typed access to the content and metadata:

| Member | Type | Description |
|--------|------|-------------|
| `Content` | `string` | The base64 encoded file content. For referenced (GridFS-backed) files, the SDK resolves this automatically before the handler runs |
| `FileName` | `string?` | The file name, if provided by the client |
| `ContentType` | `string?` | The MIME type (e.g. `application/pdf`), if provided by the client |
| `FileSize` | `long?` | The file size in bytes, if provided by the client |
| `FileId` | `string?` | The server storage id for files stored out-of-band (GridFS); `null` for inline files |
| `GetBytes()` | `byte[]` | Decodes the base64 content into raw bytes (throws `FormatException` on invalid base64) |
| `TryGetBytes(out byte[]? bytes)` | `bool` | Decodes without throwing; returns `false` on invalid base64 |

> The bytes for referenced files are downloaded transparently before your handler runs, so `GetBytes()` / `TryGetBytes()` and `Content` work the same for inline and GridFS-backed files.

### Supported Payload Formats

`context.Message.Files` decodes all the wire formats a `File` message can arrive in:

| Format | `data` payload | Result |
|--------|----------------|--------|
| **Reference** (as stored/delivered) | `{ "files": [{ "fileId", "fileName", "contentType", "fileSize" }, ...] }` | One `UploadedFile` per entry; bytes resolved from GridFS automatically |
| Multi-file (inline) | `{ "files": [{ "content", "fileName", "contentType", "fileSize" }, ...] }` | One `UploadedFile` per entry |
| Single file object | `{ "content", "fileName", "contentType", "fileSize" }` | One `UploadedFile` |
| Raw base64 string | `"JVBERi0x..."` | One `UploadedFile`; `context.Message.Text` is used as the `FileName` |

Entries without either `content` or `fileId` are skipped, and unrecognizable data yields an empty list (it never throws). The raw payload also remains available via `context.Message.Data` if you need it. In practice, messages persisted by the server use the **reference** format; the inline formats are accepted for backward compatibility and direct inbound calls.

### Handler Context

The handler receives a `UserMessageContext` (same as `OnUserChatMessage` and `OnUserDataMessage`). Key properties:

| Property | Description |
|----------|-------------|
| `context.Message.Files` | The uploaded files decoded as typed `UploadedFile` objects |
| `context.Message.Data` | The raw message data (base64 string or object), if you need direct access |
| `context.Message.Text` | Optional text (e.g., caption, filename) if sent by client |
| `context.Message.ParticipantId` | User identifier who sent the file |
| `context.Message.RequestId` | Request tracking ID |
| `context.Message.TenantId` | Tenant context |
| `context.Message.Metadata` | Optional metadata if sent by client |

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
POST /api/v1/admin/tenants/{tenantId}/messaging/send/file
```

This is the recommended, specialized file endpoint. It accepts a strongly-typed `files` array, so the request schema is self-documenting in Swagger and validated server-side. There is no `type` field (the `File` type is implied by the endpoint), and files are sent at the **top level**—not nested under `data`.

### Required Request Body Fields

| Field | Type | Description |
|-------|------|-------------|
| `agentName` | string | Name of the target agent |
| `activationName` | string | Name of the activation (workflow instance) |
| `participantId` | string | Identifier of the user sending the file |
| `files` | array | One or more files. Each entry: `content` (base64, required), `fileName` (required), `contentType` (required), `fileSize` (optional) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Optional chat text/caption to accompany the files |
| `workflowType` | string | Workflow name (default: `"Supervisor Workflow"` — the conventional chat workflow). Only set this if your agent uses a custom workflow name. |
| `topic` | string | Scope/topic for organizing the message thread |
| `requestId` | string | Custom request ID (auto-generated if omitted) |
| `hint` | string | Hint for the agent |
| `origin` | string | Source channel identifier |
| `authorization` | string | Auth token (or use `Authorization` header) |

### Limits

The endpoint validates the payload and rejects it with `400 Bad Request` if:

| Limit | Value |
|-------|-------|
| Max files per message | 5 |
| Max size per file | 10 MB (decoded) |
| Max combined size per message | 20 MB (decoded) |

### Request Format

The workflow ID is derived as:  
`{tenantId}:{agentName}:{workflowType}:{activationName}`

### Example: Multiple Files

Send one or more files in a single message using the top-level `files` array, optionally with accompanying chat `text`:

```bash
curl -X POST "https://your-server/api/v1/admin/tenants/default/messaging/send/file" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "DocumentAgent",
    "activationName": "DocumentAgent - Default",
    "participantId": "user@example.com",
    "text": "Here are the invoice and the receipt.",
    "files": [
      {
        "content": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAo...",
        "fileName": "invoice.pdf",
        "contentType": "application/pdf",
        "fileSize": 1024
      },
      {
        "content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...",
        "fileName": "receipt.png",
        "contentType": "image/png",
        "fileSize": 2048
      }
    ],
    "topic": "document-uploads"
  }'
```

### Example: Single File

Sending a single file is the same request with one entry in the `files` array:

```bash
curl -X POST "https://your-server/api/v1/admin/tenants/default/messaging/send/file" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "DocumentAgent",
    "activationName": "DocumentAgent - Default",
    "participantId": "user@example.com",
    "text": "invoice.pdf",
    "files": [
      {
        "content": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAo...",
        "fileName": "invoice.pdf",
        "contentType": "application/pdf",
        "fileSize": 1024
      }
    ],
    "topic": "document-uploads"
  }'
```

### Tenant ID

Provide the tenant ID in one of these ways:

- **URL path**: `/api/v1/admin/tenants/default/messaging/send/file`
- **Header**: `X-Tenant-Id: default`

---

## Legacy: Generic `/send` Endpoint

The generic messaging endpoint still accepts file messages for backward compatibility, using `type: "File"` and the file(s) nested under `data`:

```
POST /api/v1/admin/tenants/{tenantId}/messaging/send
```

The `data` payload may take any of the [supported formats](#supported-payload-formats): the `{ "files": [...] }` array, a single file object, or a raw base64 string. New integrations should prefer `/send/file` above; the raw base64 string form is only available via this generic endpoint.

### Example: Raw Base64 String in Data

When `data` is a raw base64 string, the agent uses `text` as the file name:

```bash
curl -X POST "https://your-server/api/v1/admin/tenants/default/messaging/send" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "DocumentAgent",
    "activationName": "DocumentAgent - Default",
    "participantId": "user@example.com",
    "type": "File",
    "text": "test.pdf",
    "data": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL1RGIDggVGYKMTAwIDcwMCBUZAooVGhpcyBpcyBhIFBERiB0ZXN0KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMzkgMDAwMDAgbiAKMDAwMDAwMDIwOCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDUKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjI5NQolJUVPRgo="
  }'
```

---

## Downloading Stored Files

Because stored messages carry references (not bytes), the file content is fetched on demand. Both endpoints enforce tenant isolation — a file is only served to the tenant that owns it.

| Consumer | Endpoint | Auth |
|----------|----------|------|
| Client / browser | `GET /api/v1/admin/tenants/{tenantId}/messaging/files/{fileId}` | Admin API key (Bearer) |
| Agent SDK | `GET /api/agent/files/{fileId}` | Client certificate |

Both return the raw file bytes with the original `Content-Type` and a `Content-Disposition` filename. Agents rarely need the agent endpoint directly — `context.Message.Files` already resolves the bytes for you.

**Agent Studio** proxies downloads through `GET /api/messaging/files/{fileId}` (tenant resolved from the session) and renders file attachments as download links.

---

## Summary

| Aspect | Detail |
|--------|--------|
| **Agent registration** | `workflow.OnFileUpload(async context => { ... })` |
| **Message type** | `File` |
| **Typed file access** | `context.Message.Files` — a list of `UploadedFile` objects (content, name, type, size, fileId) |
| **Storage** | File bytes stored in MongoDB GridFS; messages/signals carry references (`fileId` + metadata) |
| **Data field (sent)** | `{ files: [...] }` inline base64 (recommended), single file object, or raw base64 string |
| **Data field (stored/delivered)** | `{ files: [{ fileId, fileName, contentType, fileSize }] }` references |
| **Text field** | Optional (chat caption; used as file name for raw base64 payloads) |
| **Send endpoint** | `POST /api/v1/admin/tenants/{tenantId}/messaging/send/file` (recommended); generic `/send` with `type: "File"` still supported |
| **Download endpoints** | `GET .../messaging/files/{fileId}` (Admin API key), `GET /api/agent/files/{fileId}` (certificate) |
| **Required API fields** | `agentName`, `activationName`, `participantId`, `files` |
| **Limits** | Max 5 files, 10 MB per file, 20 MB combined per message |
