"""
legnacode-sdk — Python SDK for LegnaCode.

Provides async programmatic access to the LegnaCode CLI
via JSON-RPC over stdio or WebSocket transport.
"""

from .client import LegnaCode
from .thread import Thread
from .types import (
    LegnaCodeConfig,
    ThreadConfig,
    TurnResult,
    ToolCallResult,
    StreamEvent,
    ThreadSummary,
)

# Codex compatibility alias
Codex = LegnaCode

__all__ = [
    "LegnaCode",
    "Codex",
    "Thread",
    "LegnaCodeConfig",
    "ThreadConfig",
    "TurnResult",
    "ToolCallResult",
    "StreamEvent",
    "ThreadSummary",
]

__version__ = "1.0.0"
