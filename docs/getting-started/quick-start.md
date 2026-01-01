# Quick Start

This guide will help you create your first AI agent using Xians.ai in just a few minutes.

## Create Your First Agent

### Step 1: Initialize a New Project

Create a new directory for your agent project:

```bash
mkdir my-first-agent
cd my-first-agent
xians init
```

This will create the basic project structure:

```
my-first-agent/
├── agents/
│   └── main_agent.py
├── config/
│   └── agent_config.yaml
└── requirements.txt
```

### Step 2: Configure Your Agent

Edit `config/agent_config.yaml`:

```yaml
agent:
  name: "MyFirstAgent"
  description: "A simple conversational agent"
  
llm:
  provider: "openai"
  model: "gpt-4"
  
capabilities:
  - greet_user
  - answer_questions
```

### Step 3: Define Agent Behavior

Edit `agents/main_agent.py`:

```python
from xians import Agent, capability

class MyFirstAgent(Agent):
    """A simple conversational agent"""
    
    @capability(description="Greet the user warmly")
    def greet_user(self, name: str) -> str:
        return f"Hello, {name}! How can I help you today?"
    
    @capability(description="Answer questions about Xians.ai")
    def answer_questions(self, question: str) -> str:
        # Your logic here
        return f"You asked: {question}"

if __name__ == "__main__":
    agent = MyFirstAgent()
    agent.run()
```

### Step 4: Run Your Agent

Start your agent:

```bash
xians run
```

Your agent is now running and ready to interact!

## Testing Your Agent

### Using the CLI

Interact with your agent via the command line:

```bash
xians chat --agent MyFirstAgent
```

### Using the API

Send a request to your agent:

```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "agent": "MyFirstAgent"}'
```

## What's Next?

!!! success "Congratulations!"
    You've created your first Xians.ai agent! 🎉

### Next Steps

- Learn about [Configuration](configuration.md) options
- Explore [Agent Capabilities](../user-guide/overview.md)
- Read the [API Reference](../api-reference/overview.md)
- Join our [Community](https://discord.gg/xians)

## Example Projects

Check out these example projects for inspiration:

=== "Customer Support Agent"

    ```python
    from xians import Agent, capability
    
    class SupportAgent(Agent):
        @capability
        def handle_ticket(self, issue: str) -> str:
            # Handle customer support ticket
            return f"Ticket created for: {issue}"
    ```

=== "Data Analysis Agent"

    ```python
    from xians import Agent, capability
    
    class AnalystAgent(Agent):
        @capability
        def analyze_data(self, data: list) -> dict:
            # Analyze data
            return {"summary": "Analysis complete"}
    ```

=== "Task Automation Agent"

    ```python
    from xians import Agent, capability
    
    class AutomationAgent(Agent):
        @capability
        def automate_task(self, task: str) -> str:
            # Automate task
            return f"Task '{task}' automated"
    ```


