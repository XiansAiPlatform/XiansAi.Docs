# Microsoft Teams Integration - Configuration Guide

This guide shows you how to connect Microsoft Teams to a XiansAi agent activation using the Bot Framework.

## Prerequisites

- XiansAi Server running and accessible from the internet (or use ngrok for local testing)
- Admin API key
- Azure account with permissions to create app registrations
- Microsoft Teams workspace
- Agent and activation already created in XiansAi

## Step 1: Create Azure Bot Resource

1. Go to https://portal.azure.com
2. Click **"Create a resource"**
3. Search for **"Azure Bot"**
4. Click **"Create"**
5. Fill in the details:
   - **Bot handle**: Unique name (e.g., "xiansai-bot")
   - **Subscription**: Select your subscription
   - **Resource group**: Create new or use existing
   - **Pricing tier**: Free (F0) for testing, S1 for production
   - **Type of App**: Choose **"Single Tenant"** (recommended for single organization)
   - **Microsoft App ID**: Select **"Create new Microsoft App ID"**
   - **App Tenant ID**: Will be auto-filled (important for single-tenant bots)
6. Click **"Create"**

## Step 2: Get App Credentials

### Required Credentials:

1. After deployment, go to your Azure Bot resource
2. Navigate to **"Configuration"** in the left sidebar
3. **Copy these values:**
   - **Microsoft App ID** (also called Application/Client ID)
     - Save as `TEAMS_APP_ID`
   - **App Tenant ID** (Directory/Tenant ID) 
     - Save as `TEAMS_APP_TENANT_ID`
     - **Critical for Single Tenant bots!**
   
4. Click on the **Microsoft App ID (Manage Passwords)** link to go to App Registrations
5. Click **"Certificates & secrets"**
6. Click **"New client secret"**
7. Add description (e.g., "XiansAI Bot Secret") and set expiration (24 months recommended)
8. **Copy the secret VALUE** (you can only see it once!)
   - Save this as `TEAMS_APP_PASSWORD`

### Add Permissions for Email Fetching

To use user emails as participant IDs:

1. In the App Registration, go to **"API permissions"**
2. Click **"Add a permission"**
3. Select **"Microsoft Graph"** → **"Application permissions"**
4. Search and add: **`User.Read.All`**
5. Click **"Grant admin consent for [Your Organization]"** ✅
   - This allows the bot to read user profiles including email addresses

## Step 3: Create Integration via API

**Important:** For Single Tenant bots, you MUST include the `appTenantId` or authentication will fail!

### Option A: With Email-Based Participant ID (Recommended)

```bash
# Set variables
export BASE_URL="https://your-server.com"  # Or http://localhost:5005
export ADMIN_API_KEY="your-admin-api-key"
export TENANT_ID="your-tenant-id"
export AGENT_NAME="YourAgent"
export ACTIVATION_NAME="YourActivation"
export TEAMS_APP_ID="5d29f94e-55e5-4f66-8f8d-e96ed1493650"
export TEAMS_APP_PASSWORD="your-secret-value"
export TEAMS_APP_TENANT_ID="d607b82b-6bff-400d-af64-8e7ab2e8a004"

# Create integration
curl -X POST "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "platformId": "msteams",
    "name": "My Teams Bot",
    "description": "Teams integration for my agent",
    "agentName": "'${AGENT_NAME}'",
    "activationName": "'${ACTIVATION_NAME}'",
    "configuration": {
      "appId": "'${TEAMS_APP_ID}'",
      "appPassword": "'${TEAMS_APP_PASSWORD}'",
      "appTenantId": "'${TEAMS_APP_TENANT_ID}'"
    },
    "mappingConfig": {
      "participantIdSource": "userEmail",
      "scopeSource": "channelId"
    },
    "isEnabled": true
  }'
```

### Option B: Simple Setup (User ID)

```bash
# Create integration without email fetching
curl -X POST "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "platformId": "msteams",
    "name": "My Teams Bot",
    "description": "Teams integration for my agent",
    "agentName": "'${AGENT_NAME}'",
    "activationName": "'${ACTIVATION_NAME}'",
    "configuration": {
      "appId": "'${TEAMS_APP_ID}'",
      "appPassword": "'${TEAMS_APP_PASSWORD}'",
      "appTenantId": "'${TEAMS_APP_TENANT_ID}'"
    },
    "mappingConfig": {
      "participantIdSource": "userId",
      "scopeSource": "channelId"
    },
    "isEnabled": true
  }'
```

