# Configuration

Learn how to configure your Xians.ai agents for optimal performance.

## Configuration File Structure

Xians.ai uses YAML configuration files to define agent behavior, capabilities, and settings.

### Basic Configuration

```yaml
# agent_config.yaml
agent:
  name: "MyAgent"
  description: "An intelligent agent"
  version: "1.0.0"

llm:
  provider: "openai"
  model: "gpt-4"
  temperature: 0.7
  max_tokens: 2000

environment:
  development:
    debug: true
    log_level: "DEBUG"
  production:
    debug: false
    log_level: "INFO"
```

## Configuration Sections

### Agent Configuration

Define your agent's basic properties:

```yaml
agent:
  name: "CustomerSupportAgent"
  description: "Handles customer inquiries and support tickets"
  version: "2.1.0"
  timeout: 30  # seconds
  retry_policy:
    max_attempts: 3
    backoff_multiplier: 2
```

### LLM Configuration

Configure your language model provider:

```yaml
llm:
  provider: "openai"  # openai, anthropic, azure, etc.
  model: "gpt-4"
  api_key: "${OPENAI_API_KEY}"  # Use environment variable
  temperature: 0.7
  max_tokens: 2000
  top_p: 1.0
  frequency_penalty: 0.0
  presence_penalty: 0.0
```

### Capabilities Configuration

Define agent capabilities:

```yaml
capabilities:
  - name: "search_knowledge"
    enabled: true
    config:
      max_results: 10
      
  - name: "send_email"
    enabled: false
    
  - name: "create_ticket"
    enabled: true
```

## Environment Variables

Use environment variables for sensitive information:

```yaml
llm:
  api_key: "${OPENAI_API_KEY}"
  
database:
  connection_string: "${DATABASE_URL}"
```

Set environment variables:

```bash
export OPENAI_API_KEY="sk-..."
export DATABASE_URL="postgresql://..."
```

## Advanced Configuration

### Multi-Agent Systems

Configure multiple agents:

```yaml
agents:
  - name: "TechSupportAgent"
    specialization: "technical"
    llm:
      model: "gpt-4"
      
  - name: "SalesAgent"
    specialization: "sales"
    llm:
      model: "gpt-3.5-turbo"
```

### Workflow Configuration

Define agent workflows:

```yaml
workflows:
  customer_support:
    steps:
      - agent: "TechSupportAgent"
        condition: "technical_issue"
      - agent: "SalesAgent"
        condition: "sales_inquiry"
```

## Configuration Best Practices

!!! tip "Best Practices"
    - Use environment variables for secrets
    - Keep different configs for dev/staging/prod
    - Version control your configuration files
    - Document custom configuration options

!!! warning "Security"
    Never commit API keys or secrets to version control. Always use environment variables or secret management systems.

## Configuration Validation

Validate your configuration:

```bash
xians config validate
```

## Next Steps

- Learn about [Agent Development](../user-guide/overview.md)
- Explore [API Reference](../api-reference/overview.md)
- Check out [Examples](https://github.com/XiansAiPlatform/samples)


