//! macOS sandbox — Seatbelt profile generation + sandbox-exec.

use crate::{SandboxConfig, SandboxResult};
use std::process::Command;

/// Check if sandbox-exec is available (ships with macOS).
pub fn is_available() -> bool {
    Command::new("sandbox-exec")
        .arg("-n")
        .arg("no-network")
        .arg("true")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Generate a Seatbelt profile string from config.
fn generate_profile(config: &SandboxConfig) -> String {
    let mut profile = String::from("(version 1)\n");

    // Default deny
    profile.push_str("(deny default)\n");

    // Allow basic process operations
    profile.push_str("(allow process-exec)\n");
    profile.push_str("(allow process-fork)\n");
    profile.push_str("(allow sysctl-read)\n");
    profile.push_str("(allow mach-lookup)\n");
    profile.push_str("(allow signal)\n");
    profile.push_str("(allow ipc-posix-shm-read-data)\n");

    // File read
    if config.readable_paths.iter().any(|p| p == "*") {
        profile.push_str("(allow file-read*)\n");
    } else {
        for path in &config.readable_paths {
            profile.push_str(&format!(
                "(allow file-read* (subpath \"{path}\"))\n"
            ));
        }
    }

    // File write
    if config.writable_paths.iter().any(|p| p == "*") {
        profile.push_str("(allow file-write*)\n");
    } else {
        for path in &config.writable_paths {
            profile.push_str(&format!(
                "(allow file-write* (subpath \"{path}\"))\n"
            ));
        }
        // Always allow /tmp writes
        profile.push_str("(allow file-write* (subpath \"/tmp\"))\n");
        profile.push_str("(allow file-write* (subpath \"/private/tmp\"))\n");
    }

    // Protected paths — deny write
    if let Some(ref protected) = config.protected_paths {
        for path in protected {
            let expanded = if path.starts_with('~') {
                if let Ok(home) = std::env::var("HOME") {
                    path.replacen('~', &home, 1)
                } else {
                    continue;
                }
            } else {
                path.clone()
            };
            profile.push_str(&format!(
                "(deny file-write* (subpath \"{expanded}\"))\n"
            ));
        }
    }

    // Network
    match config.network_policy.as_str() {
        "full" => {
            profile.push_str("(allow network*)\n");
        }
        "limited" => {
            profile.push_str("(allow network-outbound)\n");
            profile.push_str("(deny network-bind)\n");
        }
        _ => {
            // blocked — deny all network
            profile.push_str("(deny network*)\n");
        }
    }

    profile
}

/// Execute a command in macOS Seatbelt sandbox.
pub fn exec(command: &str, config: &SandboxConfig) -> Result<SandboxResult, String> {
    let profile = generate_profile(config);

    let output = Command::new("sandbox-exec")
        .arg("-p")
        .arg(&profile)
        .arg("--")
        .arg("/bin/sh")
        .arg("-c")
        .arg(command)
        .output()
        .map_err(|e| format!("sandbox-exec: {e}"))?;

    Ok(SandboxResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        sandbox_level: "3-macos-seatbelt".into(),
    })
}
