# Webhooks

## Event-Driven AI Integration

Your agents need to **react to the real world**. When a customer makes a purchase, when code gets pushed, when a support ticket arrives—webhooks let your AI respond instantly to external events and notify other systems when work is done.

## The Integration Problem

**Polling (The Old Way):**
```
Every 5 minutes: "Any new orders?" → 🔍 Check API
"Any new tickets?" → 🔍 Check API
"Any new payments?" → 🔍 Check API

Slow. Inefficient. Delayed responses.
```

**Webhooks (The Modern Way):**
```
Order created → Webhook fires → Agent processes immediately
Ticket opened → Webhook fires → Agent responds in seconds
Payment received → Webhook fires → Workflow starts instantly

Fast. Efficient. Real-time.
```

## Why Webhooks Transform AI Development

### The Challenge: AI Agents Living in a Vacuum
Agents are powerful, but they need to connect with the outside world:
- React to events from other systems (Stripe, GitHub, Salesforce)
- Notify external services when work completes
- Integrate with existing tools and workflows

### The Solution: Event-Driven Architecture
Webhooks provide:
- **Instant Reactions**: Trigger agents the moment something happens
- **Bi-Directional Integration**: Receive events AND send notifications
- **Loose Coupling**: Integrate without tight API dependencies
- **Scalability**: Handle thousands of events per second

## Core Concepts

### Inbound Webhooks: React to External Events

```typescript
// Listen for Stripe payment events
const webhook = await xians.createInboundWebhook({
  name: "stripe-payments",
  endpoint: "/webhooks/stripe",
  
  // Secure it
  secret: process.env.STRIPE_WEBHOOK_SECRET,
  
  // Route to workflow
  handler: "PaymentProcessingWorkflow"
});

// Now when Stripe sends payment.succeeded →
// Your workflow automatically processes the order
```

### Outbound Webhooks: Notify External Systems

```typescript
// Notify Slack when agent fails
const webhook = await xians.createOutboundWebhook({
  name: "slack-alerts",
  url: process.env.SLACK_WEBHOOK_URL,
  
  // Which events trigger this
  events: ["agent.error", "workflow.failed"],
  
  // Transform for Slack format
  transform: (event) => ({
    text: `🚨 ${event.type}: ${event.message}`
  })
});
```

## Quick Start

### Receive GitHub Webhooks

```typescript
const githubWebhook = await xians.createInboundWebhook({
  name: "github-events",
  endpoint: "/webhooks/github",
  
  // GitHub signature verification
  authentication: {
    type: "signature",
    header: "X-Hub-Signature-256",
    secret: process.env.GITHUB_WEBHOOK_SECRET
  },
  
  // Process with AI agent
  handler: async (event) => {
    if (event.type === "pull_request") {
      // AI reviews the PR
      await codeReviewAgent.analyze({
        repo: event.repository,
        pr: event.pull_request
      });
    }
    
    if (event.type === "issue") {
      // AI triages the issue
      await issueTriageAgent.process({
        issue: event.issue
      });
    }
  }
});
```

### Send to External System

```typescript
// Notify your CRM when lead is qualified
const crmWebhook = await xians.createOutboundWebhook({
  name: "crm-integration",
  url: "https://api.yourcrm.com/leads",
  
  events: ["agent.lead-qualified"],
  
  headers: {
    "Authorization": `Bearer ${process.env.CRM_API_KEY}`,
    "Content-Type": "application/json"
  },
  
  transform: (event) => ({
    name: event.data.leadName,
    email: event.data.leadEmail,
    score: event.data.qualificationScore,
    source: "ai-agent",
    notes: event.data.agentNotes
  })
});
```

## Why This Changes AI Development

### Before Webhooks: Manual Polling

```javascript
// Check for new orders every minute (expensive, slow)
setInterval(async () => {
  const newOrders = await fetch('https://api.ecommerce.com/orders?new=true');
  
  for (const order of newOrders) {
    // Process each order
    await processOrder(order);
  }
}, 60000);  // 60 API calls per hour, always running
```

### With Webhooks: Event-Driven

