# Installing XiansAi Server

This guide walks you through installing and running the **XiansAi Server** — the core platform API and orchestration engine — using the official Docker images published to DockerHub. It covers the external services you need, every environment variable (app setting) the server understands, and how to run the container for staging and production.

!!! info "Where the Server fits"
    The XiansAi Server is the heart of the platform. Agents (built with the SDK) and [Agent Studio](../studio/installation.md) both connect to it. Bring the Server up first, [bootstrap it](bootstrapping.md) to mint your first API key, then point Agent Studio and your agents at it.

## The official Docker image

The platform team publishes multi-platform images to DockerHub as **`99xio/xiansai-server`**.

| Detail | Value |
| --- | --- |
| Image | `99xio/xiansai-server` |
| Platforms | `linux/amd64`, `linux/arm64` (Apple Silicon) |
| Container port | `8080` (HTTP only) |
| Health endpoint | `GET /health` |

Available tags follow semantic versioning. For a release `v2.0.0` you can pull `2.0.0`, `2.0`, `2`, or `latest`. Pre-releases (e.g. `2.0.0-beta`) are published too, but **never** update the `latest` tag.

!!! tip "Pin a version in production"
    Prefer an explicit tag such as `99xio/xiansai-server:2.0.0` over `latest` so deployments are reproducible.

```bash
docker pull 99xio/xiansai-server:latest
```

## Prerequisites

The Server is stateless itself, but it depends on two external services. Provision these before starting the container.

| Dependency | Purpose |
| --- | --- |
| **MongoDB** (replica set) | Primary data store. A replica set is required because the server uses transactions. |
| **Temporal** | Workflow orchestration engine that runs agent workflows. |
| **Docker Engine** | 20.10+ (and optionally Docker Compose 2.0+). |