**Response:**
```json
{
  "id": "65f8a3b2e9c1234567890def",
  "webhookUrl": "https://your-server.com/api/apps/msteams/events/65f8a3b2e9c1234567890def/webhook-secret-xyz",
  ...
}
```

**Save the `webhookUrl` and `id`.**

## Step 4: Configure Azure Bot Messaging Endpoint

1. Go back to your Azure Bot resource
2. Navigate to **"Configuration"**
3. In **"Messaging endpoint"**, paste the `webhookUrl` from Step 3
4. Click **"Apply"**

## Step 5: Add Teams Channel

1. In your Azure Bot, navigate to **"Channels"**
2. Click on **"Microsoft Teams"** icon
3. Click **"Apply"**
4. Teams channel will be added and enabled

## Step 6: Install Bot to Teams

### Option A: Via App Studio (Recommended)

1. Open Microsoft Teams
2. Go to **Apps** → Search for **"App Studio"** or **"Developer Portal"**
3. Install App Studio if not already installed
4. Open **App Studio**
5. Click **"Create a new app"**
6. Fill in app details:
   - **Short name**: Your bot name
   - **App ID**: Use the `TEAMS_APP_ID` from Step 2
   - **Package name**: Unique identifier
   - **Version**: 1.0.0
   - **Short description**: Bot description
   - **Full description**: Detailed description
7. Go to **"Capabilities"** → **"Bots"**
8. Click **"Set up"**
9. Select **"Existing bot"**
10. Enter your **Bot ID** (same as `TEAMS_APP_ID`)
11. Select scopes:
    - ✅ Personal
    - ✅ Team
    - ✅ Group Chat
12. Click **"Save"**
13. Click on 'App package editor' and fix any issues in Manifest.json
14. Go to **"Test and distribute"**
15. Click **"Install"** to add to your team

### Option B: Direct Installation Link

Use the Azure Bot's Teams channel installation link provided in the Azure portal.

## Step 7: Test the Integration

### Send a message in Teams:

**Option A: Direct Chat**
1. Open Teams
2. Go to Chat
3. Find your bot
4. Send a message: `Hello!`

**Option B: Team Channel**
1. Add the bot to a team channel
2. Mention the bot: `@YourBot help me`

### Verify message was received:

```bash
curl "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/messaging/history?\
agentName=${AGENT_NAME}&\
activationName=${ACTIVATION_NAME}&\
participantId=USER-ID&\
page=1&\
pageSize=10" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

## Managing Integrations

### List all integrations

```bash
curl "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

### Get Teams integrations only

```bash
curl "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations?platformId=msteams" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

### Update integration

```bash
export INTEGRATION_ID="65f8a3b2e9c1234567890def"

curl -X PUT "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description",
    "configuration": {
      "appPassword": "new-password"
    }
  }'
```

### Disable integration

```bash
curl -X POST "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}/disable" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

### Enable integration

```bash
curl -X POST "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}/enable" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

### Delete integration

```bash
curl -X DELETE "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

### Test integration configuration

