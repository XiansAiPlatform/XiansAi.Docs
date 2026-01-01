# API Reference Overview

Complete API reference for the Xians.ai platform.

## API Categories

### Core API

The core API provides the fundamental building blocks for agent development:

- **[Agent API](#agent-api)** - Create and manage agents
- **[Capability API](#capability-api)** - Define agent capabilities
- **[Workflow API](#workflow-api)** - Orchestrate agent workflows

### Integration API

Integration APIs connect agents to external systems:

- **[HTTP API](#http-api)** - RESTful endpoints
- **[WebSocket API](#websocket-api)** - Real-time communication
- **[Event API](#event-api)** - Event-driven integration

### Management API

Management APIs for platform administration:

- **[Admin API](#admin-api)** - Platform administration
- **[Monitoring API](#monitoring-api)** - Metrics and health checks
- **[Configuration API](#configuration-api)** - Dynamic configuration

## Agent API

### Agent Class

```python
class Agent:
    """Base class for all Xians.ai agents."""
    
    def __init__(
        self,
        name: str,
        description: str = "",
        config: Optional[Dict] = None
    ):
        """
        Initialize an agent.
        
        Args:
            name: Agent name
            description: Agent description
            config: Configuration dictionary
        """
        pass
    
    def run(self) -> None:
        """Start the agent."""
        pass
    
    def stop(self) -> None:
        """Stop the agent."""
        pass
```

### Example Usage

```python
from xians import Agent, capability

class MyAgent(Agent):
    def __init__(self):
        super().__init__(
            name="MyAgent",
            description="A sample agent"
        )
    
    @capability
    def greet(self, name: str) -> str:
        return f"Hello, {name}!"

agent = MyAgent()
agent.run()
```

## Capability API

### Capability Decorator

```python
from typing import Callable
from xians import capability

@capability(
    description: str = "",
    requires_auth: bool = False,
    timeout: int = 30
)
def my_capability(self, *args, **kwargs):
    """Define a capability."""
    pass
```

### Example

```python
@capability(
    description="Search for information",
    timeout=60
)
def search(self, query: str, max_results: int = 10) -> List[Dict]:
    """Search for information using the query."""
    # Implementation
    return results
```

## HTTP API

### REST Endpoints

#### POST /api/chat

Send a message to an agent:

```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agent": "MyAgent",
    "message": "Hello!",
    "user_id": "user123"
  }'
```

Response:

```json
{
  "response": "Hello! How can I help you?",
  "agent": "MyAgent",
  "timestamp": "2024-12-22T10:30:00Z"
}
```

#### GET /api/agents

List all agents:

```bash
curl -X GET http://localhost:8080/api/agents \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:

```json
{
  "agents": [
    {
      "name": "MyAgent",
      "description": "A sample agent",
      "status": "running"
    }
  ]
}
```

## Response Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 400  | Bad Request |
| 401  | Unauthorized |
| 404  | Not Found |
| 500  | Internal Server Error |

## Authentication

All API requests require authentication using Bearer tokens:

```bash
Authorization: Bearer YOUR_API_TOKEN
```

## Rate Limiting

API requests are rate-limited:

- **Free tier**: 100 requests/minute
- **Pro tier**: 1000 requests/minute
- **Enterprise**: Custom limits

## SDKs

Official SDKs are available for:

- **Python** - `pip install xians-sdk`
- **TypeScript** - `npm install @xians/sdk`
- **C#** - `dotnet add package Xians.Sdk`

## Next Steps

- Explore the [Agent API](#)
- Learn about [Capabilities](#)
- Check [Authentication](#)


