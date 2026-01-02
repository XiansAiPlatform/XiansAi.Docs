# Document DB

## Flexible Data Storage for AI

Your agents need to **remember things**. Customer profiles, order history, session data, analytics—structured information that doesn't fit neatly into prompts. Document DB gives your agents a schema-less, queryable memory that scales.

## The Data Storage Problem

**Traditional Databases:**
```
Define rigid schema → Hope you got it right
Need a new field? → Migration script, downtime, anxiety
Nested data? → Junction tables, complex joins, headaches
```

**Document DB:**
```
Store JSON documents → No schema needed
New field? → Just add it
Nested data? → Natural and simple
Query flexibly → Find exactly what you need
```

## Why Document DB Matters for AI Development

### The Challenge: Agents Need Context Beyond Conversations
AI agents are powerful, but they need structured data:
- **Customer context**: Who are they? What's their history?
- **Session state**: Where are we in a complex process?
- **Business data**: Products, orders, inventory, analytics
- **Agent memory**: Decisions made, actions taken

### The Solution: Schema-Less, AI-Friendly Storage
Document DB provides:
- **Flexible schema**: Store any structure without migrations
- **Fast queries**: Find data instantly with indexes
- **Tenant isolation**: Automatic data separation
- **AI-native**: Perfect for unstructured, evolving data

## Core Concepts

### Documents Are Just JSON

```typescript
// Customer document
{
  _id: "cust_123",
  _collection: "customers",
  _tenantId: "acme-corp",
  _createdAt: "2024-01-15T10:30:00Z",
  
  // Your data - any structure you want
  name: "Jane Smith",
  email: "jane@example.com",
  plan: "enterprise",
  tags: ["vip", "early-adopter"],
  preferences: {
    notifications: true,
    theme: "dark"
  },
  purchaseHistory: [
    { date: "2024-01-10", amount: 299.99 },
    { date: "2024-02-15", amount: 499.99 }
  ]
}
```

### Collections Organize Documents

```
Document DB
├── customers       → Customer profiles
├── orders          → Order history
├── sessions        → User sessions
├── agent-state     → Agent memory
├── products        → Product catalog
└── analytics       → Usage metrics
```

## Quick Start

### Store Data

```typescript
// Create a customer record
const customer = await xians.documentDB.insert("customers", {
  name: "John Doe",
  email: "john@example.com",
  plan: "professional",
  signupDate: new Date(),
  metadata: {
    source: "website",
    campaign: "q4-2024"
  }
});

// Document ID returned
console.log(customer._id);  // "cust_xyz789"
```

### Query Data

```typescript
// Find VIP customers
const vipCustomers = await xians.documentDB.find("customers", {
  tags: { $contains: "vip" },
  plan: "enterprise"
});

// Find by ID
const customer = await xians.documentDB.findById("customers", "cust_123");

// Complex queries
const results = await xians.documentDB.find("orders", {
  total: { $gt: 100, $lt: 1000 },
  status: "completed",
  createdAt: { $gte: startOfMonth }
});
```

### Update Data

```typescript
// Update customer
await xians.documentDB.updateById("customers", "cust_123", {
  plan: "enterprise",  // Update field
  tags: { $push: "premium" }  // Add to array
});
```

## Why This Changes AI Development

### Before Document DB: Manual Data Management

```javascript
// Manually manage database connections
const pool = new Pool({ connectionString: DB_URL });

// Write SQL for every query
const result = await pool.query(
  `SELECT * FROM customers 
   WHERE plan = $1 AND tags @> $2`,
  ['enterprise', ['vip']]
);

// Map rows to objects
const customers = result.rows.map(row => ({
  id: row.customer_id,
  name: row.customer_name,
  // ... manual mapping
}));

// Store complex nested data? Good luck.
```

### With Document DB