```bash
curl -X POST "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}/test" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

## Configuration Options

### Participant ID Mapping

Determines how to identify users in XiansAi:

**Dynamic Options (from Teams event data):**
- **`userEmail`** (Recommended) - Use user's email address
  - Requires `User.Read.All` Graph API permission
  - Fetches email from Microsoft Graph (cached for performance)
  - Provides human-readable, consistent identification
  - Falls back to `userId` if email unavailable
  - Example: `user@company.com`
  
- **`userId`** - Use Teams user ID (Azure AD Object ID)
  - No additional permissions required
  - Example: `586616ac-f9d7-4626-9d91-205f2310cfdd`
  
- **`channelId`** - Use Teams channel ID
  - All messages in same channel share one participant ID
  - Useful for channel-based workflows

**Fixed Value:**
- Set `participantIdSource` to `null` and use `defaultParticipantId`
  - Example: `"participantIdSource": null, "defaultParticipantId": "teams-support"`
  - All messages will use "teams-support" as the participant

### Scope Mapping

Determines how to organize conversations:

**Dynamic Options (from Teams event data):**

- **`conversationId`** (Recommended) - Use unique conversation ID
  - Works for **both** personal chats and channel conversations
  - Each conversation (whether 1:1 or channel) gets its own scope
  - Best choice for most use cases
  
- **`conversationType`** - Group by conversation type
  - Returns "personal" for direct messages or "channel" for team channels
  - Useful for separating personal vs. team conversations
  
- **`channelId`** - Group by Teams channel ID
  - ⚠️ **Only works for channel conversations** (returns null for personal chats)
  - Use with `defaultScope` as fallback for personal chats
  - Example: `"scopeSource": "channelId", "defaultScope": "personal"`
  
- **`teamId`** - Group by Teams team ID
  - ⚠️ **Only works for team channels** (returns null for personal chats)
  - Use with `defaultScope` as fallback

- **`channelName`** - Use channel display name
  - Only works for team channels

**Fixed Value:**
- Set `scopeSource` to `null` and use `defaultScope`
  - Example: `"scopeSource": null, "defaultScope": "Teams"`
  - All messages grouped under "Teams" scope

**Automatic Fallback:**
- If the specified `scopeSource` returns null/empty (e.g., using "channelId" in a personal chat), the system automatically falls back to `defaultScope`
- Debug logs will show: `"Scope source 'channelId' returned null/empty, using DefaultScope"`

### Example Configurations:

**Recommended: Email + Conversation ID (Works for all chat types):**
```json
{
  "mappingConfig": {
    "participantIdSource": "userEmail",
    "scopeSource": "conversationId"
  }
}
```

**Separate Personal vs. Channel Chats:**
```json
{
  "mappingConfig": {
    "participantIdSource": "userEmail",
    "scopeSource": "conversationType"
  }
}
```
- Personal chats → scope: "personal"
- Channel messages → scope: "channel"

**Channel ID with Fallback for Personal Chats:**
```json
{
  "mappingConfig": {
    "participantIdSource": "userEmail",
    "scopeSource": "channelId",
    "defaultScope": "personal"
  }
}
```
- Channel messages → scope: actual channel ID
- Personal chats → scope: "personal" (fallback)

**Fixed Scope for All Teams Conversations:**
```json
{
  "mappingConfig": {
    "participantIdSource": "userEmail",
    "scopeSource": null,
    "defaultScope": "Microsoft Teams"
  }
}
```

**Single Bot Participant:**
```json
{
  "mappingConfig": {
    "participantIdSource": null,
    "defaultParticipantId": "teams-bot",
    "scopeSource": "conversationId"
  }
}
```

## Features Comparison

| Feature | Supported |
|---------|-----------|
| **Bidirectional messaging** | ✅ Yes |
| Receive messages | ✅ Bot Framework |
| Send messages | ✅ Bot Framework API |
| Threading support | ✅ Yes (replyToId) |
| Rich messages | ✅ Adaptive Cards |
| Direct messages | ✅ Yes |
| Channel messages | ✅ Yes |
| Group chats | ✅ Yes |

## Troubleshooting

### Integration created but verification fails

- **Ensure messaging endpoint is accessible from internet**
  - Azure Bot must be able to reach your server
  - Test URL accessibility: `curl https://your-server.com/health`
- **For local testing, use ngrok:**
  ```bash
  ngrok http 5005
  # Use the HTTPS URL: https://abc123.ngrok-free.app
  ```
- **Update Azure Bot messaging endpoint:**
  - Must use the events endpoint: `/api/apps/msteams/events/{integrationId}/{webhookSecret}`
  - Correct: `https://your-server.com/api/apps/msteams/events/123456/webhook-secret-xyz`

### Authentication Error: "Application not found in directory"

**Error:** `AADSTS700016: Application with identifier 'xxx' was not found in the directory 'Bot Framework'`

**Solution:** Add `appTenantId` to your configuration:

```bash
curl -X PUT "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "appId": "your-app-id",
      "appPassword": "your-password",
      "appTenantId": "d607b82b-6bff-400d-af64-8e7ab2e8a004"
    }
  }'
```

**Why:** Single Tenant bots must authenticate against their specific tenant, not the generic "botframework.com" tenant.

### "The 'Activity.From' field is required"

**Error:** When bot tries to send messages back to Teams

