//! LegnaCode Sandbox — cross-platform kernel-level sandboxing via NAPI.
//!
//! Provides `sandbox_exec(command, config)` that runs a shell command inside
//! a platform-appropriate sandbox (bubblewrap on Linux, Seatbelt on macOS,
//! Restricted Token on Windows, fallback otherwise).

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;
mod fallback;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    /// Sandbox mode: "read-only", "workspace-write", "danger-full-access"
    pub mode: String,
    /// Paths the sandboxed process may write to
    pub writable_paths: Vec<String>,
    /// Paths the sandboxed process may read from ("*" = all)
    pub readable_paths: Vec<String>,
    /// Network policy: "full", "limited", "blocked"
    pub network_policy: String,
    /// Environment variables to pass through
    pub env_vars: Option<Vec<String>>,
    /// Paths that are always read-only (.git, .legnacode, .env, ~/.ssh)
    pub protected_paths: Option<Vec<String>>,
}

#[napi(object)]
#[derive(Debug, Clone)]
pub struct SandboxResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub sandbox_level: String,
}

/// Detect the highest available sandbox level on this platform.
///
/// - Level 3: Native kernel sandbox (bubblewrap / Seatbelt / RestrictedToken)
/// - Level 2: Network-only isolation (unshare --net)
/// - Level 1: Container-level (@anthropic-ai/sandbox-runtime)
/// - Level 0: No sandbox
#[napi]
pub fn detect_sandbox_level() -> i32 {
    #[cfg(target_os = "linux")]
    {
        if linux::is_available() { return 3; }
        if fallback::has_unshare() { return 2; }
    }
    #[cfg(target_os = "macos")]
    {
        if macos::is_available() { return 3; }
    }
    #[cfg(target_os = "windows")]
    {
        if windows::is_available() { return 3; }
    }
    0
}

/// Execute a command inside a sandbox.
#[napi]
pub fn sandbox_exec(command: String, config: SandboxConfig) -> Result<SandboxResult> {
    #[cfg(target_os = "linux")]
    {
        if linux::is_available() {
            return linux::exec(&command, &config)
                .map_err(|e| Error::from_reason(format!("linux sandbox: {e}")));
        }
    }
    #[cfg(target_os = "macos")]
    {
        if macos::is_available() {
            return macos::exec(&command, &config)
                .map_err(|e| Error::from_reason(format!("macos sandbox: {e}")));
        }
    }
    #[cfg(target_os = "windows")]
    {
        if windows::is_available() {
            return windows::exec(&command, &config)
                .map_err(|e| Error::from_reason(format!("windows sandbox: {e}")));
        }
    }

    // Fallback
    fallback::exec(&command, &config)
        .map_err(|e| Error::from_reason(format!("fallback sandbox: {e}")))
}

/// Helper: run a raw command and capture output.
fn run_command(program: &str, args: &[&str]) -> std::result::Result<SandboxResult, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| format!("spawn {program}: {e}"))?;

    Ok(SandboxResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        sandbox_level: "unknown".into(),
    })
}