```typescript
// Just store and query
const customers = await xians.documentDB.find("customers", {
  plan: "enterprise",
  tags: { $contains: "vip" }
});

// Nested data? No problem.
// Complex structures? Natural.
// Schema changes? Just do it.
```

## Powerful Patterns for AI Agents

### Pattern 1: Agent Memory

```typescript
// Agent remembers decisions across conversations
const conversationAgent = await xians.createAgent({
  name: "SalesAgent",
  
  onMessage: async (message, context) => {
    // Load agent memory for this customer
    const memory = await xians.documentDB.findOne("agent-memory", {
      customerId: message.userId,
      agentId: "sales-agent"
    });
    
    // Agent sees: what was discussed, decisions made, next steps
    const response = await llm.chat({
      message: message.content,
      context: memory || {}
    });
    
    // Update memory
    await xians.documentDB.updateById("agent-memory", memory._id, {
      lastInteraction: new Date(),
      topics: { $push: response.topic },
      nextSteps: response.nextSteps
    });
    
    return response;
  }
});
```

### Pattern 2: Dynamic Context for Agents

```typescript
// Agent looks up customer context automatically
const agent = await xians.createAgent({
  name: "SupportAgent",
  
  beforeMessage: async (message) => {
    // Enrich with customer data
    const customer = await xians.documentDB.findOne("customers", {
      email: message.userEmail
    });
    
    const recentOrders = await xians.documentDB.find("orders", {
      customerId: customer._id,
      createdAt: { $gte: thirtyDaysAgo }
    }, {
      sort: { createdAt: -1 },
      limit: 5
    });
    
    // Agent gets full context automatically
    return {
      ...message,
      customerContext: {
        plan: customer.plan,
        vip: customer.tags?.includes("vip"),
        recentOrders: recentOrders
      }
    };
  }
});
```

### Pattern 3: Workflow State Persistence

```typescript
// Store complex workflow state
const workflow = await xians.createWorkflow({
  name: "CustomerOnboarding",
  
  onStep: async (step, data) => {
    // Save state after each step
    await xians.documentDB.updateById("workflow-state", data.executionId, {
      currentStep: step.id,
      stepData: {
        [step.id]: data.output
      },
      updatedAt: new Date()
    });
  },
  
  onResume: async (executionId) => {
    // Resume from saved state
    const state = await xians.documentDB.findOne("workflow-state", {
      executionId
    });
    
    return state.stepData;
  }
});
```

## Querying Power

### Rich Query Operators

```typescript
// Comparison
const orders = await xians.documentDB.find("orders", {
  total: { $gt: 100, $lt: 1000 },
  status: { $in: ["pending", "processing"] },
  createdAt: { $gte: startDate, $lte: endDate }
});

// Logical operators
const customers = await xians.documentDB.find("customers", {
  $or: [
    { plan: "enterprise" },
    { revenue: { $gt: 10000 } },
    { tags: { $contains: "vip" } }
  ]
});

// Nested fields
const results = await xians.documentDB.find("customers", {
  "address.country": "USA",
  "metadata.verified": true,
  "preferences.notifications": true
});

// Array operations
const products = await xians.documentDB.find("products", {
  tags: { $contains: "featured" },
  categories: { $containsAny: ["electronics", "gadgets"] }
});
```

### Aggregation for Analytics

```typescript
// Group and count
const stats = await xians.documentDB.aggregate("orders", [
  { $match: { status: "completed" } },
  { 
    $group: {
      _id: "$customerId",
      totalOrders: { $count: {} },
      totalRevenue: { $sum: "$total" },
      avgOrder: { $avg: "$total" }
    }
  },
  { $sort: { totalRevenue: -1 } },
  { $limit: 10 }
]);

// Top customers by revenue
console.log(stats);
```

## Real-World Examples

### E-Commerce Agent with Product Catalog

