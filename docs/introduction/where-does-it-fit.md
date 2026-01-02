# Where Does it Fit?

Xians is designed to integrate seamlessly into your existing architecture as a dedicated **Agent Microservice**. It sits between your web server and your AI agents, handling all agent management, orchestration, and communication.

## Systems Architecture

![Xians Architecture](../assets/images/illustrations/Slide1.png)

The diagram above illustrates how Xians fits into a typical microservices architecture:

1. **Your Product UI** - Your frontend application where users interact with your product
2. **Your Web Server** - Your backend/BFF (Backend for Frontend) layer that handles UI logic
3. **Agent Microservice (Xians Server)** - The dedicated service for managing AI agents
4. **Your Agents** - The AI agents that perform tasks and interact with users

### Direct Integration Option

Alternatively, the Xians Server can use OIDC to connect directly with your web UI in scenarios where a BFF/Web Server layer is not mediating the communication. Developers may use the **Xians TypeScript SDK** (Optional) to easily integrate with the server's APIs.

## Subcomponents

Xians is built with a modular architecture comprising the following major components:

![Xians Components](../assets/images/illustrations/Slide2.png)

1. **Xians Server** - The core orchestration engine that provides APIs for agents and external applications to interact with the platform
2. **Xians UI** - A comprehensive web interface for managing and controlling all aspects of your agents (serves as an alternative to direct API integration)
3. **Xians Lib** - A .NET Core class library that agents use to establish connections and communicate with the Xians server
