# ParentLog AI 🛋️

You deploy a private AI companion for parenting notes. No accounts. Your data stays within your own Cloudflare Worker.

**Live Demo:** [https://parentlog-ai.casey-digennaro.workers.dev](https://parentlog-ai.casey-digennaro.workers.dev)

---

## Why This Exists
Many parenting apps monetize user data. This project provides a self-contained alternative for logging child milestones and daily notes without sending personal details to a third-party service.

---

## Quick Start
1.  **Fork** this repository.
2.  **Deploy** your fork to Cloudflare Workers.
    ```bash
    npx wrangler deploy
    ```
3.  Add your LLM API key as a secret.
    ```bash
    npx wrangler secret put DEEPSEEK_API_KEY
    ```

Your instance is live after deployment completes.

---

## Features
*   Log sleep, daily notes, and milestones.
*   Get activity suggestions based on logged milestones.
*   All history persists in your Cloudflare KV storage.
*   Personal details (like names) are redacted client-side before any LLM API call.
*   Configurable for DeepSeek, other APIs, or local LLMs via a configurable endpoint.
*   Built-in, optional rate limiting.
*   Can receive silent, non-breaking updates via the Cocapn Fleet protocol.

---

## How It Works
A single-file Cloudflare Worker (`index.js`) serves the web interface, streams AI responses, and manages data. There are no external dependencies, databases, or build steps.

Fork the repository, modify the configuration if needed, and deploy. This is the entire workflow.

---

## Limitations
*   You are responsible for managing your own LLM API key and costs.
*   Data storage uses Cloudflare KV, which has limits on write operations per second (1 write per second per key). It is not designed for high-frequency, real-time logging.

---

Open source. MIT License.

Attribution: Superinstance and Lucineer (DiGennaro et al.)

<div style="text-align:center;padding:16px;color:#64748b;font-size:.8rem"><a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> &middot; <a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>