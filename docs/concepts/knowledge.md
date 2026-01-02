# Knowledge

## Give Your Agents Domain Expertise

LLMs are smart, but they don't know **your** business. Your products, your policies, your documentation. Knowledge bases solve this through **Retrieval-Augmented Generation (RAG)**—letting agents search your content and ground their answers in your truth.

## The Hallucination Problem

**Raw LLM:**
```
User: "What's your return policy?"
Agent: "I think it's probably 30 days..." ← Made it up
User: "How much does the Pro plan cost?"
Agent: "Around $50/month I believe..." ← Guessing
```

**With Knowledge Base:**
```
User: "What's your return policy?"
Agent searches knowledge base → Finds policy doc
Agent: "Our return policy allows returns within 60 days..." ← Accurate

User: "How much does the Pro plan cost?"
Agent searches knowledge base → Finds pricing
Agent: "The Pro plan is $49/month, billed annually..." ← Factual
```

## Why Knowledge Transforms AI Development

### The Challenge: LLMs Don't Know Your Content
- Training data ends months/years ago
- Doesn't include your docs, products, policies
- Can't access real-time information
- Makes up plausible-sounding lies (hallucinations)

### The Solution: Retrieval-Augmented Generation (RAG)
Knowledge bases provide:
- **Semantic Search**: Find relevant content by meaning, not just keywords
- **Grounded Responses**: Answers based on your actual documents
- **Always Current**: Update docs, agent knows immediately
- **Source Citations**: See exactly what the agent used

## Core Concepts

### How RAG Works

```
1. User asks question
   ↓
2. Question → Embedding → Vector
   ↓
3. Search knowledge base for similar content
   ↓
4. Retrieve top relevant chunks
   ↓
5. LLM generates answer using retrieved context
   ↓
6. Response grounded in your documents
```

### Knowledge Base Structure

```typescript
const kb = await xians.createKnowledgeBase({
  name: "company-docs",
  
  // How to process documents
  chunking: {
    strategy: "semantic",     // Smart chunking
    maxChunkSize: 512,        // Tokens per chunk
    overlap: 50               // Context preservation
  },
  
  // How to search
  embedding: {
    model: "text-embedding-3-large",
    dimensions: 1536
  }
});
```

## Quick Start

### Create and Populate Knowledge Base

```typescript
// Create knowledge base
const kb = await xians.createKnowledgeBase({
  name: "product-docs",
  description: "Product manuals and documentation"
});

// Add documents
await kb.addDocument({
  title: "Pro Plan Features",
  content: `
    The Pro Plan includes:
    - Unlimited API calls
    - 24/7 support
    - Custom integrations
    - SLA: 99.9% uptime
    Price: $99/month
  `,
  metadata: {
    category: "pricing",
    lastUpdated: new Date()
  }
});

// Upload files
await kb.uploadFile("./employee-handbook.pdf");
await kb.uploadFile("./product-guide.md");
```

### Connect Agent to Knowledge Base

```typescript
const agent = await xians.createAgent({
  name: "SupportAgent",
  model: "gpt-4",
  
  // Connect to knowledge bases
  knowledgeBases: ["product-docs", "support-articles"],
  
  // RAG configuration
  ragConfig: {
    retrievalCount: 5,         // Top 5 relevant chunks
    minRelevanceScore: 0.7,    // Filter low-quality matches
    includeInPrompt: true      // Auto-inject into context
  },
  
  systemPrompt: `You are a helpful support agent. 
  Answer questions based on our documentation.
  If you're not sure, say so—don't make things up.`
});

// Agent automatically searches knowledge base
const response = await agent.chat({
  message: "What's included in the Pro plan?"
});

// Response grounded in uploaded documents
console.log(response.message);
console.log(response.sources);  // Which docs were used
```

## Why This Changes AI Development

### Before RAG: Hardcoded Knowledge

```javascript
// Manually stuff knowledge into prompts
const prompt = `
Context: Our return policy is 60 days. Pro plan costs $99/month...
[Paste entire documentation here...]

User question: ${userQuestion}

