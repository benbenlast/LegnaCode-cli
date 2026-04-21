# LegnaCode vs OpenAI Codex CLI

Feature comparison between LegnaCode v1.8.0 and OpenAI Codex CLI.

| Feature | LegnaCode | Codex CLI | Notes |
|---------|-----------|-----------|-------|
| **Sandbox** | Seatbelt (macOS) + seccomp (Linux) + container fallback | Seatbelt + bubblewrap + seccomp + Landlock | Both kernel-level; Codex has Landlock extra |
| **Exec Policy** | Static TOML rules (prefix/glob/regex) + defaults | Starlark-like DSL | LegnaCode simpler syntax, same effect |
| **Auto-Approval** | Guardian sub-agent (6-category risk taxonomy, fail-closed) | codex-auto-review model | Both dedicated approval; LegnaCode rule-based pre-filter |
| **Process Hardening** | core dump disable, ptrace detect, env sanitize | Same + LD_PRELOAD/DYLD clear | Equivalent |
| **Shell Escalation** | sandbox/escalate/deny 3-tier | sandbox/escalate/deny | Equivalent |
| **Network Policy** | Domain allowlist/denylist, 3 modes, audit log | HTTP+SOCKS5 proxy, MITM HTTPS | Codex has MITM; LegnaCode has audit log |
| **Secret Detection** | Regex patterns (AWS/GitHub/JWT/Slack/etc) + auto-redact | Phase-based with dedup | LegnaCode integrated into memory pipeline |
| **Memory** | 4-layer stack + vector search + SQLite + knowledge graph | 2-phase rollout + SQLite + watermark | LegnaCode richer (TF-IDF, temporal graph) |
| **Collaboration Modes** | 4 built-in (default/plan/execute/pair) + custom `.md` | 4 modes (default/plan/execute/pair) | Equivalent; LegnaCode templated + extensible |
| **JS REPL** | Public with `legnacode` bridge object | Persistent Node kernel with `codex.tool()` | Both bridge tool calls; LegnaCode public |
| **IDE Protocol** | JSON-RPC 2.0 (stdio + WebSocket) | JSON-RPC 2.0 (stdio + WebSocket) | Equivalent |
| **Multi-Agent** | Coordinator + TeamCreate + SendMessage + tmux | spawn/send/wait/close + AgentRegistry | LegnaCode has tmux integration |
| **Voice** | STT (voice_stream) + TTS (native/API) + WebRTC | WebRTC + WebSocket realtime | Both bidirectional; different backends |
| **Multi-Model** | OpenAI compat + Bedrock + Vertex + MiniMax + custom | OpenAI + Bedrock + Ollama + LM Studio | LegnaCode has MiniMax multimodal |
| **MCP** | Client + Server (`legnacode mcp-server`) | Client + Server (`codex mcp-server`) | Equivalent |
| **Hooks** | 6 lifecycle events | 6 lifecycle events | Equivalent |
| **Skills** | SKILL.md (YAML frontmatter) + Codex compat | SKILL.md (YAML frontmatter) | LegnaCode reads both formats |
| **Plugin System** | Marketplace + Codex plugin adapter | `.codex-plugin/plugin.json` | LegnaCode auto-converts Codex plugins |
| **Config Compat** | Reads `~/.codex/config.toml` auto-import | Native TOML config | LegnaCode bidirectional mapping |
| **SDK** | TypeScript + Python (with `Codex` alias) | TypeScript + Python | LegnaCode provides migration aliases |
| **Multimodal Tools** | 6 MiniMax tools (image/video/speech/music/vision/search) | None | LegnaCode exclusive |
| **Rollback** | Full implementation (timeline, dry-run, safe mode) | Built-in | Both functional |
| **Performance** | Rust NAPI (cosine/tfidf/hash/tokens) + TS fallback | Full Rust (70+ crates) | Codex all-Rust; LegnaCode hybrid |
| **Platform** | macOS + Linux + Windows (prebuilt binaries) | macOS + Linux + Windows | Equivalent |

## Migration from Codex

```bash
# Auto-import Codex config, MCP servers, skills
legna migrate --agents

# Or just start — ~/.codex/config.toml is auto-detected
legna
```

LegnaCode automatically:
- Reads `~/.codex/config.toml` as fallback settings
- Discovers `~/.codex/skills/` and loads Codex-format skills
- Detects `codex-plugin.json` in project directories
- Provides `Codex` alias in TypeScript/Python SDK for drop-in replacement
