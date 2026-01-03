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

## Implementing the Message Store

To enable chat history in MAF (Microsoft Agent Framework), we need to implement a message store class. This bridges Xians' message storage with MAF's expectations.

### Step 1: Create the XiansChatMessageStore

Create a new class that implements MAF's `ChatMessageStore` interface:

```csharp
using System.Text.Json;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Xians.Lib.Agents.Messaging;

namespace Xians.SimpleAgent.Utils;

internal sealed class XiansChatMessageStore : ChatMessageStore
{
    private readonly UserMessageContext _context;

    public XiansChatMessageStore(UserMessageContext context)
    {
        _context = context;
    }

    public override async Task<IEnumerable<ChatMessage>> GetMessagesAsync(
        CancellationToken cancellationToken)
    {
        // Get chat history from Xians
        var xiansMessages = await _context.Messages.GetHistoryAsync(page: 1, pageSize: 10);
        
        // Convert to ChatMessage format
        var chatMessages = xiansMessages
            .Where(msg => !string.IsNullOrEmpty(msg.Text))
            .Select(msg => new ChatMessage(
                msg.Direction.ToLowerInvariant() == "outgoing" ? ChatRole.Assistant : ChatRole.User,
                msg.Text!))
            .Reverse() // Xians returns newest first, we need oldest first
            .ToList();
        
        return chatMessages;
    }

    public override Task AddMessagesAsync(
        IEnumerable<ChatMessage> messages,
        CancellationToken cancellationToken)
    {
        // No-op: Xians automatically stores messages
        return Task.CompletedTask;
    }

    public override JsonElement Serialize(JsonSerializerOptions? jsonSerializerOptions = null)
    {
        // Serialize the thread ID for state persistence
        return JsonSerializer.SerializeToElement(_context.ThreadId);
    }
}
```

### Understanding the Key Methods

**GetMessagesAsync**: This retrieves the conversation history from Xians using `_context.GetChatHistoryAsync()`. The method:

- Fetches the most recent 10 messages (you can adjust `pageSize` as needed)
- Filters out empty messages
- Converts Xians message format to MAF's `ChatMessage` format
- Reverses the order (Xians returns newest first, but MAF expects oldest first)

!!! note "Scoped Conversations"
    If the current conversation has a scope (topic), you'll only get messages from that scope. Messages without a scope use the default scope (`null`).

**AddMessagesAsync**: This is a no-op because Xians automatically stores all messages for you - no manual saving required!

**Serialize**: Persists the thread ID for state management across agent sessions.

### Step 2: Update Your MAF Agent

Now let's wire up the message store to your MAF agent. Notice we're now passing the entire `UserMessageContext` instead of just the message text:

```csharp
public class MafSubAgent
{
    private readonly ChatClient _chatClient;

    public MafSubAgent(string openAiApiKey, string modelName = "gpt-4o-mini")
    {
        _chatClient = new OpenAIClient(openAiApiKey).GetChatClient(modelName);
    }

    public async Task<string> RunAsync(UserMessageContext context)
    {
        var agent = _chatClient.CreateAIAgent(new ChatClientAgentOptions
        {
            ChatOptions = new ChatOptions
            {
                Instructions = "You are a helpful assistant."
            },
            ChatMessageStoreFactory = ctx => new XiansChatMessageStore(context)
        });

        var response = await agent.RunAsync(context.Message.Text);
        return response.Text;
    }
}
```

The key change is in `ChatMessageStoreFactory` - we're now providing our custom `XiansChatMessageStore` that knows how to retrieve conversation history from Xians.

### Step 3: Update Your Message Handler

Finally, update your `Program.cs` to pass the full context object to the agent:

```csharp
// Handle incoming user messages
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var response = await mafAgent.RunAsync(context);
    await context.Messages.ReplyAsync(response);
});
```

## What's Next?

Congratulations! Your agent now has memory and can maintain context across conversations. Try asking follow-up questions and watch your agent understand the conversation flow.

In the next section, we'll explore more advanced features like tool integration and multi-agent workflows.
