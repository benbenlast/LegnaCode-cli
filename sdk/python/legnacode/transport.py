"""
Transport layer — stdio and WebSocket implementations.

Both transports speak JSONL (one JSON-RPC message per line).
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
from abc import ABC, abstractmethod
from typing import Any, Callable, Optional

NotificationCallback = Callable[[dict[str, Any]], None]


class Transport(ABC):
    """Abstract transport interface."""

    @abstractmethod
    async def send(self, request: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    def on_notification(self, callback: NotificationCallback) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...

    @abstractmethod
    def is_connected(self) -> bool: ...


class StdioTransport(Transport):
    """
    Stdio transport — spawns `legnacode app-server --transport stdio`
    and communicates via stdin/stdout JSONL.
    """

    def __init__(
        self,
        binary_path: str = "legnacode",
        working_dir: Optional[str] = None,
        env: Optional[dict[str, str]] = None,
    ):
        self._binary = binary_path
        self._cwd = working_dir
        self._env = {**os.environ, **(env or {})}
        self._proc: Optional[asyncio.subprocess.Process] = None
        self._pending: dict[int | str, asyncio.Future[dict[str, Any]]] = {}
        self._listeners: list[NotificationCallback] = []
        self._connected = False
        self._reader_task: Optional[asyncio.Task[None]] = None
    async def start(self) -> None:
        if self._connected:
            return
        self._proc = await asyncio.create_subprocess_exec(
            self._binary, "app-server", "--transport", "stdio",
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=self._cwd,
            env=self._env,
        )
        self._connected = True
        self._reader_task = asyncio.create_task(self._read_loop())

    async def _read_loop(self) -> None:
        assert self._proc and self._proc.stdout
        while self._connected:
            line = await self._proc.stdout.readline()
            if not line:
                self._connected = False
                break
            try:
                msg = json.loads(line.decode().strip())
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if "id" in msg and ("result" in msg or "error" in msg):
                fut = self._pending.pop(msg["id"], None)
                if fut and not fut.done():
                    fut.set_result(msg)
            elif "method" in msg and "id" not in msg:
                for cb in self._listeners:
                    cb(msg)

    async def send(self, request: dict[str, Any]) -> dict[str, Any]:
        if not self._proc or not self._proc.stdin:
            raise RuntimeError("Transport not connected")
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._pending[request["id"]] = fut
        self._proc.stdin.write((json.dumps(request) + "\n").encode())
        await self._proc.stdin.drain()
        return await fut

    def on_notification(self, callback: NotificationCallback) -> None:
        self._listeners.append(callback)

    async def close(self) -> None:
        self._connected = False
        if self._reader_task:
            self._reader_task.cancel()
        if self._proc:
            self._proc.terminate()
            await self._proc.wait()
        for fut in self._pending.values():
            if not fut.done():
                fut.set_exception(RuntimeError("Transport closed"))
        self._pending.clear()

    def is_connected(self) -> bool:
        return self._connected


class WebSocketTransport(Transport):
    """
    WebSocket transport — connects to a running legnacode app-server
    WebSocket endpoint.
    """

    def __init__(self, url: str = "ws://127.0.0.1:3100"):
        self._url = url
        self._ws: Any = None
        self._pending: dict[int | str, asyncio.Future[dict[str, Any]]] = {}
        self._listeners: list[NotificationCallback] = []
        self._connected = False
        self._reader_task: Optional[asyncio.Task[None]] = None

    async def start(self) -> None:
        if self._connected:
            return
        try:
            import websockets
        except ImportError:
            raise ImportError("Install websockets: pip install legnacode-sdk[websocket]")
        self._ws = await websockets.connect(self._url)
        self._connected = True
        self._reader_task = asyncio.create_task(self._read_loop())

    async def _read_loop(self) -> None:
        try:
            async for raw in self._ws:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if "id" in msg and ("result" in msg or "error" in msg):
                    fut = self._pending.pop(msg["id"], None)
                    if fut and not fut.done():
                        fut.set_result(msg)
                elif "method" in msg and "id" not in msg:
                    for cb in self._listeners:
                        cb(msg)
        except Exception:
            self._connected = False

    async def send(self, request: dict[str, Any]) -> dict[str, Any]:
        if not self._ws:
            raise RuntimeError("Transport not connected")
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._pending[request["id"]] = fut
        await self._ws.send(json.dumps(request))
        return await fut

    def on_notification(self, callback: NotificationCallback) -> None:
        self._listeners.append(callback)

    async def close(self) -> None:
        self._connected = False
        if self._reader_task:
            self._reader_task.cancel()
        if self._ws:
            await self._ws.close()
        for fut in self._pending.values():
            if not fut.done():
                fut.set_exception(RuntimeError("Transport closed"))
        self._pending.clear()

    def is_connected(self) -> bool:
        return self._connected
