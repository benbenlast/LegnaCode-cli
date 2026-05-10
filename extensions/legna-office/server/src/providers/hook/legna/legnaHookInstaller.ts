/**
 * LegnaCode Office — Hook Installer for LegnaCode CLI
 *
 * Generates hook configuration in ~/.legna/settings.json so the CLI
 * automatically POSTs events to the Office server. Unlike Claude's
 * external shell scripts, LegnaCode uses its built-in officeEmitter —
 * this installer just ensures the settings flag is enabled.
 *
 * Also writes a minimal shell-based fallback hook for environments
 * where the built-in emitter isn't available (e.g., older CLI versions).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const LEGNA_CONFIG_DIR = path.join(os.homedir(), '.legna');
const LEGNA_SETTINGS_PATH = path.join(LEGNA_CONFIG_DIR, 'settings.json');
const HOOK_SCRIPTS_DIR = path.join(os.homedir(), '.legna-office', 'hooks');

/**
 * Ensure legnaOffice.enabled is true in ~/.legna/settings.json.
 * Creates the file if it doesn't exist. Merges non-destructively.
 */
export function ensureSettingsEnabled(): boolean {
  try {
    if (!fs.existsSync(LEGNA_CONFIG_DIR)) {
      fs.mkdirSync(LEGNA_CONFIG_DIR, { recursive: true, mode: 0o700 });
    }

    let settings: Record<string, any> = {};
    if (fs.existsSync(LEGNA_SETTINGS_PATH)) {
      settings = JSON.parse(fs.readFileSync(LEGNA_SETTINGS_PATH, 'utf-8'));
    }

    if (!settings.legnaOffice || typeof settings.legnaOffice !== 'object') {
      settings.legnaOffice = {};
    }

    if (settings.legnaOffice.enabled === true && settings.legnaOffice.autoConnect === true) {
      return false; // Already configured
    }

    settings.legnaOffice.enabled = true;
    settings.legnaOffice.autoConnect = true;

    const tmp = LEGNA_SETTINGS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, LEGNA_SETTINGS_PATH);
    return true;
  } catch (e) {
    console.error(`[LegnaCode Office] Failed to update settings: ${e}`);
    return false;
  }
}