Redis (distributed cache) and Azure Communication Services (outbound email) can be added later — see [optional settings](#optional-settings).

## Configuration: environment variables

All settings are supplied as environment variables using the standard .NET convention where `:` in a configuration path becomes `__` (double underscore). For example, the setting `MongoDB:ConnectionString` is provided as `MongoDB__ConnectionString`.

The recommended approach is to keep these in an `.env` file and pass it to the container with `--env-file`.

### Minimal `.env` to get started

Only the variables below are mandatory — everything else has sensible defaults. Copy this template, fill in the values (the sections that follow explain how to obtain each one), and you can start the server.

```bash
# MongoDB (must be a replica set)
MongoDB__ConnectionString=mongodb://user:password@mongodb:27017/xians?replicaSet=rs0&authSource=xians
MongoDB__DatabaseName=xians

# Temporal
Temporal__FlowServerUrl=temporal:7233
Temporal__FlowServerNamespace=default

# Encryption keys — generate each with: openssl rand -base64 32
EncryptionKeys__BaseSecret=<random-base64>
EncryptionKeys__UniqueSecrets__ConversationMessageKey=<random-base64>
EncryptionKeys__UniqueSecrets__TenantOidcSecretKey=<random-base64>
EncryptionKeys__UniqueSecrets__SecretVaultKey=<random-base64>

# Root CA certificate — see "Certificates" below for generation steps
Certificates__AppServerPfxBase64=<base64-encoded-pfx>
Certificates__AppServerCertPassword=<pfx-password>
```

### General

| Variable | Default | Description |
| --- | --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` | `Development`, `Staging`, or `Production`. |
| `ASPNETCORE_URLS` | `http://+:8080` | Bind address. Keep HTTP-only in Docker; terminate TLS at your load balancer. |
| `SERVICE_TYPE` | `--all` | Which service(s) to run: `--all`, `--web`, `--lib`, or `--user`. See [running as microservices](#running-as-separate-microservices). |
| `CONFIG_NAME` | — | A label for the active configuration (useful for diagnostics). |

### Database (MongoDB) — required

```bash
MongoDB__ConnectionString=mongodb://user:password@mongodb:27017/xians?replicaSet=rs0&authSource=xians
MongoDB__DatabaseName=xians
```

Connection pool tuning is optional (defaults shown):

```bash
MongoDB__MaxConnectionPoolSize=100
MongoDB__MinConnectionPoolSize=5
```

!!! warning "Replica set required"
    The connection string must point at a MongoDB **replica set** (`replicaSet=...`). The server relies on multi-document transactions, which standalone MongoDB does not support.

**Where to get the connection string:**

- **MongoDB Atlas** (managed): create a cluster, then copy the connection string from *Connect → Drivers*. Atlas clusters are always replica sets, so no extra configuration is needed.
- **Self-hosted**: start `mongod` with `--replSet rs0` and initialize it once with `rs.initiate()` from `mongosh`. Then use `mongodb://<user>:<password>@<host>:27017/xians?replicaSet=rs0&authSource=<auth-db>`.

### Temporal workflow engine — required

```bash
Temporal__FlowServerUrl=temporal:7233
Temporal__FlowServerNamespace=default
```

Optionally, if agents connect from outside your Docker network via a different hostname:

```bash
Temporal__FlowServerUrlExternal=temporal.your-domain.com:7233
```

**Where to get these values:**

- `FlowServerUrl` is the `host:port` of the Temporal **frontend service** as reachable from inside the server container. A self-hosted Temporal (e.g. via [temporal docker-compose](https://github.com/temporalio/docker-compose)) listens on port `7233` by default.
- `FlowServerNamespace` is the Temporal namespace to run workflows in. Self-hosted setups ship with `default`; for Temporal Cloud use your namespace (e.g. `my-namespace.a1b2c`) and the endpoint shown in the Temporal Cloud console.
- `FlowServerUrlExternal` is the endpoint handed to agents; it defaults to `FlowServerUrl` when omitted.

### Encryption keys — required

The server encrypts sensitive data at rest (chat messages, tenant OIDC secrets, and the secret vault). Generate each key with `openssl rand -base64 32` and use **different** values per environment.

```bash
# Foundational secret (min 32 chars)
EncryptionKeys__BaseSecret=<random-base64>

# Per-purpose unique secrets
EncryptionKeys__UniqueSecrets__ConversationMessageKey=<random-base64>
EncryptionKeys__UniqueSecrets__TenantOidcSecretKey=<random-base64>
EncryptionKeys__UniqueSecrets__SecretVaultKey=<random-base64>
```

!!! danger "Keep keys stable and safe"
    Store these in your secret manager. If they change or are lost, previously encrypted data can no longer be decrypted. See [Chat Message Encryption](encryption.md) for details.

### Certificates — required

The server acts as its own certificate authority: it uses a root CA certificate to sign the client certificates that agents authenticate with. Supply that root CA as a password-protected, base64-encoded PFX (PKCS#12) bundle containing **both the certificate and its private key**.

```bash
Certificates__AppServerPfxBase64=<base64-encoded-pfx>
Certificates__AppServerCertPassword=<pfx-password>
```

**Generating the root certificate** with `openssl`:

```bash
# 1. Generate a private key for the CA
openssl genrsa -out ca.key 4096

# 2. Create a self-signed root CA certificate (valid 10 years).
#    The CA basic constraint is required — the server looks for it when loading the bundle.
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 \
  -subj "/O=YourOrganization/CN=XiansAi Root CA" \
  -addext "basicConstraints=critical,CA:true" \
  -addext "keyUsage=critical,digitalSignature,keyCertSign,cRLSign" \
  -out ca.crt

# 3. Bundle the certificate and key into a password-protected PFX
openssl pkcs12 -export -out ca.pfx -inkey ca.key -in ca.crt \
  -passout pass:<pfx-password>

# 4. Base64-encode the PFX as a single line (portable across macOS/Linux)
openssl base64 -A -in ca.pfx -out ca.pfx.base64
```

Set `Certificates__AppServerPfxBase64` to the contents of `ca.pfx.base64` and `Certificates__AppServerCertPassword` to the password you chose in step 3. Alternatively, the server repository ships a ready-made script that does all of the above: [`infra/root-cert-gen.sh`](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Src/infra/root-cert-gen.sh) (run it as `./root-cert-gen.sh -p <pfx-password>`).

!!! danger "Protect the CA key"
    Anyone holding this PFX and password can mint valid agent certificates for your platform. Store both in your secret manager, never commit them, and use a different certificate per environment. Rotating the certificate invalidates all previously issued agent certificates.

### CORS — optional

Only needed when browser-based clients (e.g. custom apps calling the UserAPI) call the server directly. Set the origins they are served from; array entries use index notation. Defaults to no allowed origins.

```bash
Cors__AllowedOrigins__0=https://custom-ui.your-domain.com
Cors__AllowedOrigins__1=https://app.your-domain.com
```

### Optional settings

None of these are needed to get started — the defaults work out of the box.

```bash
# Caching: "memory" (default) or "redis".
# Use Redis when running multiple server replicas so they share cache state.
Cache__Provider=memory
Cache__Redis__ConnectionString=

# Email: "console" (default, prints to logs) or "azure" (Azure Communication Services).
# Used for tenant user-invitation emails.
Email__Provider=console
Email__Azure__ConnectionString=
Email__Azure__SenderEmail=

# WebSockets
WebSockets__Enabled=true

# Logging
Logging__LogLevel__Default=Information
Logging__LogLevel__Microsoft.AspNetCore=Warning

# Data Protection keys directory (see "Persisting Data Protection keys")
DataProtection__KeysDirectory=/app/keys
```

## Running the Server

### 1. Create your environment file

Create an `.env` file with your real values — start from the [minimal template](#minimal-env-to-get-started) above and add optional settings as needed.

```bash
# Generate the random secrets you'll need
openssl rand -base64 32   # run once per encryption key
```

For the certificate PFX, follow the steps in [Certificates — required](#certificates-required).

### 2. Run the container

```bash
docker run -d \
  --name xiansai-server \
  --env-file .env \
  -p 5001:8080 \
  --restart unless-stopped \
  99xio/xiansai-server:latest
```

| Parameter | Description |
| --- | --- |
| `-d` | Run detached (in the background). |
| `--name xiansai-server` | Name the container. |
| `--env-file .env` | Load all app settings from your env file. |
| `-p 5001:8080` | Map host port `5001` to the container's HTTP port `8080`. |
| `--restart unless-stopped` | Restart automatically unless you stop it. |

### 3. Verify

```bash
curl http://localhost:5001/health
# Healthy
```

```bash
# Follow logs
docker logs -f xiansai-server
```

### 4. Bootstrap the platform

A fresh server has no users or tenants. Initialize it and obtain your first API key:

```bash
curl "http://localhost:5001/api/v1/admin/bootstrap?email=admin@your-domain.com"
```

See [Platform Bootstrapping](bootstrapping.md) for the full flow, then point [Agent Studio](../studio/installation.md) at the server using the returned key.

## Running with Docker Compose

For a self-contained deployment you can define the server alongside its dependencies. The snippet below shows the server service; add your own MongoDB (as a replica set) and Temporal services, or point at managed instances.

```yaml
services:
  xiansai-server:
    image: 99xio/xiansai-server:latest
    ports:
      - "5001:8080"
    env_file:
      - .env
    restart: unless-stopped
    volumes:
      - xiansai-keys:/app/keys
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s

volumes:
  xiansai-keys:
```

```bash
docker compose up -d
docker compose logs -f xiansai-server
```

!!! tip "One-command local platform"
    To spin up the Server together with MongoDB, Temporal, Keycloak, and Agent Studio for evaluation, use the [Community Edition](https://github.com/XiansAiPlatform/community-edition) repository, which wires everything together with Docker Compose.

## Persisting Data Protection keys

ASP.NET Core Data Protection keys are used to protect tokens and cookies. In production the container writes them to `/app/keys`, which is exposed as a Docker volume. **Mount a persistent (and, for multiple replicas, shared) volume there** so keys survive restarts and are consistent across instances.

```bash
docker run -d \
  --name xiansai-server \
  --env-file .env \
  -p 5001:8080 \
  -v xiansai-keys:/app/keys \
  99xio/xiansai-server:latest
```

Override the location with `DataProtection__KeysDirectory` if needed. If keys are not persisted, users may be logged out and encrypted cookies invalidated on every restart.

## Running as separate microservices

The server can run as one combined process (default) or as independent, separately scalable services via `SERVICE_TYPE`:

| `SERVICE_TYPE` | Service | Responsibility |
| --- | --- | --- |
| `--all` | All (default) | Everything in one process. |
| `--web` | WebApi | Client-facing endpoints (`api/client/*`). |
| `--lib` | LibApi | Server-to-server / agent endpoints (`api/server/*`). |
| `--user` | UserApi | User-facing endpoints, webhooks, and websockets. |

Run each as its own container with the appropriate `SERVICE_TYPE` to scale them independently. See [Scaling](scaling.md) for guidance.

## Updating

```bash
# Docker Compose
docker compose pull && docker compose up -d

# Plain docker run
docker pull 99xio/xiansai-server:latest
docker rm -f xiansai-server
docker run -d --name xiansai-server \
  --env-file .env -p 5001:8080 -v xiansai-keys:/app/keys \
  --restart unless-stopped 99xio/xiansai-server:latest
```

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Container exits immediately | Inspect `docker logs xiansai-server`. Usually a missing required variable or an unreachable dependency. |
| `Unable to configure HTTPS endpoint` | The app tried to bind HTTPS. Keep `ASPNETCORE_URLS=http://+:8080` and terminate TLS at your load balancer. |
| Cannot connect to MongoDB / transaction errors | Ensure the connection string targets a **replica set** and credentials/`authSource` are correct. |
| Cannot connect to Temporal | Verify `Temporal__FlowServerUrl` is reachable from inside the container. |
| `409 Conflict` on bootstrap | The platform already has users; bootstrapping only works on an empty database. See [Bootstrapping](bootstrapping.md). |
| Users logged out after restart | Data Protection keys aren't persisted — mount a volume at `/app/keys`. |
| Health check failing | Confirm the app is listening on `8080`, dependencies are reachable, and required env vars are set. |
| Port already in use | Change the host mapping, e.g. `-p 5002:8080`. |

## What's next?

- **[Platform Bootstrapping](bootstrapping.md)** — initialize a fresh server and mint your first API key.
- **[Installing Agent Studio](../studio/installation.md)** — stand up the web console against this server.
- **[Scaling](scaling.md)** — run and scale the server and agents.
- **[Chat Message Encryption](encryption.md)** — how encryption keys protect data at rest.