**Solution:** This was fixed in recent updates. Make sure you're running the latest version. The response now includes:
- `from` - Bot account
- `recipient` - User account  
- `conversation` - Conversation context
- `replyToId` - For threading

### Messages not arriving at agent

```bash
# Check integration is enabled
curl "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" | jq '.isEnabled'

# Should return: true

# Check server logs for:
# - "Processing Teams activity: Type=message"
# - "Sending Teams message to workflow"
```

### Agent responses not appearing in Teams

- **Verify credentials:**
  ```bash
  # Check configuration
  curl "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}" \
    -H "Authorization: Bearer ${ADMIN_API_KEY}" | jq '.configuration'
  ```
- **Check server logs for:**
  - "AppMessageRouterService started"
  - "Successfully sent message to Teams"
  - Any errors about missing fields or authentication
- **Verify app credentials haven't expired:**
  - Client secrets expire (check Azure Portal)
  - Set calendar reminders before expiration

### "Failed to get Bot Framework token"

**Common causes:**
1. Wrong `appId` or `appPassword`
2. Client secret expired
3. Missing `appTenantId` for Single Tenant bots

**Check:**
```bash
# In Azure Portal:
# 1. App Registrations → Your App → Certificates & secrets
# 2. Verify secret hasn't expired
# 3. If expired, create new secret and update integration
```

### Missing User Email / "User.Read.All" Permission Error

**Error:** Cannot fetch user email for participant ID

**Solution:**
1. Go to Azure Portal → App Registrations → Your App
2. Click **API permissions**
3. Add **Microsoft Graph** → **Application permissions** → **`User.Read.All`**
4. Click **"Grant admin consent"** (requires admin)
5. Wait a few minutes for permissions to propagate

**Fallback:** If you can't get admin consent, use `"participantIdSource": "userId"` instead

### Duplicate Webhook Calls (3 messages for 1 user message)

This is normal Teams behavior! Teams sends multiple activity types:
- `message` - The actual user message
- `typing` - Typing indicator
- `conversationUpdate` - Conversation state changes

The handler filters these automatically and only processes actual `message` activities.

### Scope is null in messages

**Issue:** Messages are being saved with `scope: null` even though you configured `scopeSource`

**Common causes:**
1. Using `scopeSource: "channelId"` for **personal chats**
   - Personal chats don't have a channel ID
   - Only team channel conversations have channel IDs

**Solutions:**

**Option 1 - Use conversationId (Recommended):**
```json
{
  "mappingConfig": {
    "scopeSource": "conversationId"
  }
}
```
Works for both personal chats and channel conversations.

**Option 2 - Add a defaultScope fallback:**
```json
{
  "mappingConfig": {
    "scopeSource": "channelId",
    "defaultScope": "personal"
  }
}
```
Channel messages will have the channel ID as scope, personal chats will use "personal".

**Option 3 - Use conversationType:**
```json
{
  "mappingConfig": {
    "scopeSource": "conversationType"
  }
}
```
Automatically sets scope to "personal" or "channel".

**Check debug logs:**
When scope extraction fails, you'll see:
```
Scope source 'channelId' returned null/empty for Teams activity, using DefaultScope: personal
```

### Local Development Tips

**Using ngrok:**
```bash
# Start ngrok
ngrok http 5005

# Get HTTPS URL (e.g., https://abc123.ngrok-free.app)
# Update Azure Bot messaging endpoint:
https://abc123.ngrok-free.app/api/apps/msteams/events/69844c3a866169583533bd36/webhook-secret

# Note: ngrok free URLs change on restart
# Consider ngrok paid plan for stable URLs
```

**Hot reload issues:**
- Clear Teams app cache if bot doesn't respond
- Reinstall bot in Teams after configuration changes
- Check that ngrok tunnel is still active

## Local Testing with ngrok

```bash
# Install ngrok
brew install ngrok  # macOS

# Start tunnel
ngrok http 5001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update Azure Bot messaging endpoint:
# https://abc123.ngrok.io/api/apps/msteams/events/{integrationId}/{webhookSecret}
```

## Bot Type Comparison

| Feature | Single Tenant | Multi-Tenant |
|---------|---------------|--------------|
| **Use Case** | One organization only | Multiple organizations |
| **appTenantId Required** | ✅ Yes | ❌ No (uses "botframework.com") |
| **Setup Complexity** | Simple | More complex |
| **Azure AD Permissions** | Organization-specific | Requires admin consent per org |
| **Recommended For** | Most deployments | SaaS products |

