# Slack Integration - Configuration Guide

This guide shows you how to connect a Slack workspace to a XiansAi agent activation.

## Prerequisites

- XiansAi Server running and accessible
- Admin API key
- Slack workspace with admin access
- Agent and activation already created in XiansAi

## Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Enter app name (e.g., "XiansAI Bot")
4. Select your workspace
5. Click **"Create App"**

## Step 2: Configure OAuth Scopes

1. In your app settings, go to **"OAuth & Permissions"**
2. Scroll to **"Scopes"** → **"Bot Token Scopes"**
3. Click **"Add an OAuth Scope"** and add these scopes:
   - `channels:history` - Read messages in channels
   - `channels:read` - View channel information
   - `chat:write` - Send messages
   - `im:history` - Read direct messages
   - `im:read` - View direct message information
   - `im:write` - Send direct messages
   - `app_mentions:read` - Read mentions of the bot
   - `users:read` - **Required** to fetch user profile information
   - `users:read.email` - **Required** to fetch user email addresses for participant identification

## Step 3: Install App to Workspace

1. Scroll up to **"OAuth Tokens for Your Workspace"**
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**
4. **Copy the "Bot User OAuth Token"** (starts with `xoxb-`)
   - Save this as `SLACK_BOT_TOKEN`

## Step 4: Get Signing Secret

1. Go to **"Basic Information"** in the left sidebar
2. Scroll to **"App Credentials"**
3. **Copy the "Signing Secret"**
   - Save this as `SLACK_SIGNING_SECRET`

## Step 5: Configure Outgoing Messages (Choose One)

**All options support bidirectional messaging** (Slack ↔ Agent). The difference is in features and flexibility.

For the agent to send messages back to Slack, choose ONE of these options:

### Option A: Bot Token (Recommended - Fully Bidirectional)

**Incoming:** ✅ Receives messages via Events API  
**Outgoing:** ✅ Sends via Slack Bot API (`chat.postMessage`)

**Advantages:**
- Supports message threading (replies in same thread)
- Can send to any channel dynamically
- More flexible features (reactions, file uploads, etc.)

**Already configured in Step 3** - you have the `SLACK_BOT_TOKEN`.

### Option B: Incoming Webhook (Simple - Bidirectional with Limitations)

**Incoming:** ✅ Receives messages via Events API  
**Outgoing:** ✅ Sends via Incoming Webhook POST

**Advantages:**
- Simpler setup
- No additional OAuth scopes needed

**Limitations:**
- Cannot reply in threads (posts as new message)
- Configured for one default channel

**Setup:**
1. Go to **"Incoming Webhooks"** in the left sidebar
2. Toggle **"Activate Incoming Webhooks"** to ON
3. Click **"Add New Webhook to Workspace"**
4. Select a channel (default for messages)
5. Click **"Allow"**
6. **Copy the Webhook URL** (starts with `https://hooks.slack.com/services/...`)
   - Save this as `SLACK_INCOMING_WEBHOOK`

### Option C: Both (Maximum Flexibility)

Configure both `botToken` and `incomingWebhookUrl`. The system will use the incoming webhook if available, otherwise falls back to bot API.

**Note:** For incoming messages, ALL options use the same mechanism (Events API + `signingSecret`). The choice only affects how outgoing messages are sent.

## Step 6: Create Integration via API

```bash
# Set variables
export BASE_URL="https://your-server.com"  # Or http://localhost:5001
export ADMIN_API_KEY="your-admin-api-key"
export TENANT_ID="your-tenant-id"
export AGENT_NAME="YourAgent"
export ACTIVATION_NAME="YourActivation"
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_SIGNING_SECRET="..."
export SLACK_INCOMING_WEBHOOK="https://hooks.slack.com/services/..."  # Optional

# Create integration (choose your configuration from Step 5)

# Option A: Bot Token only (recommended)
curl -X POST "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "platformId": "slack",
    "name": "My Slack Bot",
    "description": "Slack integration for my agent",
    "agentName": "'${AGENT_NAME}'",
    "activationName": "'${ACTIVATION_NAME}'",
    "configuration": {
      "signingSecret": "'${SLACK_SIGNING_SECRET}'",
      "botToken": "'${SLACK_BOT_TOKEN}'"
    },
    "mappingConfig": {
      "participantIdSource": "userEmail",
      "scopeSource": "channelId"
    },
    "isEnabled": true
  }'

# Option B: Incoming Webhook only (simpler, no threading)
curl -X POST "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "platformId": "slack",
    "name": "My Slack Bot",
    "description": "Slack integration for my agent",
    "agentName": "'${AGENT_NAME}'",
    "activationName": "'${ACTIVATION_NAME}'",
    "configuration": {
      "signingSecret": "'${SLACK_SIGNING_SECRET}'",
      "incomingWebhookUrl": "'${SLACK_INCOMING_WEBHOOK}'"
    },
    "mappingConfig": {
      "participantIdSource": "userEmail",
      "scopeSource": "channelId"
    },
    "isEnabled": true
  }'

# Option C: Both (maximum flexibility)
curl -X POST "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "platformId": "slack",
    "name": "My Slack Bot",
    "description": "Slack integration for my agent",
    "agentName": "'${AGENT_NAME}'",
    "activationName": "'${ACTIVATION_NAME}'",
    "configuration": {
      "signingSecret": "'${SLACK_SIGNING_SECRET}'",
      "botToken": "'${SLACK_BOT_TOKEN}'",
      "incomingWebhookUrl": "'${SLACK_INCOMING_WEBHOOK}'"
    },
    "mappingConfig": {
      "participantIdSource": "userEmail",
      "scopeSource": "channelId"
    },
    "isEnabled": true
  }'
```

