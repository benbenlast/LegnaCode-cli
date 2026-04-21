//! Fallback sandbox — unshare --net or direct execution.

use crate::{SandboxConfig, SandboxResult};
use std::process::Command;

/// Check if `unshare` is available (Linux only, Level 2).
pub fn has_unshare() -> bool {
    Command::new("unshare")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Execute with best-effort isolation.
pub fn exec(command: &str, config: &SandboxConfig) -> Result<SandboxResult, String> {
    // Try unshare --net for network isolation
    if config.network_policy == "blocked" && has_unshare() {
        let output = Command::new("unshare")
            .arg("--net")
            .arg("/bin/sh")
            .arg("-c")
            .arg(command)
            .output()
            .map_err(|e| format!("unshare: {e}"))?;

        return Ok(SandboxResult {
            exit_code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            sandbox_level: "2-unshare-net".into(),
        });
    }

    // No isolation available — run directly with warning
    let shell = if cfg!(target_os = "windows") { "cmd" } else { "/bin/sh" };
    let flag = if cfg!(target_os = "windows") { "/c" } else { "-c" };

    let output = Command::new(shell)
        .arg(flag)
        .arg(command)
        .output()
        .map_err(|e| format!("direct exec: {e}"))?;

    Ok(SandboxResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        sandbox_level: "0-none".into(),
    })
}