Answer:`;

// Problems:
// - Context window limits (can't fit everything)
// - Stale (update docs = update all prompts)
// - Inefficient (send irrelevant info every time)
// - Expensive (tokens for unused context)
```

### With Knowledge Bases

```typescript
// Just connect and go
const agent = await xians.createAgent({
  name: "SupportAgent",
  knowledgeBases: ["all-docs"]
});

// Agent automatically:
// - Finds relevant docs for each question
// - Uses only what's needed
// - Stays current with doc updates
// - Cites sources
```

## Powerful Knowledge Patterns

### Pattern 1: Multi-Source Agent

```typescript
// Agent with multiple knowledge bases
const agent = await xians.createAgent({
  name: "UniversalAgent",
  knowledgeBases: [
    "product-docs",       // Product information
    "support-articles",   // How-to guides
    "company-policies",   // HR policies
    "legal-docs"          // Terms, privacy, etc.
  ],
  
  ragConfig: {
    // Search all knowledge bases
    searchStrategy: "parallel",
    
    // Weight by source
    sourceWeights: {
      "product-docs": 1.0,
      "legal-docs": 1.2      // Prioritize legal accuracy
    }
  }
});
```

### Pattern 2: Dynamic Knowledge Updates

```typescript
// Knowledge base syncs with your CMS
const kb = await xians.createKnowledgeBase({
  name: "help-center",
  
  // Auto-sync from web
  sources: [{
    type: "web",
    url: "https://help.yourcompany.com",
    schedule: "daily",      // Refresh daily
    crawlDepth: 3
  }]
});

// Or trigger manual sync
await kb.sync();

// Agents always have latest content
```

### Pattern 3: Filtered Knowledge Retrieval

```typescript
// Different agents see different knowledge
const publicAgent = await xians.createAgent({
  name: "PublicSupportAgent",
  knowledgeBases: ["public-docs"],
  
  ragConfig: {
    filters: {
      "metadata.public": true  // Only public docs
    }
  }
});

const internalAgent = await xians.createAgent({
  name: "InternalAgent",
  knowledgeBases: ["all-docs"],
  
  ragConfig: {
    filters: {
      "metadata.department": "engineering"  // Dept-specific
    }
  }
});
```

## Real-World Examples

### Customer Support with Product Knowledge

```typescript
// Build knowledge base from product docs
const productKB = await xians.createKnowledgeBase({
  name: "products"
});

// Add product catalog
const products = await database.getProducts();
for (const product of products) {
  await productKB.addDocument({
    title: product.name,
    content: `
      ${product.name}
      Price: $${product.price}
      Description: ${product.description}
      Features: ${product.features.join(", ")}
      Specifications: ${JSON.stringify(product.specs)}
    `,
    metadata: {
      category: product.category,
      sku: product.sku,
      inStock: product.stock > 0
    }
  });
}

// Support agent with product knowledge
const agent = await xians.createAgent({
  name: "ProductSupportAgent",
  knowledgeBases: ["products"],
  
  systemPrompt: `You help customers with product questions.
  Use the knowledge base to provide accurate information.
  If a product is out of stock, mention it.`
});

// Agent knows your entire catalog
await agent.chat({
  message: "Do you have wireless headphones under $150?"
});
```

### HR Assistant with Company Policies

```typescript
// Upload company handbook
const hrKB = await xians.createKnowledgeBase({
  name: "hr-policies"
});

await hrKB.uploadFile("./employee-handbook.pdf");
await hrKB.uploadFile("./benefits-guide.pdf");
await hrKB.uploadFile("./pto-policy.md");

// HR agent
const hrAgent = await xians.createAgent({
  name: "HRAssistant",
  knowledgeBases: ["hr-policies"],
  
  ragConfig: {
    retrievalCount: 3,
    includeInPrompt: true
  },
  
  systemPrompt: `You're an HR assistant. Answer employee questions
  about company policies accurately. Always cite the specific policy
  section you're referencing.`
});

