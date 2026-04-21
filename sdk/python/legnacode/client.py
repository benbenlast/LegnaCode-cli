"""
LegnaCode client — main entry point for the Python SDK.

Spawns (or connects to) a legnacode app-server process and
exposes thread management via JSON-RPC.
"""

from __future__ import annotations

from typing import Any, Optional

from .transport import StdioTransport, WebSocketTransport, Transport
from .thread import Thread
from .types import LegnaCodeConfig, ThreadConfig, ThreadSummary


class LegnaCode:
    """Async client for the LegnaCode app-server."""

    def __init__(self, config: Optional[LegnaCodeConfig] = None) -> None:
        self._config = config or LegnaCodeConfig()
        self._transport: Optional[Transport] = None
        self._next_id = 1

    async def _ensure_connected(self) -> Transport:
        if self._transport and self._transport.is_connected():
            return self._transport

        if self._config.transport == "websocket":
            url = f"ws://127.0.0.1:{self._config.port}"
            ws = WebSocketTransport(url)
            await ws.start()
            self._transport = ws
        else:
            env = dict(self._config.env)
            if self._config.api_key:
                env["ANTHROPIC_API_KEY"] = self._config.api_key
            if self._config.model:
                env["ANTHROPIC_MODEL"] = self._config.model
            stdio = StdioTransport(
                binary_path=self._config.binary_path,
                working_dir=self._config.working_dir,
                env=env,
            )
            await stdio.start()
            self._transport = stdio

        return self._transport

    async def call(self, method: str, params: Any = None) -> Any:
        """Send a JSON-RPC request and return the result."""
        transport = await self._ensure_connected()
        req_id = self._next_id
        self._next_id += 1
        request: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            request["params"] = params
        response = await transport.send(request)
        if "error" in response:
            err = response["error"]
            raise RuntimeError(f"JSON-RPC error {err.get('code')}: {err.get('message')}")
        return response.get("result")

    async def start_thread(self, config: Optional[ThreadConfig] = None) -> Thread:
        """Create a new conversation thread."""
        params: dict[str, Any] = {}
        if config:
            if config.model:
                params["model"] = config.model
            if config.system_prompt:
                params["systemPrompt"] = config.system_prompt
            if config.collaboration_mode:
                params["collaborationMode"] = config.collaboration_mode
            if config.structured_output:
                params["structuredOutput"] = config.structured_output
        result = await self.call("thread/start", params)
        return Thread(result["threadId"], self)

    async def resume_thread(self, thread_id: str) -> Thread:
        """Resume an existing thread by ID."""
        await self.call("thread/resume", {"threadId": thread_id})
        return Thread(thread_id, self)

    async def list_threads(self) -> list[ThreadSummary]:
        """List all available threads."""
        raw = await self.call("thread/list")
        return [
            ThreadSummary(
                id=t.get("id", ""),
                title=t.get("title"),
                created_at=t.get("createdAt", ""),
                last_active_at=t.get("lastActiveAt", ""),
                message_count=t.get("messageCount", 0),
            )
            for t in (raw or [])
        ]

    def get_transport(self) -> Optional[Transport]:
        """Get the underlying transport (for notification subscriptions)."""
        return self._transport

    async def close(self) -> None:
        """Close the client and release resources."""
        if self._transport:
            await self._transport.close()
            self._transport = None

    async def __aenter__(self) -> LegnaCode:
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()
