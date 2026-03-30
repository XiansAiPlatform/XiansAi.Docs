# Chat History

## The Problem with Memory Loss

Remember the MAF agent we built in the previous step? It has a significant limitation: **no chat history**. Every message is treated as an isolated conversation, as if the agent has amnesia between each interaction. This isn't how useful agents work in the real world!

Imagine asking an agent "What's the weather like?" followed by "How about tomorrow?" - without context, the agent wouldn't know you're still talking about weather. Frustrating, right?

## How Xians Manages Conversation Memory

The good news? **Xians automatically stores all messages** with proper isolation across:

- **Tenants** - keeping different organizations separate
- **Agent-User pairs** - each user gets their own conversation history
- **Topics/Scopes** - conversations can be organized by subject

!!! info "Secure & Compliant Storage"
    Xians stores all messages **encrypted at rest**, helping you build AI agents that are compliant with the EU AI Act and other data protection regulations. Your users' conversations are protected by default.

The platform provides convenient methods to access this chat history for the current context, making your agents context-aware.

## Implementing history with an AI context provider

To surface Xians thread history in MAF (Microsoft Agent Framework), implement an **`AIContextProvider`** that loads recent messages from `UserMessageContext` and merges them into the turn’s `AIContext`. One instance is typically created per agent run, bound to that turn’s context.

### Why override `InvokingCoreAsync`?

The framework default merges provider output with the current input as `currentInput.Concat(history)`. That ordering makes the **last** message the previous assistant turn instead of the **current user** message. Override **`InvokingCoreAsync`** so messages are merged as **`history.Concat(currentInput)`**: chronological past turns, then this turn’s input.

### Step 1: Create `ChatHistoryProvider`

```csharp
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Xians.Lib.Agents.Messaging;

internal sealed class ChatHistoryProvider(UserMessageContext userContext) : AIContextProvider(null, null)
{
    private readonly UserMessageContext _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));

    internal const int HistoryPageSize = 10;

    public override IReadOnlyList<string> StateKeys => [];

    protected override async ValueTask<AIContext> InvokingCoreAsync(
        InvokingContext context,
        CancellationToken cancellationToken = default)
    {
        AIContext inputContext = context.AIContext;
        var filteredInput = new InvokingContext(context.Agent, context.Session, new AIContext
        {
            Instructions = inputContext.Instructions,
            Messages = inputContext.Messages is not null ? ProvideInputMessageFilter(inputContext.Messages) : null,
            Tools = inputContext.Tools
        });

        AIContext additional = await ProvideAIContextAsync(filteredInput, cancellationToken).ConfigureAwait(false);

        string? instructions = inputContext.Instructions;
        string? additionalInstructions = additional.Instructions;
        string? mergedInstructions = (instructions, additionalInstructions) switch
        {
            (null, _) => additionalInstructions,
            (_, null) => instructions,
            _ => instructions + "\n" + additionalInstructions
        };

        IEnumerable<ChatMessage>? historyStamped = additional.Messages?.Select(m =>
            m.WithAgentRequestMessageSource(AgentRequestMessageSourceType.AIContextProvider, typeof(ChatHistoryProvider).FullName));

        IEnumerable<ChatMessage>? inputMessages = inputContext.Messages;
        IEnumerable<ChatMessage>? mergedMessages = (historyStamped, inputMessages) switch
        {
            (null, _) => inputMessages,
            (_, null) => historyStamped,
            _ => historyStamped!.Concat(inputMessages!)
        };

        IEnumerable<AITool>? tools = inputContext.Tools;
        IEnumerable<AITool>? additionalTools = additional.Tools;
        IEnumerable<AITool>? mergedTools = (tools, additionalTools) switch
        {
            (null, _) => additionalTools,
            (_, null) => tools,
            _ => tools!.Concat(additionalTools!)
        };

        return new AIContext
        {
            Instructions = mergedInstructions,
            Messages = mergedMessages,
            Tools = mergedTools
        };
    }

    protected override async ValueTask<AIContext> ProvideAIContextAsync(
        InvokingContext context,
        CancellationToken cancellationToken = default)
    {
        var xiansMessages = await _userContext.GetChatHistoryAsync(page: 1, pageSize: HistoryPageSize).ConfigureAwait(false);

        var messages = xiansMessages
            .Where(msg => !string.IsNullOrEmpty(msg.Text))
            .OrderBy(msg => msg.CreatedAt)
            .Select(msg => new ChatMessage(
                msg.Direction.ToLowerInvariant() == "outgoing" ? ChatRole.Assistant : ChatRole.User,
                msg.Text!))
            .ToList();

        return new AIContext { Messages = messages };
    }

    protected override ValueTask StoreAIContextAsync(InvokedContext context, CancellationToken cancellationToken = default) =>
        default;
}
```

### Understanding the key pieces

**`ProvideAIContextAsync`**: Loads the first page of thread history from Xians via `_userContext.GetChatHistoryAsync(page: 1, pageSize: HistoryPageSize)` (default page size `10`). It drops empty text, orders messages by **`CreatedAt`** (oldest first), and maps each row to MAF `ChatMessage` with **`ChatRole.Assistant`** for outgoing and **`ChatRole.User`** for incoming.

**`InvokingCoreAsync`**: Merges that history with the current turn’s messages, instructions, and tools so the model sees the correct sequence. History messages are stamped with `WithAgentRequestMessageSource` for the AI context provider source type.

**`StoreAIContextAsync`**: Left as a no-op; Xians persists messages—you do not manually save turns here.

!!! note "Scoped Conversations"
    If the current conversation has a scope (topic), you'll only get messages from that scope. Messages without a scope use the default scope (`null`).

### Step 2: Register the provider on your MAF agent

Wire the provider when building the chat client agent. Pass a **`ChatHistoryProvider`** instance built from the same **`UserMessageContext`** you use for the run:

```csharp
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using OpenAI;
using OpenAI.Chat;
using Xians.Lib.Agents.Messaging;

public sealed class MafSubAgent
{
    private readonly OpenAIClient _openAi;
    private readonly string _modelName;

    public MafSubAgent(string openAiApiKey, string modelName = "gpt-4o-mini")
    {
        _openAi = new OpenAIClient(openAiApiKey);
        _modelName = modelName;
    }

    public async Task<string> RunAsync(UserMessageContext xiansContext, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(xiansContext);

        var text = xiansContext.Message.Text
            ?? throw new InvalidOperationException("UserMessageContext.Message.Text is required.");

        var agent = _openAi.GetChatClient(_modelName).AsAIAgent(new ChatClientAgentOptions
        {
            Name = "MafSubAgent",
            ChatOptions = new ChatOptions { Instructions = "You are a friendly assistant. Keep your answers brief." },
            AIContextProviders = [new ChatHistoryProvider(xiansContext)]
        });

        return (await agent.RunAsync(text, cancellationToken: cancellationToken).ConfigureAwait(false)).Text;
    }
}
```

The important hook is **`AIContextProviders`**—each run gets a **`ChatHistoryProvider`** tied to that turn’s Xians context so history and the current user message stay aligned.

### Step 3: Update your message handler

Pass the full **`UserMessageContext`** into your agent (not only the text) so `GetChatHistoryAsync` resolves to the correct thread:

```csharp
// Handle incoming user messages
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var response = await mafAgent.RunAsync(context);
    await context.ReplyAsync(response);
});
```

## What's Next?

Congratulations! Your agent now has memory and can maintain context across conversations. Try asking follow-up questions and watch your agent understand the conversation flow.

In the next section, we'll explore more advanced features like tool integration and multi-agent workflows.