// Employees get instant, accurate answers
await hrAgent.chat({
  message: "How many vacation days do I get?"
});
// Response includes: "According to the PTO Policy section 3.1..."
```

### Code Documentation Assistant

```typescript
// Index your codebase documentation
const docsKB = await xians.createKnowledgeBase({
  name: "api-docs"
});

// Add API documentation
await docsKB.uploadFile("./docs/api-reference.md");
await docsKB.uploadFile("./docs/sdk-guide.md");
await docsKB.uploadFile("./docs/examples.md");

// Developer assistant
const devAgent = await xians.createAgent({
  name: "DevAssistant",
  knowledgeBases: ["api-docs"],
  
  systemPrompt: `You help developers use our API.
  Provide code examples and link to relevant documentation.`
});

await devAgent.chat({
  message: "How do I authenticate API requests?"
});
```

## Advanced Features

### Hybrid Search

```typescript
// Combine semantic search + keyword matching
const results = await kb.hybridSearch({
  query: "return policy for electronics",
  keywords: ["60 days", "warranty"],
  weights: {
    semantic: 0.7,    // 70% semantic similarity
    keyword: 0.3      // 30% keyword matching
  }
});
```

### Chunk Strategies

```typescript
// Semantic chunking (smart)
await kb.updateConfig({
  chunking: {
    strategy: "semantic",     // AI understands context
    maxChunkSize: 1000
  }
});

// Fixed size chunking (simple)
await kb.updateConfig({
  chunking: {
    strategy: "fixed",
    chunkSize: 512,
    overlap: 50
  }
});
```

### Source Citations

```typescript
// See what knowledge was used
const response = await agent.chat({
  message: "What's your refund policy?"
});

console.log(response.sources);
// [
//   { 
//     title: "Return & Refund Policy",
//     chunk: "Customers may return items within 60 days...",
//     score: 0.92
//   }
// ]
```

## Knowledge vs Document DB

| Feature | Knowledge Base | Document DB |
|---------|---------------|-------------|
| **Purpose** | Semantic search, RAG | Structured data storage |
| **Search** | By meaning/similarity | By exact fields |
| **Best for** | Documents, content, text | Records, entities, state |
| **Example** | Product manuals, FAQs | Customer records, orders |
| **Agent use** | "What's the policy?" | "Who is customer #123?" |

**Use both together:**
```typescript
// Knowledge: Content search
const policyInfo = await kb.search("return policy");

// Document DB: Data lookup
const customer = await db.findOne("customers", { id: "123" });

// Agent combines both
const response = `Based on our policy: ${policyInfo}
For your order: ${customer.lastOrder}`;
```

## Best Practices

**✅ Chunk Documents Smartly**
```typescript
// Good chunk size: 512-1024 tokens
// Include overlap to preserve context
chunking: {
  maxChunkSize: 512,
  overlap: 50
}
```

**✅ Use Rich Metadata**
```typescript
await kb.addDocument({
  title: "Pro Plan Pricing",
  content: "...",
  metadata: {
    category: "pricing",
    plan: "pro",
    lastUpdated: "2024-12-01",
    public: true
  }
});
```

**✅ Monitor Search Quality**
```typescript
// Track what users search for
const analytics = await kb.getAnalytics();
console.log("Top queries:", analytics.topQueries);
console.log("Coverage:", analytics.coverageRate);

// Identify gaps in knowledge
console.log("Queries with poor results:", analytics.lowScoreQueries);
```

**❌ Don't Dump Everything**
Only add relevant, well-structured content. Quality > Quantity.

**❌ Don't Forget to Update**
Stale knowledge = wrong answers. Keep docs current.

## Integration Points

Knowledge powers intelligent agents:

- **[Agents](agents.md)**: Ground agents in your domain knowledge
- **[Workflows](workflows.md)**: Knowledge retrieval in workflow steps
- **[Document DB](document-db.md)**: Different use case - structured vs semantic
- **[Messages](messages.md)**: Cite sources in conversation

---

**The Bottom Line**: Knowledge bases transform generic LLMs into domain experts. They're the bridge between your content and your AI agents—enabling accurate, grounded, trustworthy responses.
