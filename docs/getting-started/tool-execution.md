# Agents with Tools

Xians provides flexible tool integration that works seamlessly with your preferred agent framework. This guide shows you how to create and use tools within the Xians platform.

## Overview

Xians does not dictate or enforce a specific format for attaching tools to your agents. Instead, you can develop tools according to the recommendations of your chosen agent framework (such as Semantic Kernel, LangChain, or AutoGen).

Within your tools, you can access Xians APIs for:

- **Document DB access** - Store and retrieve structured data
- **Knowledge file access** - Query knowledge bases and files
- **Workflow orchestration** - Start sub-workflows and manage execution
- **Message handling** - Send replies and manage conversations
- etc.

## Accessing Xians Functionality

### UserMessageContext

For user message-related functionality, use the `UserMessageContext` class. This context object exposes SDKs for all operations related to the current user message.

### XiansContext

For agent and workflow-level functionality, use the `XiansContext` static class:

- `XiansContext.CurrentAgent.*` - Access agent-level SDKs and configuration
- `XiansContext.CurrentWorkflow.*` - Access workflow-level SDKs and state

## Example: Creating Tool Classes

Here's a complete example showing how to create a tool class that integrates with Xians:

```csharp
using System.ComponentModel;
using Xians.Lib.Agents.Messaging;

public class MafSubAgentTools
{
    private readonly UserMessageContext _context;

    public MafSubAgentTools(UserMessageContext context)
    {
        _context = context;
    }

    [Description("Get the current date and time.")]
    public async Task<string> GetCurrentDateTime()
    {
        // User message related functionality
        await _context.ReplyAsync($"The current date and time is: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
        var now = DateTime.Now;
        return $"The current date and time is: {now:yyyy-MM-dd HH:mm:ss}";
    }

    [Description("Get the order data.")]
    public async Task<string> GetOrderData(int orderNumber)
    {
        await Task.CompletedTask;
        // Returning elaborated dummy info for demonstration
        return $"Order #{orderNumber}:\n" +
               $"- Customer: John Doe\n" +
               $"- Item: Widget Pro X100\n" +
               $"- Quantity: 3\n" +
               $"- Status: Shipped\n" +
               $"- Estimated Delivery: {DateTime.Today.AddDays(3):yyyy-MM-dd}\n" +
               $"- Total: $299.97";
    }
}
```

## Associating Tools with Your Agent

Once you've created your tool class, you need to associate it with your agent. The following example demonstrates how to integrate the `MafSubAgentTools` class with an agent using Microsoft's AI Extensions framework:

```csharp
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using OpenAI;
using Xians.Lib.Agents.Core;
using Xians.Lib.Agents.Messaging;

public class MafSubAgent
{
    private readonly OpenAIClient _openAi;
    private readonly string _modelName;

    public MafSubAgent(string openAiApiKey, string modelName = "gpt-4o-mini")
    {
        _openAi = new OpenAIClient(openAiApiKey);
        _modelName = modelName;
    }

    private async Task<string> GetSystemPromptAsync(UserMessageContext context)
    {
        // You need to create a KnowledgeItem with the name "System Prompt" in the Xians platform.
        var systemPrompt = await XiansContext.CurrentAgent.Knowledge.GetAsync("System Prompt");
        return systemPrompt?.Content ?? "You are a helpful assistant.";
    }

    public async Task<string> RunAsync(UserMessageContext context)
    {
        if (string.IsNullOrWhiteSpace(context.Message.Text))
        {
            return "I didn't receive any message. Please send a message.";
        }

        var tools = new MafSubAgentTools(context);

        // OpenAI SDK ChatClient → Microsoft.Extensions.AI.IChatClient → MAF agent
        var agent = _openAi.GetChatClient(_modelName).AsIChatClient().AsAIAgent(new ChatClientAgentOptions
        {
            Name = "MafSubAgent",
            ChatOptions = new ChatOptions
            {
                Instructions = await GetSystemPromptAsync(context),
                Tools =
                [
                    AIFunctionFactory.Create(tools.GetCurrentDateTime),
                    AIFunctionFactory.Create(tools.GetOrderData)
                ]
            },
            AIContextProviders = [new ChatHistoryProvider(context)]
        });

        var response = await agent.RunAsync(context.Message.Text);
        return response.Text;
    }
}
```

> **Why `AsIChatClient()`?** `GetChatClient()` returns the OpenAI SDK’s `ChatClient`. MAF’s `AsAIAgent` extension applies to `Microsoft.Extensions.AI.IChatClient`. The `AsIChatClient()` bridge converts between them.

> **History:** Register conversation history with **`AIContextProviders`** (for example a `ChatHistoryProvider` as in [Chat history](chat-history.md)), not `ChatMessageStoreFactory`.