## Complete Example Script

```bash
#!/bin/bash
set -e

# Configuration
export BASE_URL="https://your-server.com"
export ADMIN_API_KEY="your-admin-api-key"
export TENANT_ID="my-tenant"
export AGENT_NAME="SupportAgent"
export ACTIVATION_NAME="LiveSupport"
export TEAMS_APP_ID="5d29f94e-55e5-4f66-8f8d-e96ed1493650"
export TEAMS_APP_PASSWORD="your-secret-value"
export TEAMS_APP_TENANT_ID="d607b82b-6bff-400d-af64-8e7ab2e8a004"

# Create integration with email-based participant ID
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "platformId": "msteams",
    "name": "Support Bot",
    "agentName": "'${AGENT_NAME}'",
    "activationName": "'${ACTIVATION_NAME}'",
    "configuration": {
      "appId": "'${TEAMS_APP_ID}'",
      "appPassword": "'${TEAMS_APP_PASSWORD}'",
      "appTenantId": "'${TEAMS_APP_TENANT_ID}'"
    },
    "mappingConfig": {
      "participantIdSource": "userEmail",
      "scopeSource": "channelId"
    },
    "isEnabled": true
  }')

# Extract webhook URL
WEBHOOK_URL=$(echo $RESPONSE | jq -r '.webhookUrl')
INTEGRATION_ID=$(echo $RESPONSE | jq -r '.id')

echo "✅ Integration Created!"
echo "Integration ID: ${INTEGRATION_ID}"
echo ""
echo "⚠️  IMPORTANT: Configure this URL in Azure Bot messaging endpoint:"
echo "${WEBHOOK_URL}"
echo ""
echo "Steps:"
echo "1. Go to Azure Portal → Your Azure Bot → Configuration"
echo "2. Set Messaging endpoint to: ${WEBHOOK_URL}"
echo "3. Click 'Apply'"
echo "4. Add Teams channel if not already added"
echo "5. Install bot in Teams"
```

## Important Notes

### Security & Credentials
- **App passwords/secrets expire** - Set calendar reminders to rotate them before expiration
- **Never commit secrets** to version control
- **Use environment variables** for sensitive configuration
- **Rotate secrets regularly** (recommended: every 12-24 months)

### Technical Details
- **Service URL varies** by region - it's extracted from incoming activities automatically
- **Webhook URL format** - Must use `/api/apps/msteams/events/{integrationId}/{webhookSecret}`
- **Bot Framework authentication** - Uses JWT tokens validated against Azure AD
- **User info caching** - Email lookups are cached in-memory for performance

### Advanced Features
- **Adaptive Cards** - System supports sending rich Adaptive Cards via message data
- **Threading support** - Responses use `replyToId` to maintain conversation threads
- **Auto-preservation** - Origin and metadata are automatically preserved in messages
- **Bidirectional messaging** - Full support for receiving and sending messages

### Data Privacy
- **User emails** - Cached in application memory, not persisted to database
- **Message metadata** - Includes user IDs, channel IDs, and conversation context
- **Graph API calls** - Only made when `participantIdSource` is set to `userEmail`

## Quick Reference

### Required Configuration Values
| Field | Example | Where to Find |
|-------|---------|---------------|
| `appId` | `5d29f94e-55e5-4f66-8f8d-e96ed1493650` | Azure Bot → Configuration → Microsoft App ID |
| `appPassword` | `your-secret-value` | App Registration → Certificates & secrets |
| `appTenantId` | `d607b82b-6bff-400d-af64-8e7ab2e8a004` | Azure Bot → Configuration → App Tenant ID |

### Common URLs
- **Azure Portal**: https://portal.azure.com
- **Bot Framework Portal**: https://dev.botframework.com
- **Teams Developer Portal**: https://dev.teams.microsoft.com
- **Graph Explorer** (testing): https://developer.microsoft.com/graph/graph-explorer

---

**Need Help?** 
- Check server logs for detailed error messages
- Use `LogLevel: Debug` for verbose Teams activity logging
- Review troubleshooting section above for common issues
- Verify webhook URL format matches: `/api/apps/msteams/events/{integrationId}/{webhookSecret}`
