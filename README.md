# <img src="https://raw.githubusercontent.com/xsip/lm-studio-extender/refs/heads/main/apps/ui/public/logo-cropped.png" alt="Logo" width="30"/> LM Studio Extender | [Preview on youtube](https://www.youtube.com/watch?v=_UhKke10JzY)  

A full-stack AI chat client that connects to a locally running [LM Studio](https://lmstudio.ai/) instance via both its native API and its OpenAI-compatible `responses/create` endpoint. Built with Angular, NestJS, and MongoDB, with first-class MCP (Model Context Protocol) tool support, AI image generation via [InvokeAI](https://invoke-ai.github.io/InvokeAI/), image upload into chat, and optional end-to-end AES message encryption.

---
![Header](https://raw.githubusercontent.com/xsip/lm-studio-extender/refs/heads/main/img_3.png)
---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [MCP Tool Integration](#mcp-tool-integration)
- [Image Generation (InvokeAI)](#image-generation-invokeai)
- [Image Upload](#image-upload)
- [Message Encryption](#message-encryption)
- [Authentication & Authorization](#authentication--authorization)
- [Token Usage & Rate Limiting](#token-usage--rate-limiting)
- [API Overview](#api-overview)

---

## Overview

This monorepo hosts two applications:

| App | Location | Description |
|-----|----------|-------------|
| `api` | `apps/api` | NestJS REST backend, MCP server, and LM Studio proxy |
| `ui` | `apps/ui` | Angular 21 single-page chat interface |

The backend acts as an authenticated proxy between the Angular frontend and LM Studio. All chat sessions are persisted in MongoDB, token usage is tracked per user, and the backend exposes itself as an MCP server so LM Studio can call back into it during inference. The MCP toolset now includes an image generation tool that connects to a local InvokeAI instance, and uploaded images are stored as binary blobs in MongoDB and served back through the API.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Angular UI (port 4200)               │
│   LM Studio API route │ OpenAI Responses API route       │
└───────────────┬───────────────────────┬──────────────────┘
                │ SSE stream             │ SSE stream
┌───────────────▼───────────────────────▼──────────────────┐
│                 NestJS API (port 8888)                    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ LmStudio     │  │ OpenAI       │  │ Auth / JWT     │  │
│  │ Module       │  │ Module       │  │ Module         │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────────┘  │
│         │                 │                               │
│  ┌──────▼─────────────────▼───────┐  ┌────────────────┐  │
│  │     Chats / ChatMetadata       │  │ MCP Server     │  │
│  │     MongoDB persistence        │  │ (@rekog/mcp-   │  │
│  └────────────────────────────────┘  │  nest)         │  │
│                                      └────────┬───────┘  │
│  ┌─────────────────────────────────────────┐  │           │
│  │  Assets Module                          │  │           │
│  │  Image blobs stored in MongoDB          │  │           │
│  └─────────────────────────────────────────┘  │           │
└──────────────────────────────────────────────┼───────────┘
                                               │ MCP callback (SSE / HTTP)
┌──────────────────────────────────────────────▼───────────┐
│                     LM Studio (port 1234)                │
│            /api/v1/chat  │  /v1/responses/create         │
└──────────────────────────────────────────────────────────┘
                           │ generate-image-tool triggers
┌──────────────────────────▼───────────────────────────────┐
│                   InvokeAI (port 9090)                   │
│     /api/v2/models  │  /api/v1/queue/default/enqueue     │
│     Socket.IO  (/ws/socket.io/)                          │
└──────────────────────────────────────────────────────────┘
```

During inference, LM Studio calls back into the NestJS MCP server with the user's JWT token forwarded in the `Authorization` header, so MCP tools have full access to the authenticated user's context.

---

## Features

- **Dual API modes** — use LM Studio's native `/api/v1/chat` endpoint or the OpenAI-compatible `/v1/responses/create` endpoint from the same UI
- **OpenAI completions endpoint** — additional support for `/v1/chat/completions` (streaming)
- **Real-time SSE streaming** — responses are streamed token-by-token to the browser
- **Persistent chat history** — every exchange is stored in MongoDB and rehydrated on demand
- **Conversation continuity** — `previous_response_id` chaining keeps multi-turn context alive across page refreshes
- **MCP tool server** — the backend registers itself as an MCP server; LM Studio can call tools mid-inference
    - `get-token-usage-tool` — returns the authenticated user's current token usage and limit
    - `decrypt-message-tool` — decrypts an AES-encrypted user message at inference time
    - `greeting-tool` — example tool with progress reporting
    - `generate-image-tool` — generates an image via InvokeAI from a natural-language prompt and injects it into the chat as a persistent asset
- **AI image generation** — the model can call `generate-image-tool` during inference; the backend submits a txt2img job to InvokeAI, downloads the result, stores it in MongoDB, and returns a Markdown image reference to the chat
- **Image upload** — users can attach one or more images before sending a message; images are uploaded to MongoDB via the Assets API and forwarded to the model as vision content
- **End-to-end AES message encryption** — per-chat opt-in; messages are encrypted with CryptoJS AES before leaving the browser, and the model decrypts them via MCP during inference
- **JWT authentication** — login / register with bcrypt-hashed passwords; tokens expire after 1 hour
- **Role-based access control** — `User` and `Admin` roles via `RolesGuard`
- **Subscription-aware token rate limiting** — configurable token budgets per subscription tier (`free` / `basic`), with automatic reset intervals
- **Model selector** — dynamically fetches available models from the running LM Studio instance
- **Reasoning mode** — pass reasoning effort (`off` / `low` / `medium` / `high`) to supported models
- **Swagger UI** — optional OpenAPI documentation (enabled via `USE_SWAGGER=true`)
- **Markdown rendering** — assistant responses rendered as formatted Markdown in the chat UI

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21, TailwindCSS 4, RxJS 7 |
| Backend | NestJS 11, TypeScript 5.9 |
| Database | MongoDB via Mongoose |
| MCP | `@rekog/mcp-nest` (Streamable HTTP + SSE transports) |
| Image generation | InvokeAI (local, via REST API + Socket.IO) |
| Image storage | MongoDB (`image_blobs` collection, binary Buffer) |
| File upload | `@nestjs/platform-express` / Multer (memory storage) |
| Encryption | `crypto-js` (AES) |
| Auth | JWT (`@nestjs/jwt`), bcrypt |
| HTTP client | `@nestjs/axios` |
| OpenAI SDK | `openai` npm package (pointed at LM Studio base URL) |
| API docs | Swagger / OpenAPI (`@nestjs/swagger`) |

---

## Project Structure

```
apps/
├── api/                          # NestJS backend
│   └── src/
│       ├── app.module.ts         # Root module — MCP, Mongo, guards
│       ├── main.ts               # Bootstrap, CORS, Swagger, body-parser
│       ├── tools/
│       │   └── api.tools.ts      # MCP tools (greeting, token-usage, decrypt, generate-image)
│       └── modules/
│           ├── auth/             # JWT auth, guards, user schema
│           ├── assets/           # Image blob storage & retrieval (MongoDB)
│           ├── chats/            # Chat message persistence
│           ├── chat-metadata/    # Per-session metadata (model, crypto config, etc.)
│           ├── invoke/           # InvokeAI integration (image generation)
│           ├── lm-studio/        # Native LM Studio API proxy + streaming
│           ├── openai/           # OpenAI-compatible responses + completions proxy
│           └── token-limit/      # Token budget tracking & rate-limit enforcement
└── ui/                           # Angular frontend
    └── src/app/
        ├── app.ts                # Root component — JWT expiry guard
        ├── lmstudio-stream.service.ts   # SSE client for LM Studio API
        ├── openai-stream.service.ts     # SSE client for OpenAI Responses API
        ├── client/               # Auto-generated API client DTOs
        └── routes/
            ├── login.ts          # Login / register page
            ├── lm-studio-api/    # Chat UI for native LM Studio endpoint
            │   ├── chat-input.component.ts
            │   ├── chat-messages.component.ts  # Renders text, images, tool calls
            │   ├── chat-sidebar.component.ts
            │   ├── model-selector.component.ts
            │   └── info.component.ts
            └── openai-api/       # Chat UI for OpenAI Responses endpoint
                ├── chat-input.component.ts     # Includes image attach button
                ├── chat.service.ts
                └── model-selector.component.ts
```

---

## Prerequisites

- **Node.js** 18+
- **MongoDB** running locally (default: `mongodb://localhost:27017/lmStudioWrapper`) or a remote URI
- **LM Studio** running locally with the local server enabled (default: `http://localhost:1234`)
- A loaded model in LM Studio that supports tool/function calling for MCP features
- **InvokeAI** *(optional)* — required only for AI image generation; default: `http://127.0.0.1:9090`

---

## Environment Variables

Create a `.env` file in `apps/api/` (or set variables in your shell):

```env
# MongoDB connection URI
MONGODB_URI=mongodb://localhost:27017/lmStudioWrapper

# LM Studio local server
LM_STUDIO_BASE_URL=http://localhost:1234
LM_STUDIO_API_TOKEN=                        # optional — set if LM Studio requires a token

# JWT signing secret — use a long random string in production
JWT_SECRET=your-very-secret-key

# URL the backend advertises to LM Studio for MCP callbacks
# Must be reachable FROM LM Studio (use your machine's LAN IP if running in Docker)
SELF_MCP_URL=http://192.168.0.34:8888/tools/mcp

# Public base URL of this backend — used to construct asset URLs returned by generate-image-tool
# Must be reachable from the browser (e.g. http://localhost:8888 or your LAN IP)
SELF_URL=http://localhost:8888

# Backend HTTP port (default: 8888)
PORT=8888

# Set to any non-empty value to enable Swagger UI at /api
USE_SWAGGER=true
```

> **Note on `SELF_MCP_URL`:** LM Studio calls this URL during inference to invoke MCP tools. It must be the address where the NestJS server is reachable from LM Studio's perspective, not `localhost`, if LM Studio is running in a separate process or container.

> **Note on `SELF_URL`:** Used by `generate-image-tool` to build the public image URL returned to the chat. Set this to the address the browser uses to reach the NestJS API. If omitted, asset links will be broken.

> **Note on InvokeAI base URL:** The InvokeAI base URL is currently hard-coded to `http://127.0.0.1:9090` in `app.module.ts` (`InvokeModule.forRoot(...)`). Change this value directly if your InvokeAI instance runs elsewhere.

---

## Getting Started

### 1. Install dependencies

```bash
# From the monorepo root
npm install
```

### 2. Start the API

```bash
nx serve api
```

The API will be available at `http://localhost:8888`.  
If `USE_SWAGGER=true`, Swagger UI is at `http://localhost:8888/api`.

### 3. Start the UI

```bash
nx serve ui
```

The UI will be available at `http://localhost:4200`.

### 4. Start both simultaneously

```bash
npm start
# runs: nx run-many --target=serve --projects=api,ui
```

### 5. Register a user

Either use the Swagger UI or send a `POST /auth/register` request:

```bash
curl -X POST http://localhost:8888/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "s3cret"}'
```

Then log in at `POST /auth/login` to receive a JWT.

---

## MCP Tool Integration

![Header](https://raw.githubusercontent.com/xsip/lm-studio-extender/refs/heads/main/apps/ui/public/mcp-preview-light.png)

The NestJS backend registers itself as an MCP server using `@rekog/mcp-nest`. It exposes two transports at `http://localhost:8888/tools/mcp`:

- **Streamable HTTP** (with JSON response mode enabled)
- **SSE**

When the backend initiates a chat request to LM Studio, it injects an `ephemeral_mcp` integration pointing to `SELF_MCP_URL` with the user's JWT forwarded in the `Authorization` header. This means any MCP tool called by the model during inference has access to the authenticated user's data.

### Available Tools

| Tool | Description |
|------|-------------|
| `get-token-usage-tool` | Returns the user's current token consumption, subscription tier, limit, and next reset time |
| `decrypt-message-tool` | Decrypts an AES-encrypted user message using the per-chat crypto key stored in `chat_metadata` |
| `greeting-tool` | Example tool — returns a greeting with streaming progress updates |
| `generate-image-tool` | Generates an image from a text prompt via InvokeAI, stores it in MongoDB, and returns a chat-renderable image URL |

To add new tools, create an `@Injectable()` class in `apps/api/src/tools/`, decorate methods with `@Tool(...)` from `@rekog/mcp-nest`, and register the class as a provider in `AppModule`.

---

## Image Generation (InvokeAI)

The `generate-image-tool` MCP tool allows the language model to generate images on demand during a conversation. It requires a locally running [InvokeAI](https://invoke-ai.github.io/InvokeAI/) instance.

### How It Works

1. **Tool call** — the model calls `generate-image-tool` with a natural-language `prompt` string.
2. **Model lookup** — `InvokeService` queries InvokeAI's `/api/v2/models/` endpoint and finds the first model whose name contains the requested model name (default: `"Dreamshaper 8"`).
3. **Job submission** — a txt2img pipeline graph is constructed (512 × 512, 30 steps, `dpmpp_3m_k` scheduler, CFG 7.5) and submitted to InvokeAI's queue via `POST /api/v1/queue/default/enqueue_batch`.
4. **Socket.IO listener** — the service opens a Socket.IO connection to InvokeAI (`/ws/socket.io/`) and subscribes to the `default` queue. It waits for an `invocation_complete` event containing the generated image name.
5. **Download & persist** — the generated image is downloaded from InvokeAI's `/api/v1/images/i/{name}/full` endpoint and stored as a binary blob in MongoDB via `AssetsService`.
6. **URL construction** — a public asset URL is returned to the model in the form `{SELF_URL}/assets/filequery/{filename}?userId=...&chatId=...`. The model renders this as a Markdown image reference in the chat.

### InvokeAI Configuration

The InvokeAI base URL defaults to `http://127.0.0.1:9090` and is set in `AppModule`:

```typescript
InvokeModule.forRoot('http://127.0.0.1:9090')
```

Change this value to match your InvokeAI installation. Make sure InvokeAI has at least one SD1.x-compatible model loaded (e.g. Dreamshaper 8) for the default pipeline to work.

---

## Image Upload

Users can attach images to their chat messages before sending. Uploaded images are stored in MongoDB and forwarded to the model as vision content.

### How It Works

1. **Frontend** — the chat input component (OpenAI API route) includes an **Attach** button that opens a native file picker. Multiple images can be attached in a single message. Attached files are listed below the textarea with their filename and size; individual files can be removed before sending.
2. **Upload** — on send, each attached image is `POST`-ed to `POST /assets/:chatId` as `multipart/form-data`. The backend validates the MIME type (JPEG, PNG, WebP, GIF, AVIF), limits file size to **10 MB**, and stores the raw binary in the `image_blobs` MongoDB collection.
3. **Retrieval** — images are served back via:
    - `GET /assets/:chatId/:filename` — authenticated endpoint (uses the JWT of the requesting user)
    - `GET /assets/filequery/:filename?chatId=...&userId=...` — public endpoint used by the `generate-image-tool` return value so the browser can display AI-generated images without an extra auth header
4. **In-chat rendering** — the chat messages component renders uploaded user images inline inside the user's message bubble. AI-generated images returned by the model as Markdown image tags are rendered by the Markdown pipe.

### Supported Formats

| Format | MIME type |
|--------|-----------|
| JPEG | `image/jpeg`, `image/jpg` |
| PNG | `image/png` |
| WebP | `image/webp` |
| GIF | `image/gif` |
| AVIF | `image/avif` |

Maximum file size: **10 MB** per file.

---

## Message Encryption

Per-chat AES-256 message encryption can be opted into when creating a new chat session on the OpenAI Responses API route. The goal is to keep plaintext message content out of LM Studio's own message store — only ciphertext is ever forwarded to the model server.

### How It Works

The encryption is powered by [CryptoJS](https://github.com/brix/crypto-js) (`crypto-js ^4.2`) on both ends, using AES in CBC mode with a per-chat secret key that lives exclusively in MongoDB.

**End-to-end flow:**

1. **Session creation** — when the user enables encryption for a new chat, a `cryptoKey` is generated and stored in the `chat_metadata` document alongside `useCrypto: true`. The key never leaves the server.

2. **Message encryption (backend)** — before each request is forwarded to LM Studio, `OpenAiService.encryptChatMessage()` walks the entire input array and replaces every plaintext `content` string (or `text` field inside content parts) with its AES ciphertext:
   ```
   CryptoJS.AES.encrypt(plaintext, cryptoKey).toString()
   ```
   This means LM Studio only ever receives — and stores — opaque ciphertext.

3. **System prompt injection** — alongside the encrypted messages, the backend injects a developer-turn instruction that instructs the model to:
    - **Always** call `decrypt-message-tool` first, passing the full unmodified user message
    - Completely ignore the original encrypted input after receiving the tool response
    - Treat the decrypted text as the real user message and answer it directly
    - Never mention the decryption step in its response

4. **MCP decryption at inference time** — LM Studio calls back into the NestJS MCP server via the `decrypt-message-tool`. The tool receives the ciphertext, looks up the `cryptoKey` from `chat_metadata` using the `chatId` header forwarded with the request, and returns the plaintext to the model:
   ```
   CryptoJS.AES.decrypt(ciphertext, cryptoKey).toString(CryptoJS.enc.Utf8)
   ```

5. **Transparent response** — the model answers the decrypted question normally. From the user's perspective the conversation flows as usual; the encrypt/decrypt cycle is invisible.

### Key Storage & Security Boundaries

| What | Where | Plaintext? |
|------|-------|-----------|
| `cryptoKey` | `chat_metadata` MongoDB document | ✅ Yes — treat MongoDB as a trusted boundary |
| Messages forwarded to LM Studio | LM Studio message store | ❌ No — always ciphertext |
| Messages in the browser → API request | HTTP body to NestJS | ✅ Yes — HTTPS in production |
| `chatId` forwarded to MCP tool | `chatId` request header | ✅ Yes — used for key lookup only |

> **Security note:** The encryption is designed to protect message content from being readable inside LM Studio's own conversation storage. The security boundary is your NestJS API + MongoDB — if those are compromised, the keys are accessible. Use HTTPS in any non-local deployment.

---

## Authentication & Authorization

- **Registration** — `POST /auth/register` creates a user with a bcrypt-hashed password. New accounts are inactive until an activation link is used.
- **Login** — `POST /auth/login` returns a signed JWT (1-hour expiry).
- **Guard** — `JwtAuthGuard` is applied globally as an `APP_GUARD`. Routes can be opted out with the `@Public()` decorator.
- **Roles** — `RolesGuard` enforces `@Roles(Role.Admin)` / `@Roles(Role.User)` decorators.
- **Token auto-refresh** — the Angular `App` root component checks JWT expiry on every navigation and redirects to `/login` when expired.

---

## Token Usage & Rate Limiting

Token consumption is tracked per user and enforced against subscription-tier limits configured in the `token_limit_configs` MongoDB collection.

| Field | Description |
|-------|-------------|
| `tokensPerInterval` | Maximum tokens allowed within one reset window |
| `minutesTillReset` | How many minutes until the counter resets |
| `subscription` | Which tier this config applies to (`free` or `basic`) |

After each completed inference, `TokenLimitService.updateUsedTokens()` increments the user's `usedTokens` counter. If the limit is reached, a `api.info` SSE event is emitted to the client with the reset timestamp. The counter resets automatically when `tokenCountResetDate` elapses.

Token limits can be managed via the `TokenLimitModule` controller.

---

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Create a new user account |
| `POST` | `/auth/login` | Authenticate and receive a JWT |
| `GET` | `/lm-studio/models` | List models available in LM Studio |
| `POST` | `/lm-studio/chat` | Non-streaming chat (LM Studio native API) |
| `POST` | `/lm-studio/chat/stream` | Streaming SSE chat (LM Studio native API) |
| `GET` | `/openai/models` | List models via OpenAI SDK |
| `POST` | `/openai/chat/stream` | Streaming SSE via OpenAI Responses API |
| `POST` | `/openai/completions/stream` | Streaming SSE via OpenAI Completions API |
| `GET` | `/chat-metadata` | List the user's chat sessions |
| `GET` | `/chat-metadata/:id` | Get a single chat session |
| `POST` | `/chat-metadata` | Create a chat session |
| `PATCH` | `/chat-metadata/:id` | Update a chat session |
| `DELETE` | `/chat-metadata/:id` | Delete a chat session |
| `GET` | `/chats/:chatId` | Retrieve messages for a session |
| `POST` | `/assets/:chatId` | Upload an image for a chat session |
| `GET` | `/assets/:chatId/:filename` | Retrieve an uploaded image (authenticated) |
| `GET` | `/assets/filequery/:filename?chatId=&userId=` | Retrieve an image by query params (public, used for AI-generated images) |
| `GET` | `/invoke/test` | Test endpoint — generates a sample image via InvokeAI |
| `GET` `/POST` | `/tools/mcp` | MCP server endpoint (SSE + Streamable HTTP) |

Full interactive documentation is available at `http://localhost:8888/api` when `USE_SWAGGER=true`.
