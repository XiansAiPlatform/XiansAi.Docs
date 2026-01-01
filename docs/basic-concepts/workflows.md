# Workflows

## Orchestration for the AI Age

Imagine you need to onboard a new customer. Simple, right? Except it involves validating their data, creating accounts across three systems, sending personalized emails, scheduling follow-ups, and handling edge cases. Traditional automation breaks. Humans get overwhelmed. **Workflows with AI agents adapt.**

## The Orchestration Problem

Here's why most automation fails:

**Traditional Workflows:**
```
If X then Y → Rigid, brittle
Can't handle exceptions → Requires human intervention
No learning → Same mistakes repeatedly
```

**AI Agent Workflows:**
```
Agent analyzes situation → Adapts to context
Handles ambiguity → Makes intelligent decisions
Learns from patterns → Improves over time
```

## Why Workflows Transform AI Development

### Challenge: Individual agents are powerful but limited
A single agent is great at one task. But real business processes require **coordination, sequencing, and conditional logic**.

### Solution: Workflow orchestration
Workflows let you:
- **Chain agents** into sophisticated processes
- **Branch based on outcomes**, not just hardcoded rules
- **Handle failures gracefully** with retries and fallbacks
- **Parallelize work** for speed
- **Maintain state** across complex, multi-step operations

## Core Concepts

### Workflows Are Process Blueprints

```typescript
const onboarding = await xians.createWorkflow({
  name: "CustomerOnboarding",
  
  steps: [
    // Step 1: AI analyzes the application
    {
      id: "review",
      agent: "ApplicationReviewerAgent",
      input: "{{application}}"
    },
    
    // Step 2: If approved, create accounts (parallel)
    {
      id: "provision",
      dependsOn: ["review"],
      condition: "{{review.status}} === 'approved'",
      parallel: [
        { agent: "CRMSetupAgent" },
        { agent: "BillingSetupAgent" },
        { agent: "AccessProvisioningAgent" }
      ]
    },
    
    // Step 3: Personalized welcome based on tier
    {
      id: "welcome",
      dependsOn: ["provision"],
      agent: "WelcomeAgent",
      input: {
        customerData: "{{provision.result}}",
        template: "{{review.recommendedTier}}"
      }
    }
  ]
});
```

### Execution Flow

```
Start → Review (AI decides) → 
        ↓ Approved?
        ├─ Yes → [Provision (3 agents in parallel)]  → Welcome → Done
        └─ No  → Rejection Notice → Done
```

## Workflow Patterns That Matter

### Pattern 1: Sequential Processing
**When order matters.**

```typescript
{
  steps: [
    { id: "extract", agent: "DataExtractor" },
    { id: "validate", agent: "Validator", dependsOn: ["extract"] },
    { id: "enrich", agent: "Enricher", dependsOn: ["validate"] },
    { id: "store", agent: "StorageAgent", dependsOn: ["enrich"] }
  ]
}
```

**Use case**: Document processing pipeline where each step builds on the previous.

### Pattern 2: Parallel Fan-Out
**When speed matters.**

```typescript
{
  id: "analyze-all",
  parallel: [
    { agent: "SentimentAnalyzer" },
    { agent: "KeywordExtractor" },
    { agent: "CategoryClassifier" },
    { agent: "LanguageDetector" }
  ]
}
```

**Use case**: Analyze content from multiple angles simultaneously.

### Pattern 3: Conditional Branching
**When context determines the path.**

```typescript
{
  steps: [
    { id: "assess", agent: "RiskAssessment" },
    {
      id: "route",
      condition: "{{assess.risk}} === 'high'",
      onTrue: { agent: "SeniorReviewAgent" },
      onFalse: { agent: "AutoApprovalAgent" }
    }
  ]
}
```

**Use case**: Route work to appropriate handler based on complexity.

### Pattern 4: Human-in-the-Loop
**When judgment calls matter.**

```typescript
{
  steps: [
    { id: "initial-review", agent: "ContentModerationAgent" },
    {
      id: "human-check",
      condition: "{{initial-review.confidence}} < 0.8",
      type: "human-approval",
      assignTo: "moderation-team"
    },
    { id: "publish", dependsOn: ["human-check"] }
  ]
}
```

**Use case**: AI does the heavy lifting, humans handle edge cases.

## Real-World Example

### Before Workflows: The Chaos

