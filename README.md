# parentlog-ai

<p align="center">
  <img src="https://raw.githubusercontent.com/Lucineer/capitaine/master/docs/capitaine-logo.jpg" alt="Capitaine" width="120">
</p>

<h3 align="center">Self-hosted parenting log with pattern recognition</h3>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#what-it-does">What It Does</a> ·
  <a href="#limitations">Limitations</a> ·
  <a href="#the-fleet">The Fleet</a> ·
  <a href="https://parentlog-ai.casey-digennaro.workers.dev">Live Demo</a> ·
  <a href="https://github.com/Lucineer/parentlog-ai/issues">Issues</a>
</p>

---

A private companion for tracking your child's daily patterns. You deploy it to your Cloudflare account, store data in your repository, and maintain control. It helps you notice sleep, feeding, and activity patterns without sharing your family's data.

## What It Does

- **Pattern tracking**: Log daily activities and see emerging routines
- **Contextual suggestions**: Get activity ideas based on time of day and previous patterns
- **Private hosting**: Runs on your Cloudflare account, stores data in your repository
- **Memory built over time**: Maintains context across days without external databases
- **Multiple LLM options**: Works with DeepSeek, SiliconFlow, DeepInfra, Moonshot, or local endpoints

## Quick Start

Fork this repository, then:
```bash
cd parentlog-ai
npx wrangler login
echo "your-github-token" | npx wrangler secret put GITHUB_TOKEN
echo "your-llm-key" | npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler deploy
```

Your instance will be available at your-worker.your-account.workers.dev.

## Limitations

- Requires technical setup (Cloudflare account, API keys)
- No mobile app—access via browser
- Pattern recognition depends on consistent logging
- Limited to one child per instance without configuration changes

## Architecture

Single-file Cloudflare Worker with zero runtime dependencies. All state stored in your repository. No external databases. Built on the Cocapn fleet protocol for coordinated self-improvement.

```
src/worker.ts     # Main application logic
lib/byok.ts       # Multi-model LLM routing
lib/pattern.ts    # Basic pattern detection
lib/memory.ts     # Git-based state persistence
```

> The repository is the agent. You maintain control.

Attribution: Superinstance & Lucineer (DiGennaro et al.)

---

<div align="center">
  <a href="https://the-fleet.casey-digennaro.workers.dev">The Fleet</a> ·
  <a href="https://cocapn.ai">Cocapn</a>
</div>