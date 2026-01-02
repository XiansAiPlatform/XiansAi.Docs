# Tenants

## Multi-Tenancy Made Simple

Building a SaaS AI application? You need to serve multiple customers on the same platform without their data, agents, or costs bleeding together. That's where **tenants** come in—complete isolation for each customer, all on one infrastructure.

## The SaaS Challenge

**Without Multi-Tenancy:**
```
Deploy separate infrastructure for each customer
→ 10 customers = 10 servers + 10 databases + 10 deployments
→ Operations nightmare + massive costs
```

**With Tenants:**
```
One platform, perfect isolation
→ 1,000 customers on shared infrastructure
→ Each sees only their data and agents
→ Cost efficiency + operational simplicity
```

## Why Tenants Matter for AI Development

### The Problem: Shared Infrastructure, Isolated Data
When you're building AI agents as a service, you need:
- **Complete data isolation** (Customer A never sees Customer B's data)
- **Resource boundaries** (One customer can't exhaust resources)
- **Custom configurations** (Different models, prompts, permissions per customer)
- **Cost tracking** (Know exactly what each customer costs)

### The Solution: Tenant Architecture
Tenants provide secure, isolated environments where each customer gets their own:
- Agents and workflows
- Knowledge bases and documents
- Message threads and history
- Usage metrics and billing
- Custom configurations

## Core Concepts

### What's a Tenant?

```typescript
{
  id: "tenant_acme_corp",
  name: "ACME Corporation",
  
  // Isolation
  dataRegion: "us-east-1",
  encryptionKey: "tenant-specific-key",
  
  // Configuration
  settings: {
    defaultModel: "gpt-4",
    allowedModels: ["gpt-4", "gpt-4-turbo"],
    features: ["workflows", "knowledge-base", "webhooks"]
  },
  
  // Resource Limits
  limits: {
    maxAgents: 50,
    maxUsers: 100,
    maxAPICallsPerDay: 10000,
    storageGB: 500
  },
  
  // Billing
  billing: {
    plan: "enterprise",
    usageTracking: true
  }
}
```

### Perfect Isolation

```
Platform
├── Tenant: Acme Corp
│   ├── Agents: [Sales Agent, Support Agent]
│   ├── Knowledge: [Product Docs, Policies]
│   ├── Users: [john@acme.com, jane@acme.com]
│   └── Data: Completely isolated
│
├── Tenant: StartupXYZ
│   ├── Agents: [AI Assistant]
│   ├── Knowledge: [Help Center]
│   ├── Users: [founder@startupxyz.com]
│   └── Data: Completely isolated
│
└── Tenant: BigEnterprise
    ├── Agents: [100+ specialized agents]
    ├── Knowledge: [Massive knowledge bases]
    ├── Users: [1000+ employees]
    └── Data: Completely isolated
```

## Quick Start

### Creating a Tenant

```typescript
const tenant = await xians.createTenant({
  name: "acme-corp",
  displayName: "ACME Corporation",
  
  // Configuration
  settings: {
    region: "us-east-1",
    defaultModel: "gpt-4",
    features: ["workflows", "knowledge-base"]
  },
  
  // Resource boundaries
  limits: {
    maxAgents: 50,
    maxAPICallsPerDay: 10000
  }
});
```

### Working in Tenant Context

```typescript
// Switch to tenant context
const acmeTenant = xians.tenant("acme-corp");

// Everything scoped to this tenant
const agent = await acmeTenant.createAgent({
  name: "SupportAgent"
});

const kb = await acmeTenant.createKnowledgeBase({
  name: "product-docs"
});

// Another tenant - completely isolated
const xyzTenant = xians.tenant("startup-xyz");
const xyzAgent = await xyzTenant.createAgent({
  name: "CustomerAgent"
});
```

## Why This Changes AI SaaS Development

### Traditional Approach: Deploy Per Customer
```
Customer signs up
→ Provision new infrastructure
→ Deploy new instances
→ Configure databases
→ Set up monitoring
→ Days of work, high costs
```

### Tenant Approach: Instant Provisioning
```typescript
// Customer signs up
const tenant = await xians.createTenant({
  name: customer.slug,
  settings: { plan: "starter" }
});

// Done. Ready to use.
// They have a complete, isolated AI platform.
```

## Tenant Isolation Guarantees

### Data Isolation

```typescript
// Queries automatically scoped to tenant
const acmeTenant = xians.tenant("acme-corp");

// This ONLY sees ACME's data
const conversations = await acmeTenant.getThreads();
const documents = await acmeTenant.documentDB.find("customers");

// Physically impossible to access other tenants' data
```

### Resource Isolation

```typescript
// Limits enforced automatically
const tenant = await xians.createTenant({
  name: "startup",
  limits: {
    maxAPICallsPerDay: 1000,
    maxAgents: 5,
    storageGB: 10
  }
});

// If they exceed limits
await tenant.createAgent({ name: "6th agent" });
// Error: Tenant limit reached. Max 5 agents allowed.
```

### Cost Isolation

```typescript
// Track exactly what each tenant costs
const usage = await tenant.getUsage({
  period: "month",
  breakdown: true
});

console.log({
  apiCalls: usage.apiCalls,           // 50,000
  tokens: usage.totalTokens,          // 2,500,000
  cost: usage.estimatedCost,          // $125.50
  breakdown: {
    gpt4: "$100.00",
    embeddings: "$15.50",
    storage: "$10.00"
  }
});
```

## Tenant Patterns That Matter

### Pattern 1: Self-Service Provisioning
**Customers sign up, get instant AI platform.**

```typescript
// New customer signup
app.post('/signup', async (req, res) => {
  const { company, email, plan } = req.body;
  
  // Create isolated tenant
  const tenant = await xians.createTenant({
    name: slugify(company),
    settings: planConfigs[plan],
    limits: planLimits[plan]
  });
  
  // Add first user
  await tenant.addUser({
    email,
    role: "admin"
  });
  
  res.json({ tenantId: tenant.id });
});
```

### Pattern 2: Custom Per-Tenant Configuration
**Different AI models, features, branding per customer.**

```typescript
// Enterprise customer gets GPT-4 + all features
const enterpriseTenant = await xians.createTenant({
  name: "big-enterprise",
  settings: {
    defaultModel: "gpt-4-turbo",
    features: ["all"],
    customBranding: true
  }
});

// Startup gets GPT-3.5 + basic features
const startupTenant = await xians.createTenant({
  name: "small-startup",
  settings: {
    defaultModel: "gpt-3.5-turbo",
    features: ["agents", "basic-workflows"]
  }
});
```

### Pattern 3: Resource Governance
**Prevent one customer from affecting others.**

```typescript
// Set up tiered plans
const plans = {
  starter: {
    limits: {
      maxAgents: 3,
      maxAPICallsPerDay: 1000,
      storageGB: 5
    }
  },
  professional: {
    limits: {
      maxAgents: 25,
      maxAPICallsPerDay: 50000,
      storageGB: 100
    }
  },
  enterprise: {
    limits: {
      maxAgents: 1000,
      maxAPICallsPerDay: 1000000,
      storageGB: 5000
    }
  }
};
```

## Real-World Example

### Building AI-Powered Customer Support SaaS

```typescript
// Customer A: E-commerce company
const ecommerceTenant = await xians.createTenant({
  name: "ecommerce-co",
  settings: {
    industry: "retail",
    defaultModel: "gpt-4"
  }
});

// Their agents only know about their products
await ecommerceTenant.createKnowledgeBase({
  name: "products",
  documents: ecommerceProductCatalog
});

await ecommerceTenant.createAgent({
  name: "OrderSupportAgent",
  knowledgeBases: ["products"]
});

// Customer B: Healthcare startup  
const healthcareTenant = await xians.createTenant({
  name: "health-startup",
  settings: {
    industry: "healthcare",
    dataRegion: "us-east-1",  // HIPAA compliance
    encryption: "customer-managed-keys"
  }
});

// Their agents handle medical info (completely isolated)
await healthcareTenant.createAgent({
  name: "PatientSupportAgent",
  // Zero risk of accessing ecommerce data
});
```

## Tenant Management

### User Management

```typescript
// Add users to tenant
await tenant.addUser({
  email: "engineer@acme.com",
  role: "developer",
  permissions: ["create:agents", "view:analytics"]
});

// List tenant users
const users = await tenant.getUsers();

// Remove user
await tenant.removeUser("user_id");
```

### Upgrade/Downgrade Plans

```typescript
// Customer upgrades
await tenant.updateLimits({
  maxAgents: 100,          // Was 50
  maxAPICallsPerDay: 50000 // Was 10000
});

// Update features
await tenant.updateSettings({
  features: ["workflows", "knowledge-base", "webhooks", "custom-models"]
});
```

## Best Practices

**✅ Design for Multi-Tenancy from Day 1**
Even if you have one customer, architect with tenants. Easier than retrofitting later.

**✅ Enforce Limits Automatically**
Don't just track—enforce. Prevents abuse and surprise bills.

**✅ Track Usage Per Tenant**
```typescript
// Know exactly what each customer costs
const usage = await tenant.getUsage({ period: "month" });
if (usage.cost > tenant.billing.budget) {
  await tenant.notify("Budget exceeded");
}
```

**✅ Test Isolation**
Regularly verify tenants can't access each other's data.

**❌ Don't Share Tenants**
One customer = one tenant. Don't mix departments or projects.

**❌ Don't Forget to Clean Up**
When tenant is deleted, purge all their data.

## Integration Points

Tenants tie together your entire platform:

- **[Agents](agents.md)**: Scoped to tenant
- **[Workflows](workflows.md)**: Isolated per tenant
- **[Messages](messages.md)**: Tenant-specific threads
- **[Knowledge](knowledge.md)**: Tenant knowledge bases
- **[Document DB](document-db.md)**: Automatic tenant isolation

---

**The Bottom Line**: Tenants let you build one AI platform that serves thousands of customers safely, efficiently, and profitably. It's the architecture that makes AI SaaS possible.