```typescript
// Receive order immediately when created
const webhook = await xians.createInboundWebhook({
  name: "new-orders",
  endpoint: "/webhooks/orders",
  
  handler: async (order) => {
    // Process immediately, only when order exists
    await orderProcessingAgent.handle(order);
  }
});

// 0 API calls when idle, instant response when order arrives
```

## Webhook Patterns That Matter

### Pattern 1: Trigger Workflows from External Events

```typescript
const webhook = await xians.createInboundWebhook({
  name: "customer-signup",
  endpoint: "/webhooks/signup",
  
  handler: async (event) => {
    // New signup triggers multi-step onboarding
    await xians.startWorkflow({
      name: "CustomerOnboardingWorkflow",
      input: {
        customerId: event.data.userId,
        email: event.data.email,
        plan: event.data.selectedPlan
      }
    });
  }
});
```

### Pattern 2: Chain Systems Together

```typescript
// 1. Stripe payment received
const stripeWebhook = await xians.createInboundWebhook({
  name: "stripe-events",
  endpoint: "/webhooks/stripe",
  
  handler: async (event) => {
    if (event.type === "payment.succeeded") {
      // 2. Provision account
      await provisioningAgent.create({
        customerId: event.data.customer
      });
      
      // 3. Send to CRM (outbound webhook)
      await xians.emitWebhookEvent({
        type: "customer.provisioned",
        data: event.data
      });
    }
  }
});

// 4. CRM receives update via outbound webhook
const crmWebhook = await xians.createOutboundWebhook({
  name: "crm-sync",
  url: "https://crm.company.com/api/customers",
  events: ["customer.provisioned"]
});
```

### Pattern 3: Human-in-the-Loop via Webhooks

```typescript
const approvalWebhook = await xians.createInboundWebhook({
  name: "approvals",
  endpoint: "/webhooks/approvals",
  
  handler: async (event) => {
    if (event.action === "approved") {
      // Resume waiting workflow
      await xians.resumeWorkflow({
        executionId: event.workflowId,
        decision: "approved"
      });
    }
  }
});
```

## Real-World Examples

### Customer Support Automation

```typescript
// Zendesk ticket created → AI agent responds
const supportWebhook = await xians.createInboundWebhook({
  name: "zendesk-tickets",
  endpoint: "/webhooks/zendesk",
  
  handler: async (event) => {
    const ticket = event.data.ticket;
    
    // AI agent analyzes and responds
    const response = await supportAgent.chat({
      message: ticket.description,
      context: {
        customerId: ticket.requester_id,
        priority: ticket.priority
      }
    });
    
    // If AI can't handle it, escalate
    if (response.confidence < 0.8) {
      await escalateToHuman(ticket);
    } else {
      // Post response back to Zendesk
      await zendesk.updateTicket(ticket.id, {
        comment: response.message,
        status: response.resolved ? "solved" : "pending"
      });
    }
  }
});
```

### E-Commerce Order Processing

```typescript
// Shopify order → AI processes and fulfills
const orderWebhook = await xians.createInboundWebhook({
  name: "shopify-orders",
  endpoint: "/webhooks/shopify/orders",
  
  authentication: {
    type: "signature",
    header: "X-Shopify-Hmac-SHA256",
    secret: process.env.SHOPIFY_SECRET
  },
  
  handler: "OrderFulfillmentWorkflow"
});

// The workflow:
const workflow = await xians.createWorkflow({
  name: "OrderFulfillmentWorkflow",
  steps: [
    { 
      id: "validate",
      agent: "FraudDetectionAgent",
      input: "{{order}}"
    },
    {
      id: "inventory",
      agent: "InventoryAgent",
      condition: "{{validate.approved}}"
    },
    {
      id: "ship",
      agent: "ShippingAgent",
      dependsOn: ["inventory"]
    },
    {
      id: "notify",
      agent: "CustomerNotificationAgent",
      dependsOn: ["ship"]
    }
  ]
});
```

## Webhook Security

### Always Verify Signatures

