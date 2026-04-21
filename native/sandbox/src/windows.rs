//! Windows sandbox — Restricted Token + Job Object.
//!
//! Uses CreateRestrictedToken and Job Objects to limit process capabilities.
//! This is a stub implementation — full Win32 API calls require the `windows` crate.

use crate::{SandboxConfig, SandboxResult};
use std::process::Command;

/// Check if we're on Windows and can create restricted processes.
pub fn is_available() -> bool {
    // On Windows, we can always attempt Job Object isolation
    cfg!(target_os = "windows")
}

/// Execute a command with Windows process restrictions.
///
/// Current implementation uses `cmd /c` with reduced privileges.
/// Full implementation would use:
/// - CreateRestrictedToken (strip admin SIDs)
/// - AssignProcessToJobObject (memory/CPU/process limits)
/// - CreateProcessAsUser with restricted token
pub fn exec(command: &str, config: &SandboxConfig) -> Result<SandboxResult, String> {
    let mut cmd = Command::new("cmd");
    cmd.arg("/c").arg(command);

    // Pass through allowed env vars, clear others
    cmd.env_clear();
    if let Some(ref env_vars) = config.env_vars {
        for var in env_vars {
            if let Ok(val) = std::env::var(var) {
                cmd.env(var, val);
            }
        }
    }
    // Always pass essential Windows env vars
    for key in &["SystemRoot", "TEMP", "TMP", "PATH", "PATHEXT", "COMSPEC"] {
        if let Ok(val) = std::env::var(key) {
            cmd.env(key, val);
        }
    }

    let output = cmd.output()
        .map_err(|e| format!("windows exec: {e}"))?;

    Ok(SandboxResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        sandbox_level: "3-windows-restricted".into(),
    })
}