```javascript
// Nightmare: Coordinating everything manually
try {
  const analysis = await analyzeAgent.run(data);
  if (analysis.score > 70) {
    const account = await createAccount(analysis.data);
    await Promise.all([
      sendWelcomeEmail(account),
      setupBilling(account),
      createCRMRecord(account)
    ]);
    await notifyTeam(account);
  } else {
    await rejectApplication(analysis.reason);
  }
  await logResult(success);
} catch (e) {
  // What failed? Where? What state are we in?
  await cleanup(???);
}
```

### With Workflows: The Clarity

```typescript
// Clean: Declarative, trackable, resilient
const execution = await customerOnboardingWorkflow.start({
  application: applicationData
});

// Xians handles:
// ✓ Agent coordination
// ✓ State management
// ✓ Error recovery
// ✓ Progress tracking
// ✓ Retry logic

// You monitor:
const status = await execution.getStatus();
console.log(`Step ${status.currentStep}: ${status.progress}%`);
```

## Workflow Intelligence

What makes Xians workflows special? **They're AI-native.**

### Smart Transitions
```typescript
// Not just "if status === 'approved'"
// But "agent decides what happens next"
{
  id: "router",
  agent: "WorkflowRouterAgent",
  systemPrompt: `Analyze the customer request and route to:
    - FastTrackWorkflow for standard cases
    - CustomSolutionWorkflow for complex cases
    - EscalationWorkflow for urgent cases`
}
```

### Self-Healing
```typescript
{
  retry: {
    maxAttempts: 3,
    backoff: "exponential",
    onFailure: {
      agent: "ErrorAnalysisAgent",  // AI figures out what went wrong
      fallback: "NotifyHumansWorkflow"
    }
  }
}
```

### Adaptive Behavior
```typescript
// Workflow learns from outcomes
{
  monitoring: {
    trackSuccess: true,
    optimizeRouting: true,  // AI adjusts which paths work best
    suggestImprovements: true
  }
}
```

## Why This Changes AI Development

### Traditional Approach
- Workflows = rigid state machines
- Changes = rewrite everything
- Failures = mystery debugging

### AI Workflow Approach
- Workflows = adaptive processes
- Changes = adjust prompts or add agents
- Failures = agents explain and recover

## Configuration Deep Dive

### State Management

```typescript
// Share data across steps
{
  id: "analyze",
  agent: "DataAnalyzer",
  output: "analysisResult"  // Save to workflow state
}
{
  id: "act",
  agent: "ActionAgent",
  input: "{{analysisResult}}"  // Reference previous output
}
```

### Timeouts & SLAs

```typescript
{
  steps: [
    {
      id: "urgent-review",
      agent: "ReviewAgent",
      timeout: "5m",  // Must complete in 5 minutes
      onTimeout: {
        escalate: true,
        notify: ["ops@company.com"]
      }
    }
  ]
}
```

### Monitoring & Observability

```typescript
// Track everything
const metrics = await workflow.getMetrics();
console.log(`
  Success rate: ${metrics.successRate}%
  Avg duration: ${metrics.avgDuration}
  Bottleneck: ${metrics.slowestStep}
  Cost per run: $${metrics.avgCost}
`);
```

## Best Practices

**✅ Design for Observability**
```typescript
// Always track state and progress
{
  id: "important-step",
  agent: "CriticalAgent",
  monitoring: {
    logInputs: true,
    logOutputs: true,
    trackDuration: true
  }
}
```

**✅ Build Resilience**
```typescript
// Plan for failure
{
  retry: { maxAttempts: 3 },
  fallback: "alternative-workflow",
  timeout: "10m"
}
```

**✅ Keep Steps Atomic**
Each step should do ONE thing well. Better to have 10 simple steps than 3 complex ones.

**❌ Don't Create Mega-Workflows**
Split complex processes into sub-workflows. Easier to test, debug, and reuse.

**❌ Don't Ignore Context Windows**
Each step sees previous outputs. Long workflows = huge context. Plan accordingly.

## Integration Points

Workflows become powerful when combined with:

- **[Agents](agents.md)**: The workers that execute each step
- **[Messages](messages.md)**: Human-to-workflow communication
- **[Schedules](schedules.md)**: Trigger workflows on a timeline
- **[Webhooks](webhooks.md)**: Start workflows from external events
- **[Knowledge](knowledge.md)**: Equip workflow agents with domain knowledge

---

**The Bottom Line**: Workflows turn your collection of smart agents into coordinated, reliable business processes that adapt to complexity instead of breaking under it.
