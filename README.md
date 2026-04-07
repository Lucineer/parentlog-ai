<p align="center">
  <img src="https://raw.githubusercontent.com/Lucineer/capitaine/master/docs/capitaine-logo.jpg" alt="Capitaine" width="120">
</p>

<h1 align="center">parentlog-ai</h1>

<p align="center">A parent-focused memory vessel for Cloudflare Workers.</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#the-fleet">The Fleet</a> ·
  <a href="https://parentlog-ai.casey-digennaro.workers.dev">Live Demo</a> ·
  <a href="https://github.com/Lucineer/parentlog-ai/issues">Issues</a>
</p>

---

parentlog-ai is a forked vessel for private parenting notes. It logs patterns like sleep and milestones, suggests activities, and maintains context between sessions. It runs as a single-file Cloudflare Worker with no database or external analytics.

This is a personal tool you host. All data stays within your worker, and changes only happen when you update your fork.

**Built with [Capitaine](https://github.com/Lucineer/capitaine) · [Cocapn](https://github.com/Lucineer/cocapn)**

## Quick Start

1.  Fork this repository.
2.  Clone your fork and navigate to it.
3.  Set your Cloudflare and API keys as secrets:
    ```bash
    npx wrangler secret put GITHUB_TOKEN
    npx wrangler secret put DEEPSEEK_API_KEY # or another supported key
    ```
4.  Deploy:
    ```bash
    npx wrangler deploy
    ```

Your vessel is now running at your `*.workers.dev` URL.

## Features

### Core Functions
- Log daily notes, sleep times, and milestones.
- Review recent patterns and generate gentle activity suggestions.
- Maintain persistent session memory via KV storage.
- Automatically redact personal information before LLM calls.

### Technical Notes
- **BYOK v2**: Keys are stored via Cloudflare Secrets, not in code.
- **Multi-model**: Supports DeepSeek, SiliconFlow, DeepInfra, and local models.
- **Rate Limiting**: Basic per-IP rate limiting for the public demo endpoint.
- **CRP-39**: Optional fleet coordination for updates via the git-based protocol.

### Limitations
- Memory is stored in Cloudflare KV with a 512KB limit per namespace. Extensive logs over many months may require manual archiving.

## Architecture

Single-file Cloudflare Worker (`src/worker.ts`) with zero runtime dependencies and no build step. It serves inline HTML, handles user input, manages context windows, and interfaces with external LLM APIs.

## The Fleet

parentlog-ai is part of the Cocapn Fleet—independent, open-source agent vessels. Fleet members can optionally coordinate updates and share trusted patterns via the CRP-39 protocol.

---
<div align="center">
  <a href="https://the-fleet.casey-digennaro.workers.dev">The Fleet</a> · 
  <a href="https://cocapn.ai">Cocapn</a><br/>
  <sub>Attribution: Superinstance & Lucineer (DiGennaro et al.). MIT Licensed.</sub>
</div>