**Response:**
```json
{
  "id": "65f8a3b2e9c1234567890abc",
  "webhookUrl": "https://your-server.com/api/apps/slack/events/65f8a3b2e9c1234567890abc/webhook-secret-xyz",
  ...
}
```

**Save the `webhookUrl` and `id`.**

## Step 7: Configure Slack Event Subscriptions

1. Go to your Slack App → **"Event Subscriptions"**
2. Toggle **"Enable Events"** to ON
3. In **"Request URL"**, paste the `webhookUrl` from Step 5
4. Wait for **"Verified ✓"** checkmark
5. Scroll to **"Subscribe to bot events"**
6. Click **"Add Bot User Event"** and add:
   - `message.channels`
   - `message.im`
   - `app_mention`
7. Click **"Save Changes"**
8. If prompted, **"Reinstall App"** to apply changes

## Step 8: Enable Direct Messages (Optional)

To allow users to DM the bot:

1. Go to **"App Home"** in the left sidebar
2. Scroll to **"Show Tabs"**
3. Check **"Allow users to send Slash commands and messages from the messages tab"**
4. Click **"Save Changes"**

## Step 9: Test the Integration

### Send a message in Slack:

**Option A: Direct Message**
1. Open Slack
2. Go to Apps section
3. Find your bot
4. Send a message: `Hello!`

**Option B: Channel Mention**
1. Invite bot to a channel: `/invite @YourBot`
2. Mention the bot: `@YourBot help me`

### Verify message was received:

```bash
curl "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/messaging/history?\
agentName=${AGENT_NAME}&\
activationName=${ACTIVATION_NAME}&\
participantId=U1234567890&\
page=1&\
pageSize=10" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

Replace `U1234567890` with the actual Slack user ID from the logs or Slack profile.

## Managing Integrations

### List all integrations

```bash
curl "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

### Get specific integration

