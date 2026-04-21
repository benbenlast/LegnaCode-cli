"""
Thread — represents a single conversation thread.

Wraps JSON-RPC calls to the app-server's turn/* methods.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, AsyncIterator, Any

from .types import TurnResult, ToolCallResult, StreamEvent

if TYPE_CHECKING:
    from .client import LegnaCode


class Thread:
    """A conversation thread backed by the LegnaCode app-server."""

    def __init__(self, thread_id: str, client: LegnaCode) -> None:
        self.id = thread_id
        self._client = client

    async def run(self, prompt: str) -> TurnResult:
        """Run a prompt synchronously — waits for the full turn to complete."""
        raw = await self._client.call("turn/run", {"threadId": self.id, "prompt": prompt})
        return self._parse_turn(raw)

    async def run_streamed(self, prompt: str) -> AsyncIterator[StreamEvent]:
        """Run a prompt with streaming — yields events as they arrive."""
        import asyncio

        transport = self._client.get_transport()
        if not transport:
            raise RuntimeError("Client not connected")

        events: list[StreamEvent] = []
        done = False
        wake: asyncio.Event = asyncio.Event()

        def handler(n: dict[str, Any]) -> None:
            nonlocal done
            if n.get("method") == "turn/event":
                ev = StreamEvent(type=n["params"]["type"], data=n["params"].get("data"))
                events.append(ev)
                if ev.type == "turn.completed":
                    done = True
                wake.set()

        transport.on_notification(handler)

        # Fire the streaming request (don't await the full result)
        asyncio.create_task(
            self._client.call("turn/runStreamed", {"threadId": self.id, "prompt": prompt})
        )

        while not done:
            if not events:
                wake.clear()
                await wake.wait()
            while events:
                yield events.pop(0)

    async def steer(self, input_text: str) -> None:
        """Inject input mid-turn (steering)."""
        await self._client.call("turn/steer", {"threadId": self.id, "input": input_text})

    async def interrupt(self) -> None:
        """Interrupt the current turn."""
        await self._client.call("turn/interrupt", {"threadId": self.id})

    async def fork(self) -> Thread:
        """Fork this thread into a new branch."""
        result = await self._client.call("thread/fork", {"threadId": self.id})
        return Thread(result["threadId"], self._client)

    async def rollback(self, target: str) -> None:
        """Rollback to a specific turn or checkpoint."""
        await self._client.call("thread/rollback", {"threadId": self.id, "target": target})

    async def compact(self) -> None:
        """Compact/summarize the conversation history."""
        await self._client.call("thread/compact", {"threadId": self.id})

    async def attach_image(self, path_or_url: str) -> None:
        """Attach an image to the next turn."""
        await self._client.call("thread/attachImage", {"threadId": self.id, "pathOrUrl": path_or_url})

    @staticmethod
    def _parse_turn(raw: Any) -> TurnResult:
        tool_calls = [
            ToolCallResult(
                name=tc.get("name", ""),
                input=tc.get("input"),
                output=tc.get("output"),
                duration_ms=tc.get("duration_ms", 0),
            )
            for tc in (raw.get("toolCalls") or [])
        ]
        return TurnResult(
            id=raw.get("id", ""),
            content=raw.get("content", ""),
            tool_calls=tool_calls,
            structured_output=raw.get("structuredOutput"),
            input_tokens=raw.get("usage", {}).get("inputTokens", 0),
            output_tokens=raw.get("usage", {}).get("outputTokens", 0),
        )