```typescript
// Agent queries product database
const productAgent = await xians.createAgent({
  name: "ProductRecommendationAgent",
  
  tools: [{
    name: "searchProducts",
    handler: async ({ query, filters }) => {
      return await xians.documentDB.find("products", {
        $text: { $search: query },
        inStock: true,
        price: filters.priceRange,
        categories: { $containsAny: filters.categories }
      }, {
        limit: 10,
        sort: { popularity: -1 }
      });
    }
  }],
  
  systemPrompt: `You help customers find products. Use searchProducts 
  to look up our catalog and make personalized recommendations.`
});

// Agent can now intelligently search products
const response = await productAgent.chat({
  message: "I need wireless headphones under $200"
});
```

### Session State Management

```typescript
// Multi-step form with AI assistance
const formAgent = await xians.createAgent({
  name: "FormAssistant",
  
  onMessage: async (message, context) => {
    // Load session state
    const session = await xians.documentDB.findOne("sessions", {
      sessionId: context.sessionId
    }) || {
      sessionId: context.sessionId,
      currentStep: 1,
      formData: {}
    };
    
    // Process current step
    const stepResult = await processStep(message, session.currentStep);
    
    // Update session
    session.formData[`step${session.currentStep}`] = stepResult;
    session.currentStep += 1;
    
    await xians.documentDB.upsert("sessions", 
      { sessionId: context.sessionId },
      session
    );
    
    return {
      message: `Great! Moving to step ${session.currentStep}...`,
      progress: `${session.currentStep} of 5`
    };
  }
});
```

## Performance: Indexes

### Speed Up Queries

```typescript
// Create index on frequently queried fields
await xians.documentDB.createIndex("customers", {
  field: "email",
  unique: true  // Enforce uniqueness
});

// Compound index for complex queries
await xians.documentDB.createIndex("orders", {
  fields: ["customerId", "status", "createdAt"],
  name: "customer_orders_idx"
});

// Text index for search
await xians.documentDB.createIndex("products", {
  field: "description",
  type: "text"
});

// Now queries are fast
```

## Best Practices

**✅ Use Metadata Richly**
```typescript
// Good - Rich metadata for flexible queries
{
  _id: "order_123",
  customerId: "cust_456",
  status: "completed",
  tags: ["express", "vip"],
  metadata: {
    source: "mobile-app",
    campaign: "summer-sale",
    priority: "high"
  }
}
```

**✅ Index Frequently Queried Fields**
```typescript
// If you query by customerId often
await xians.documentDB.createIndex("orders", {
  field: "customerId"
});
```

**✅ Use Pagination for Large Results**
```typescript
const page1 = await xians.documentDB.find("orders", 
  { status: "completed" },
  { limit: 50, skip: 0 }
);

const page2 = await xians.documentDB.find("orders",
  { status: "completed" },
  { limit: 50, skip: 50 }
);
```

**❌ Don't Store Huge Documents**
Keep documents under 1MB. Split large data into separate documents.

**❌ Don't Over-Nest**
```typescript
// Bad - too deep
customer.orders[0].items[0].product.category.parent.grandparent

// Good - reference instead
customer.orderIds → separate orders collection
```

## Tenant Isolation: Automatic

```typescript
// When operating in tenant context
const tenant = xians.tenant("acme-corp");

// All queries automatically scoped to tenant
const customers = await tenant.documentDB.find("customers", {});
// Returns ONLY acme-corp customers

// Impossible to accidentally query another tenant's data
```

## Integration Points

Document DB powers the entire platform:

- **[Agents](agents.md)**: Store agent memory and context
- **[Workflows](workflows.md)**: Persist workflow state
- **[Messages](messages.md)**: Enrich messages with business data
- **[Knowledge](knowledge.md)**: Different use case - semantic search vs structured queries
- **[Tenants](tenants.md)**: Automatic tenant isolation

---

**The Bottom Line**: Document DB gives your AI agents a flexible, queryable memory. It's the structured data layer that makes agents context-aware, intelligent, and useful beyond simple Q&A.
