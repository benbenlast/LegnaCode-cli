/**
 * Query source identifiers for analytics tracking.
 */
export type QuerySource =
  | 'user'
  | 'tool'
  | 'agent'
  | 'compact'
  | 'auto_compact'
  | 'micro_compact'
  | 'post_compact'
  | 'bash'
  | 'side_query'
  | 'forked_agent'
  | 'prompt_submit'
  | 'stop_hooks'
  | 'prompt_category'
  | 'api'
  | 'retry'
  | 'prompt_cache'
  | 'attachments'
  | 'post_sampling'
  | 'shell_prefix'
  | 'log'
  | (string & {})
