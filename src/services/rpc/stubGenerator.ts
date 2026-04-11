/**
 * Stub Generator — generates legna_tools.js for child processes.
 *
 * Adapted from Hermes Agent's generate_hermes_tools_module().
 * The generated module provides RPC client functions that call back
 * to the parent LegnaCode process over a Unix domain socket.
 */

const TOOL_STUBS: Record<string, { funcName: string; sig: string; doc: string; argsExpr: string }> = {
  Bash: {
    funcName: 'bash',
    sig: 'command, timeout',
    doc: 'Run a shell command. Returns { stdout, stderr, exitCode }.',
    argsExpr: '{ command, timeout }',
  },
  Read: {
    funcName: 'readFile',
    sig: 'file_path, offset, limit',
    doc: 'Read a file. Returns file content string.',
    argsExpr: '{ file_path, offset, limit }',
  },
  Write: {
    funcName: 'writeFile',
    sig: 'file_path, content',
    doc: 'Write content to a file. Returns { success }.',
    argsExpr: '{ file_path, content }',
  },
  Edit: {
    funcName: 'editFile',
    sig: 'file_path, old_string, new_string, replace_all',
    doc: 'Replace text in a file. Returns { success }.',
    argsExpr: '{ file_path, old_string, new_string, replace_all }',
  },
  Glob: {
    funcName: 'glob',
    sig: 'pattern, path',
    doc: 'Find files matching a glob pattern. Returns array of paths.',
    argsExpr: '{ pattern, path }',
  },
  Grep: {
    funcName: 'grep',
    sig: 'pattern, path, glob_filter, output_mode',
    doc: 'Search file contents with regex. Returns matches.',
    argsExpr: '{ pattern, path, glob: glob_filter, output_mode }',
  },
  WebFetch: {
    funcName: 'webFetch',
    sig: 'url, prompt',
    doc: 'Fetch and process a web page. Returns extracted content.',
    argsExpr: '{ url, prompt }',
  },
}

/**
 * Generate the legna_tools.js stub module source code.
 * The child process requires this module and calls functions that
 * RPC back to the parent over UDS.
 */
export function generateStubModule(enabledTools: string[]): string {
  const allowed = enabledTools.filter(t => t in TOOL_STUBS)

  const header = `// Auto-generated LegnaCode tools RPC stubs
// Do not edit — regenerated each code execution session.
const net = require('net');

let _sock = null;

function _connect() {
  if (!_sock) {
    _sock = net.createConnection(process.env.LEGNA_RPC_SOCKET);
    _sock.setEncoding('utf-8');
  }
  return _sock;
}

function _call(toolName, args) {
  return new Promise((resolve, reject) => {
    const conn = _connect();
    const request = JSON.stringify({ tool: toolName, args }) + '\\n';
    conn.write(request);
    let buf = '';
    const onData = (chunk) => {
      buf += chunk;
      if (buf.endsWith('\\n')) {
        conn.removeListener('data', onData);
        try {
          resolve(JSON.parse(buf.trim()));
        } catch (e) {
          resolve(buf.trim());
        }
      }
    };
    conn.on('data', onData);
    conn.on('error', reject);
    setTimeout(() => reject(new Error('RPC timeout')), 300000);
  });
}

`

  const stubs = allowed.map(toolName => {
    const s = TOOL_STUBS[toolName]!
    return `/** ${s.doc} */
async function ${s.funcName}(${s.sig}) {
  return _call('${toolName}', ${s.argsExpr});
}
`
  })

  const exports = allowed.map(t => TOOL_STUBS[t]!.funcName)
  const footer = `\nmodule.exports = { ${exports.join(', ')} };\n`

  return header + stubs.join('\n') + footer
}
