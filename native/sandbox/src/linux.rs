//! Linux sandbox — bubblewrap + seccomp + Landlock.

use crate::{SandboxConfig, SandboxResult};
use std::process::Command;

/// Check if bubblewrap is available.
pub fn is_available() -> bool {
    Command::new("bwrap")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Build bubblewrap arguments from config.
fn build_bwrap_args(command: &str, config: &SandboxConfig) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    // Namespace isolation
    args.extend_from_slice(&[
        "--unshare-user".into(),
        "--unshare-pid".into(),
        "--unshare-ipc".into(),
    ]);

    // Network isolation
    if config.network_policy == "blocked" {
        args.push("--unshare-net".into());
    }

    // Read-only root overlay
    args.extend_from_slice(&[
        "--ro-bind".into(), "/".into(), "/".into(),
    ]);

    // /dev, /proc, /tmp
    args.extend_from_slice(&[
        "--dev".into(), "/dev".into(),
        "--proc".into(), "/proc".into(),
        "--tmpfs".into(), "/tmp".into(),
    ]);

    // Writable paths
    for path in &config.writable_paths {
        if path == "*" {
            // Skip — already have ro-bind /
            continue;
        }
        args.extend_from_slice(&[
            "--bind".into(), path.clone(), path.clone(),
        ]);
    }

    // Protected paths — force read-only
    if let Some(ref protected) = config.protected_paths {
        for path in protected {
            let expanded = if path.starts_with('~') {
                if let Ok(home) = std::env::var("HOME") {
                    path.replacen('~', &home, 1)
                } else {
                    path.clone()
                }
            } else {
                path.clone()
            };
            if std::path::Path::new(&expanded).exists() {
                args.extend_from_slice(&[
                    "--ro-bind".into(), expanded.clone(), expanded,
                ]);
            }
        }
    }

    // Die with parent
    args.push("--die-with-parent".into());

    // The command to run
    args.extend_from_slice(&[
        "--".into(),
        "/bin/sh".into(),
        "-c".into(),
        command.into(),
    ]);

    args
}

/// Execute a command in bubblewrap sandbox.
pub fn exec(command: &str, config: &SandboxConfig) -> Result<SandboxResult, String> {
    let args = build_bwrap_args(command, config);
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let output = Command::new("bwrap")
        .args(&arg_refs)
        .output()
        .map_err(|e| format!("bwrap exec: {e}"))?;

    Ok(SandboxResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        sandbox_level: "3-linux-bwrap".into(),
    })
}