```bash
export INTEGRATION_ID="65f8a3b2e9c1234567890abc"

curl "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

### Update integration

```bash
curl -X PUT "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description",
    "configuration": {
      "botToken": "new-token"
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

**Dynamic Options (from Slack event data):**
- **`userEmail`** (Recommended) - Use user's email address
  - Requires `users:read` and `users:read.email` scopes
  - Fetches email from Slack API (cached for performance)
  - Provides consistent, human-readable identification across workspaces
  - Falls back to `userId` if email cannot be fetched
  
- **`userId`** - Use Slack user ID
  - Example: "U1234567890"
  - No additional scopes required
  
- **`channelId`** - Use channel ID as participant
  - All messages in same channel share one participant ID
  - Useful for channel-based workflows
  
- **`threadId`** - Use thread timestamp as participant
  - Groups participants by conversation thread

**Fixed Value:**
- Set `participantIdSource` to `null` and use `defaultParticipantId`
  - Example: `"participantIdSource": null, "defaultParticipantId": "support-team"`
  - All messages will use "support-team" as the participant
  - Useful when treating all Slack users as a single participant

### Scope Mapping

Determines how to organize conversations:

**Dynamic Options (from Slack event data):**
- **`channelId`** (Recommended) - Group by Slack channel
  - Each channel gets its own scope
  - Example: "C1234567890"
  
- **`threadId`** - Group by thread
  - Each thread gets its own scope
  - Uses thread timestamp

**Fixed Value:**
- Set `scopeSource` to `null` and use `defaultScope`
  - Example: `"scopeSource": null, "defaultScope": "Slack"`
  - All messages will be grouped under "Slack" scope
  - Useful for grouping all Slack conversations together
  
- **`null` with no defaultScope** - No scope grouping
  - All messages share no specific scope

### Example Configurations:

**Dynamic Mapping (Recommended):**
```json
{
  "mappingConfig": {
    "participantIdSource": "userEmail",  // Each user identified by their email
    "scopeSource": "channelId"           // Conversations grouped by channel
  }
}
```

**Fixed Scope with Dynamic Participants:**
```json
{
  "mappingConfig": {
    "participantIdSource": "userId",     // Each user identified by Slack ID
    "scopeSource": null,                 // Use fixed scope
    "defaultScope": "Slack"              // All grouped under "Slack"
  }
}
```

**Fixed Participant with Dynamic Scope:**
```json
{
  "mappingConfig": {
    "participantIdSource": null,         // Use fixed participant
    "defaultParticipantId": "support-bot", // All messages from "support-bot"
    "scopeSource": "channelId"           // But grouped by channel
  }
}
```

**Fully Fixed (All messages together):**
```json
{
  "mappingConfig": {
    "participantIdSource": null,
    "defaultParticipantId": "slack-user",
    "scopeSource": null,
    "defaultScope": "slack-workspace"
  }
}
```

## Troubleshooting

### Integration created but Slack shows "Verification Failed"

- Ensure webhook URL is accessible from internet
- For local testing, use ngrok: `ngrok http 5001`
- Update Slack Request URL with ngrok HTTPS URL

### "Sending messages to this app has been turned off"

- Go to App Home → Enable Messages Tab
- Check "Allow users to send Slash commands and messages"
- Reinstall app

### Messages not arriving at agent

```bash
# Check integration is enabled
curl "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations/${INTEGRATION_ID}" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" | jq '.isEnabled'

# Should return: true
```

### Agent responses not appearing in Slack

- Verify **either** `botToken` **or** `incomingWebhookUrl` is configured
- Check server logs for "AppMessageRouterService started"
- Ensure agent activation is active
- If using incoming webhook, verify the URL is correct and not expired

### "Slack API returned error for user: missing_scope"

This error indicates missing OAuth scopes for fetching user information:

1. Go to your Slack App → **"OAuth & Permissions"**
2. Add the missing scopes under **"Bot Token Scopes"**:
   - `users:read`
   - `users:read.email`
3. Click **"Save Changes"**
4. **Important:** Reinstall the app to workspace to apply new scopes
5. The bot will now be able to fetch user emails for participant identification

**Note:** Without these scopes, the system will fall back to using Slack user IDs instead of email addresses.

## Local Testing with ngrok

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start tunnel
ngrok http 5001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update Slack Request URL:
# https://abc123.ngrok.io/api/apps/slack/events/{integrationId}/{webhookSecret}
```

## Outgoing Message Options Comparison

| Feature | Bot Token | Incoming Webhook |
|---------|-----------|------------------|
| **Bidirectional** | ✅ Yes | ✅ Yes |
| Receive from Slack | ✅ Events API | ✅ Events API |
| Send to Slack | ✅ Bot API | ✅ Webhook POST |
| Threading support | ✅ Yes | ❌ No |
| Dynamic channels | ✅ Yes | ❌ Default channel |
| User email fetching | ✅ Yes (if scopes added) | ✅ Yes (if scopes added) |
| Required scopes (basic) | `chat:write` | None |
| Required scopes (email) | `users:read`, `users:read.email` | `users:read`, `users:read.email` |
| Setup complexity | Medium | Simple |
| **Recommended for** | Production | Simple notifications |

**Note:** User email fetching requires:

1. Setting `participantIdSource: "userEmail"` in mapping configuration
2. Adding `users:read` and `users:read.email` scopes to the bot token
3. Reinstalling the app to apply new scopes

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
export SLACK_BOT_TOKEN="xoxb-your-token"
export SLACK_SIGNING_SECRET="your-secret"
export SLACK_INCOMING_WEBHOOK="https://hooks.slack.com/services/..."  # Optional

# Create integration with both options
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/admin/tenants/${TENANT_ID}/integrations" \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "platformId": "slack",
    "name": "Support Bot",
    "agentName": "'${AGENT_NAME}'",
    "activationName": "'${ACTIVATION_NAME}'",
    "configuration": {
      "signingSecret": "'${SLACK_SIGNING_SECRET}'",
      "botToken": "'${SLACK_BOT_TOKEN}'",
      "incomingWebhookUrl": "'${SLACK_INCOMING_WEBHOOK}'"
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
echo "Next: Configure this URL in Slack Event Subscriptions:"
echo "${WEBHOOK_URL}"
```

---

**Need Help?** Check server logs for detailed error messages and debugging information.
