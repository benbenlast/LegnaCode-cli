/**
 * Peers command.
 */
const peersCommand = {
  type: 'prompt' as const,
  name: 'peers',
  description: 'Manage peers',
  isEnabled: true,
  isHidden: false,
  progressMessage: '',
  userFacingName() { return 'peers' },
  call: async () => ({ type: 'text' as const, text: '' }),
}
export default peersCommand