```typescript
const webhook = await xians.createInboundWebhook({
  name: "secure-webhook",
  endpoint: "/webhooks/secure",
  
  // Verify signature automatically
  authentication: {
    type: "signature",
    algorithm: "sha256",
    header: "X-Webhook-Signature",
    secret: process.env.WEBHOOK_SECRET
  }
});

// Xians verifies every request before calling handler
// Invalid signatures are automatically rejected
```

### Use HTTPS Always

```typescript
// Good
url: "https://api.yourapp.com/webhooks"

// Bad - never use HTTP for webhooks
url: "http://api.yourapp.com/webhooks"  // ❌ Insecure
```

### IP Allowlisting

```typescript
const restrictedWebhook = await xians.createInboundWebhook({
  name: "internal-only",
  endpoint: "/webhooks/internal",
  
  // Only accept from these IPs
  ipAllowlist: [
    "192.168.1.0/24",      // Internal network
    "203.0.113.0/24"       // Partner network
  ]
});
```

## Webhook Reliability

### Automatic Retries

```typescript
const webhook = await xians.createOutboundWebhook({
  name: "critical-notifications",
  url: "https://api.partner.com/events",
  events: ["order.completed"],
  
  // Retry on failure
  retry: {
    maxAttempts: 5,
    backoff: "exponential",      // 1s, 2s, 4s, 8s, 16s
    retryableStatuses: [408, 429, 500, 502, 503, 504]
  }
});
```

### Dead Letter Queue

```typescript
const webhook = await xians.createOutboundWebhook({
  name: "with-dlq",
  url: "https://api.external.com/webhook",
  
  // After all retries fail
  onFailure: {
    action: "dlq",  // Send to dead letter queue
    alert: ["ops@company.com"]
  }
});

// Later, replay failed webhooks
const failed = await xians.getFailedWebhooks("with-dlq");
await xians.replayWebhooks(failed);
```

## Monitoring Webhooks

### Track Everything

```typescript
const metrics = await webhook.getMetrics({
  period: "24h"
});

console.log({
  totalRequests: metrics.count,
  successRate: `${metrics.successRate}%`,
  avgLatency: `${metrics.avgLatency}ms`,
  failureRate: `${metrics.failureRate}%`,
  lastError: metrics.lastError
});
```

### Alert on Failures

```typescript
const webhook = await xians.createOutboundWebhook({
  name: "monitored-webhook",
  url: "https://api.critical-service.com/events",
  
  monitoring: {
    alertOn: {
      failureRate: ">5%",      // Alert if >5% fail
      latency: ">2s",           // Alert if slow
      consecutive: 3            // Alert after 3 consecutive failures
    },
    notifyChannels: ["email", "slack"],
    recipients: ["oncall@company.com"]
  }
});
```

## Best Practices

**✅ Idempotent Handlers**
```typescript
// Store webhook IDs to prevent duplicate processing
handler: async (event) => {
  const alreadyProcessed = await db.exists("webhook_id", event.id);
  if (alreadyProcessed) return { status: "duplicate" };
  
  await processEvent(event);
  await db.save("webhook_id", event.id);
}
```

**✅ Fast Response, Async Processing**
```typescript
handler: async (event) => {
  // Queue for background processing
  await queue.add("process-webhook", event);
  
  // Respond quickly (< 3 seconds)
  return { status: "accepted" };
}
```

**✅ Log Everything**
```typescript
handler: async (event) => {
  console.log("Webhook received:", {
    id: event.id,
    type: event.type,
    timestamp: new Date()
  });
  
  try {
    await processEvent(event);
  } catch (error) {
    console.error("Webhook processing failed:", error);
    throw error;  // Will trigger retry
  }
}
```

**❌ Don't Block**
Never do slow operations in webhook handler. Queue them.

**❌ Don't Ignore Failures**
Always monitor and alert on webhook failures.

## Integration Points

Webhooks connect everything:

- **[Workflows](workflows.md)**: Trigger complex processes from external events
- **[Agents](agents.md)**: Invoke agents based on real-world events
- **Schedules**: Use schedules for time-based, webhooks for event-based
- **[Messages](messages.md)**: Create message threads from webhook events

---

**The Bottom Line**: Webhooks make your AI agents reactive to the real world. They're the bridge between your intelligent agents and the events that should trigger them—instantly, reliably, at scale.
