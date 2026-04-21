"""
Type definitions for the LegnaCode Python SDK.

Wire-compatible with the LegnaCode app-server JSON-RPC protocol.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class LegnaCodeConfig:
    """Configuration for the LegnaCode client."""

    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    working_dir: Optional[str] = None
    env: dict[str, str] = field(default_factory=dict)
    sandbox_mode: str = "workspace-write"
    approval_mode: str = "auto"
    transport: str = "stdio"
    port: int = 3100
    binary_path: str = "legnacode"


@dataclass
class ThreadConfig:
    """Configuration for a conversation thread."""

    model: Optional[str] = None
    system_prompt: Optional[str] = None
    collaboration_mode: Optional[str] = None
    structured_output: Optional[dict[str, Any]] = None


@dataclass
class ToolCallResult:
    """Result of a single tool call within a turn."""

    name: str
    input: Any
    output: Any
    duration_ms: float


@dataclass
class TurnResult:
    """Result of a completed turn."""

    id: str
    content: str
    tool_calls: list[ToolCallResult]
    structured_output: Any = None
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class StreamEvent:
    """A streaming event from a turn."""

    type: str  # turn.started | turn.completed | item.started | item.completed | message.delta
    data: Any = None


@dataclass
class ThreadSummary:
    """Summary of a conversation thread."""

    id: str
    title: Optional[str] = None
    created_at: str = ""
    last_active_at: str = ""
    message_count: int = 0
