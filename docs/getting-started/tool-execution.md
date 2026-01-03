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
using Xians.Lib.Agents.Core;

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
        await _context.Messages.ReplyAsync($"The current date and time is: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
        var now = DateTime.Now;
        return $"The current date and time is: {now:yyyy-MM-dd HH:mm:ss}";
    }

    [Description("Get the target market description.")]
    public async Task<string> GetTargetMarketDescription()
    {
        // Agent related functionality
        var targetMarketDescription = await XiansContext.CurrentAgent.Knowledge.GetAsync("Market Description");
        return targetMarketDescription?.Content ?? "I couldn't find the target market description.";
    }
}
```

## Associating Tools with Your Agent

Once you've created your tool class, you need to associate it with your agent. The following example demonstrates how to integrate the `MafSubAgentTools` class with an agent using Microsoft's AI Extensions framework:

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
        if (string.IsNullOrWhiteSpace(context.Message.Text))
        {
            return "I didn't receive any message. Please send a message.";
        }

        // Create tools instance with the UserMessageContext
        var tools = new MafSubAgentTools(context);

        // Configure the AI agent with tools
        var agent = _chatClient.CreateAIAgent(new ChatClientAgentOptions
        {
            ChatOptions = new ChatOptions
            {
                Instructions = "You are a helpful assistant.",
                Tools =
                [
                    AIFunctionFactory.Create(tools.GetCurrentDateTime),
                    AIFunctionFactory.Create(tools.GetTargetMarketDescription)
                ]
            },
            // Use Xians chat message store for conversation history
            ChatMessageStoreFactory = ctx => new XiansChatMessageStore(context)
        });

        // Run the agent and return the response
        var response = await agent.RunAsync(context.Message.Text);
        return response.Text;
    }
}
```
