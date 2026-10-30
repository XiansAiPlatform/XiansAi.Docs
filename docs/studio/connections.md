# Connections

The **Connections** page manages integrations for one agent activation. Open an agent activation, then select **Settings → Connections**.

## Connection types

| Type | Purpose |
| --- | --- |
| OAuth MCP | Gives the activation tools from an OAuth-protected MCP server. |
| Webhooks | Creates an inbound HTTP endpoint that triggers a registered workflow. |
| Slack | Connects a Slack app for inbound and outbound agent messaging. |
| Microsoft Teams | Connects an Azure Bot and Microsoft Teams channel for agent messaging. |

Available integration types can depend on the Xians Server configuration. For detailed messaging setup, see [Slack Integration](../server/slack-integration.md) and [Teams Integration](../server/teams-integration.md).

## OAuth MCP connections

An OAuth MCP connection lets the activation use a remote MCP server without placing OAuth credentials or tokens in agent configuration.

Before setup, create an OAuth app with the MCP provider and obtain its client ID and client secret.

### Connect a server

| Step | Action | HubSpot example |
| --- | --- | --- |
| 1 | Select **Add new connection** → **OAuth MCP**. | Choose **OAuth MCP**. |
| 2 | Register the exact `OAuth callback URL` in the provider's OAuth app. | `https://studio.example.com/api/connections/complete` |
| 3 | Enter `Connection Name`, `MCP Server URL`, `Client ID`, and `Client Secret`. | `Connection Name`: `HubSpot Production`<br>`MCP Server URL`: `https://mcp.hubspot.com`<br>`Client ID`: `YOUR_HUBSPOT_CLIENT_ID`<br>`Client Secret`: `YOUR_HUBSPOT_CLIENT_SECRET` |
| 4 | Continue to the provider and approve access. | Sign in to HubSpot and approve the requested scopes. |
| 5 | Copy the `connection key` from the connection card. | `MCP_OAUTH_HUBSPOT_PRODUCTION_D039F477` |

The callback URL and generated connection key depend on the Agent Studio deployment and connection name. Always copy the displayed values.

Agent Studio discovers the authorization endpoint, token endpoint, scopes, and supported client authentication method from the MCP server's OAuth metadata.

!!! note "Callback URL"
    The callback URL comes from the Agent Studio `NEXTAUTH_URL` setting. The provider must use the exact displayed value, including its scheme, host, port, and path.

## Use the connection

Pass the exact connection key to an MCP client that supports Xians OAuth connections. Do not derive the key from the display name.

For example, the HubSpot connection above can be used by a Prompt Defined Agent MCP entry:

```json
{
  "name": "hubspot",
  "url": "https://mcp.hubspot.com",
  "enabled": true,
  "transport": "streamableHttp",
  "authentication": {
    "type": "oauth",
    "connection": "MCP_OAUTH_HUBSPOT_PRODUCTION_D039F477"
  }
}
```

The connection belongs to the selected activation. An activation can have multiple named OAuth MCP connections. Use a dedicated automation account when the agent must act independently of a person.

## Credential storage

Client credentials, access tokens, and refresh tokens are stored as an activation-scoped Secret Vault entry. They are not returned by the Connections API or placed in agent Rules. Refreshed and rotated tokens are saved automatically.

Deleting the connection removes its saved OAuth credentials. Create a new connection to authorize it again.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Redirect URL mismatch | Register the exact callback URL shown in Agent Studio. |
| OAuth discovery fails | Confirm the MCP URL exposes OAuth protected-resource and authorization-server metadata. |
| Connection name is already used | Choose another name for this activation. |
| Agent does not load the connection | Copy the exact connection key and restart an agent worker that caches its configuration. |

To connect an external MCP client to Xians itself, see [Xians MCP](../server/xians-mcp.md). That is a separate direction of connection.
