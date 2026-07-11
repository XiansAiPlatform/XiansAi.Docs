# Installing Agent Studio

This guide walks you through standing up **Agent Studio** — the web console for the XiansAi platform — against a XiansAi Server. It covers two paths:

- **Run locally** from source (for development or evaluation).
- **Run from DockerHub** using the published `99xio/agent-studio` image (for staging and production).

!!! info "New installations start here"
    If you are bringing up a **fresh** XiansAi Server, bootstrap the platform first ([Platform Bootstrapping](../server/bootstrapping.md)) so you have an API key and a tenant. Then come back here to point Agent Studio at that server.

## Prerequisites

| Path | Requirements |
| --- | --- |
| Local from source | Node.js 20+ (Next.js 16 requires `>=20.9.0`), npm, and Git. |
| DockerHub image | Docker Engine 20.10+ and (optionally) Docker Compose 2.0+. |
| Both | A reachable XiansAi Server URL and a valid `XIANS_APIKEY`. |

## Configuration: the `.env` file

Everything Agent Studio needs is supplied through environment variables. The repository ships an `.env.example` you can copy and fill in — it is the single source of truth for every supported setting.

Copy it to the file your run mode expects:

```bash
# Local development reads .env.local
cp .env.example .env.local

# Docker / production reads .env.production
cp .env.example .env.production
```

### Required variables

These must be set for Agent Studio to start and connect to the platform.

| Variable | Description |
| --- | --- |
| `XIANS_APIKEY` | The API key Agent Studio uses to call the platform. For a new install, use the key returned by the [bootstrap endpoint](../server/bootstrapping.md) (owned by a `SysAdmin`). |
| `XIANS_SERVER_URL` | Base URL of your XiansAi Server, e.g. `http://localhost:5005` locally or `https://your-xians-server.com` in production. |
| `NEXTAUTH_URL` | The public URL where Agent Studio itself is served. Must match how users reach it — `http://localhost:3010` locally, `https://your-domain.com` in production. |
| `NEXTAUTH_SECRET` | Secret used to sign session tokens. Generate one with `openssl rand -base64 32`. |

```bash
# Generate a NEXTAUTH_SECRET
openssl rand -base64 32
```

### Authentication providers (at least one)

Agent Studio signs users in via OAuth/OIDC. Configure **at least one** provider; leave the others empty to disable them.

| Provider | Variables | Notes |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials). |
| Microsoft / Azure AD | `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` | Use `organizations` (or `common`) as the tenant id for multi-tenant apps. |
| Keycloak | `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ISSUER` | Use a **confidential** client. Redirect URI: `{NEXTAUTH_URL}/api/auth/callback/keycloak`. The issuer must include the realm, e.g. `https://keycloak.example.com/realms/My_Realm`. |
| Visma Connect | `VISMA_CONNECT_CLIENT_ID`, `VISMA_CONNECT_ISSUER` | Register at [Visma Connect](https://oauth.developers.visma.com). Redirect URI: `{NEXTAUTH_URL}/api/auth/callback/visma-connect`. Issuer is `https://connect.identity.stagaws.visma.com` (staging) or `https://connect.visma.com` (production). |

!!! warning "Sign-in must match the bootstrap identity"
    The user id issued by your identity provider must exactly match the `email` used when you bootstrapped the server, otherwise the first login won't resolve to the `SysAdmin` account. See [Platform Bootstrapping](../server/bootstrapping.md).

### Application variables

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | `development` or `production`. |
| `PORT` | `3000` | Port the server binds to (the production container listens on `3000`; local `npm run dev` uses `3010`). |
| `HOSTNAME` | `0.0.0.0` | Bind address. `0.0.0.0` is required inside Docker. |

## Option A — Run locally from source

Best for development, customizing the UI, or evaluating against a local server.

```bash
# 1. Clone the repository
git clone https://github.com/XiansAiPlatform/agent-studio.git
cd agent-studio

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env.local
#    Then edit .env.local — set XIANS_SERVER_URL, XIANS_APIKEY,
#    NEXTAUTH_URL=http://localhost:3010, NEXTAUTH_SECRET, and a provider.

# 4. Start the dev server (hot reload, port 3010)
npm run dev
```

Open [http://localhost:3010](http://localhost:3010) and sign in.

To run a production build locally instead of the dev server:

```bash
npm run build
npm run start
```

## Option B — Run from DockerHub

The platform team publishes multi-platform (AMD64 + ARM64) images to DockerHub as **`99xio/agent-studio`**. This is the recommended path for staging and production — no source checkout or Node toolchain required.

### 1. Prepare the environment file

```bash
cp .env.example .env.production
# Edit .env.production with your real values:
#   XIANS_APIKEY, XIANS_SERVER_URL,
#   NEXTAUTH_URL=https://your-domain.com,
#   NEXTAUTH_SECRET (openssl rand -base64 32),
#   and at least one auth provider.
```

### 2. Pull and run the image

```bash
# Pull the latest stable image
docker pull 99xio/agent-studio:latest

# Run it
docker run -d \
  --name agent-studio \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  99xio/agent-studio:latest
```

Pin to a specific release instead of `latest` for reproducible deploys, e.g. `99xio/agent-studio:v1.0.0`.

### 3. Verify

```bash
curl http://localhost:3000/api/health
# {"status":"healthy","timestamp":"...","uptime":123}
```

Then browse to your `NEXTAUTH_URL` and sign in.

### Running with Docker Compose

If you prefer Compose, point a service at the published image and your env file:

```yaml
services:
  agent-studio:
    image: 99xio/agent-studio:latest
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

```bash
docker compose up -d
docker compose logs -f agent-studio
```

### Updating

```bash
docker compose pull && docker compose up -d
# or, for a plain docker run:
docker pull 99xio/agent-studio:latest
docker rm -f agent-studio && docker run -d --name agent-studio \
  -p 3000:3000 --env-file .env.production --restart unless-stopped \
  99xio/agent-studio:latest
```

## First-run checklist

1. **Server is up and bootstrapped** — you have a `XIANS_SERVER_URL` and a `SysAdmin` `XIANS_APIKEY`. See [Platform Bootstrapping](../server/bootstrapping.md).
2. **`.env` file filled in** — required variables set, plus at least one auth provider.
3. **`NEXTAUTH_URL` matches reality** — it must equal the URL users actually open, or sign-in callbacks fail.
4. **Redirect URIs registered** — for each enabled provider, register `{NEXTAUTH_URL}/api/auth/callback/<provider>`.
5. **Health check passes** — `GET /api/health` returns `healthy`.
6. **First login resolves to SysAdmin** — sign in with the identity whose user id equals the bootstrap `email`.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Container exits immediately | Inspect `docker logs agent-studio`. Usually a missing required env var. |
| Sign-in redirect loop or callback error | `NEXTAUTH_URL` doesn't match the URL you're using, or the provider redirect URI isn't registered. |
| `Node.js version ">=20.9.0" is required` | Local Node is too old. Install Node 20+. |
| Can't reach the platform | Check `XIANS_SERVER_URL` is reachable from the container/host and `XIANS_APIKEY` is valid. |
| First user isn't an admin | The signed-in user id doesn't match the bootstrap `email`. See [Platform Bootstrapping](../server/bootstrapping.md). |
| Port already in use | Change the host mapping, e.g. `-p 3001:3000`. |

## What's Next?

- **[Agent Studio Overview](overview.md)** — what the Studio does once it's running: roles, agent descriptors, tool logs, theming, uploads, and heartbeats.
- **[Platform Bootstrapping](../server/bootstrapping.md)** — initialize a fresh server and mint your first API key.
