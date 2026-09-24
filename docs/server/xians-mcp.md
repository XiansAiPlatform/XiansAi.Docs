# Xians MCP

Xians MCP lets MCP-compatible clients discover and operate Xians resources through the Server. It currently supports agent discovery, workflow scheduling, and activation-scoped Data Explorer records.

The server uses stateless Streamable HTTP:

```text
https://your-xians-server/api/v1/admin/mcp
```

It is available when Xians Server runs in `WebApi` or `All` mode.

## Connect a client

1. In Agent Studio, select an agent activation and open **Settings → Connections**.
2. Copy the **Xians MCP** URL.
3. Open **Developer → Secrets → Admin API Keys** and generate a key.
4. Configure your MCP client to use Streamable HTTP and send the key as a Bearer token:

```http
Authorization: Bearer sk-Xnai-...
```

!!! danger "Protect the API key"
    Store the key in your client's secret or environment-variable facility. Never commit it or place its value in Agent Studio Rules.

MCP client configuration formats differ. Regardless of format, configure these values:

| Setting | Value |
| --- | --- |
| URL | `https://your-xians-server/api/v1/admin/mcp` |
| Transport | Streamable HTTP |
| Authentication | Bearer token using a Xians Admin API key |

## Available tools

### Discovery

| Tool | Purpose |
| --- | --- |
| `list_tenants` | Return the authenticated tenant ID. |
| `list_agents` | List accessible agents and system templates. |
| `list_activations` | List an agent's activations. |
| `list_workflows` | List registered workflow types and their ordered inputs. |

### Scheduling

| Tool | Purpose |
| --- | --- |
| `list_schedules` | List schedules for an activation. |
| `create_schedule` | Schedule a registered workflow using cron and ordered JSON arguments. |
| `update_schedule_timing` | Change cron and timezone while preserving inputs and pause state. |
| `pause_schedule` | Pause future runs. |
| `resume_schedule` | Resume future runs. |
| `delete_schedule` | Permanently delete a schedule after confirmation. |

The agent worker must be running when a scheduled workflow executes. MCP creates and manages the schedule; the workflow determines what runs and where its output is delivered. See [Scheduling](../concepts/scheduling.md) for workflow and cron behavior.

### Data Explorer

| Tool | Purpose |
| --- | --- |
| `list_data_types` | List record categories saved by an activation. |
| `list_data_records` | Browse records by type and date. |
| `save_data_record` | Save a JSON object as a new record. |
| `delete_data_record` | Permanently delete an exact record after confirmation. |
| `delete_data_records` | Permanently delete up to 100 previewed records after confirmation. |

`save_data_record` accepts `content` as JSON object text, such as `"{\"title\":\"Report\"}"`. Data browsing is limited to 100 records per call and a 365-day date range. See [Document DB](../concepts/document-db.md) for how agents store documents.

## Authorization and safety

- The Admin API key determines the authenticated tenant and user.
- Agent read/write permissions are checked for every targeted operation.
- Tool arguments cannot switch the authenticated tenant.
- Schedule and record deletion require `confirmed: true` after explicit user approval.
- Confirmation flags guide the MCP client; they are not a separate human-approval security boundary.
- Bulk deletion is limited to the records previewed by the request and rejects matches above 100 records.
- Deletions are irreversible. List resources first and reuse their exact IDs.

Xians MCP currently exposes discovery, scheduling, and Data Explorer tools. It does not expose webhook management or the complete Admin API.
