/**
 * Server entry point.
 */
export function startServer(
  _config: unknown,
  _sessionManager: unknown,
  _logger: unknown,
): { port?: number; stop(closeExisting: boolean): void } {
  return { stop() {} }
}
