// Chinese translation dictionary for LegnaCode CLI i18n
// Key = English original, Value = Chinese translation
// Missing keys fall back to English automatically

export const ZH_DICT: Record<string, string> = {
  // ── Permission mode titles ──
  'Default': '默认',
  'Plan Mode': '计划模式',
  'Accept edits': '自动接受编辑',
  'Plan': '计划',
  'Accept': '接受',
  'Bypass Permissions': '跳过权限',
  'Bypass': '跳过',
  "Don't Ask": '免询问',
  'DontAsk': '免询问',
  'Auto mode': '自动模式',
  'Auto': '自动',

  // ── Footer / Status bar ──
  '-- INSERT --': '-- 插入 --',
  'Pasting text…': '粘贴文本中…',
  '! for bash mode': '! 进入 bash 模式',
  '? for shortcuts': '? 查看快捷键',
  'Press {0} again to exit': '再按 {0} 退出',
  'interrupt': '中断',
  'stop agents': '停止代理',
  'cycle': '切换',
  'show tasks': '显示任务',
  'show teammates': '显示队友',
  'hide': '隐藏',
  'hide tasks': '隐藏任务',
  'return to team lead': '返回主线程',
  'manage': '管理',
  'view tasks': '查看任务',
  'waiting': '等待中',
  'remote': '远程',
  'copy': '复制',
  'native select': '原生选择',
  'hold {0} to speak': '按住 {0} 说话',

  // ── Spinner / Animation ──
  'Idle': '空闲',
  'teammates running': '队友运行中',
  'Worked for {0}': '已工作 {0}',
  'thinking': '思考中',
  'thought for {0}s': '思考了 {0} 秒',
  'tokens': '令牌',
  'esc to interrupt ': '按 esc 中断 ',
  'Tip:': '提示:',
  'Next:': '下一步:',
  'Working': '处理中',
  'in background': '后台运行中',
  'Reconnecting': '重新连接中',
  'Disconnected': '已断开连接',

  // ── Command source annotations ──
  '(workflow)': '(工作流)',
  '(plugin)': '(插件)',
  '(bundled)': '(内置)',
  '(arguments: {0})': '(参数: {0})',
  'workflow': '工作流',

  // ── Context tips (shown in spinner) ──
  'Use /clear to start fresh when switching topics and free up context':
    '切换话题时使用 /clear 重新开始，释放上下文空间',
  "Use /btw to ask a quick side question without interrupting LegnaCode's current work":
    '使用 /btw 快速提问，不会打断 LegnaCode 当前的工作',

  // ── Command descriptions ──
  'Resume a previous conversation': '恢复之前的对话',
  'Show remote session URL and QR code': '显示远程会话 URL 和二维码',
  'LegnaCode in Chrome (Beta) settings': 'LegnaCode Chrome (Beta) 设置',
  'Create a git commit': '创建 git 提交',
  'List available skills': '列出可用技能',
  'List all files currently in context': '列出当前上下文中的所有文件',
  'Configure the advisor model': '配置顾问模型',
  'Export the current conversation to a file or clipboard': '导出当前对话到文件或剪贴板',
  'Change the theme': '更改主题',
  'List and manage background tasks': '列出和管理后台任务',
  'Clear conversation history and free up context': '清除对话历史并释放上下文',
  'Rename the current conversation': '重命名当前对话',
  'Commit, push, and open a PR': '提交、推送并创建 PR',
  'Toggle proactive (autonomous) mode': '切换主动（自主）模式',
  'Toggle a searchable tag on the current session': '为当前会话切换可搜索标签',
  'Order LegnaCode stickers': '订购 LegnaCode 贴纸',
  'Toggle voice mode': '切换语音模式',
  'Show options when rate limit is reached': '达到速率限制时显示选项',
  'Set the prompt bar color for this session': '设置本次会话的提示栏颜色',
  'Toggle brief-only mode': '切换简洁模式',
  'Connect this terminal for remote-control sessions': '连接此终端用于远程控制会话',
  'View hook configurations for tool events': '查看工具事件的钩子配置',
  'Review a pull request': '审查 Pull Request',
  'Show help and available commands': '显示帮助和可用命令',
  'Install the LegnaCode Slack app': '安装 LegnaCode Slack 应用',
  'Your 2025 LegnaCode Year in Review': '你的 2025 LegnaCode 年度回顾',
  'Configure extra usage to keep working when limits are hit': '配置额外用量以在达到限制时继续工作',
  'Play the thinkback animation': '播放回顾动画',
  'Dump the JS heap to ~/Desktop': '将 JS 堆转储到 ~/Desktop',
  'Set effort level for model usage': '设置模型使用的努力级别',
  'Set up LegnaCode GitHub Actions for a repository': '为仓库设置 LegnaCode GitHub Actions',
  'Exit the REPL': '退出 REPL',
  'View and update your privacy settings': '查看和更新隐私设置',
  'Show QR code to download the LegnaCode mobile app': '显示二维码以下载 LegnaCode 手机应用',
  'Show your LegnaCode usage statistics and activity': '显示你的 LegnaCode 使用统计和活动',
  'Get comments from a GitHub pull request': '获取 GitHub Pull Request 的评论',
  'Open or create your keybindings configuration file': '打开或创建快捷键配置文件',
  'Submit feedback about LegnaCode': '提交关于 LegnaCode 的反馈',
  'Open config panel': '打开配置面板',
  'Add a new working directory': '添加新的工作目录',
  'Enable plan mode or view the current session plan': '启用计划模式或查看当前会话计划',
  'Edit LegnaCode memory files': '编辑 LegnaCode 记忆文件',
  'Activate pending plugin changes in the current session': '在当前会话中激活待处理的插件更改',
  'Manage allow & deny tool permission rules': '管理工具权限的允许和拒绝规则',
  'List available workflows': '列出可用工作流',
  'View uncommitted changes and per-turn diffs': '查看未提交的更改和每轮差异',
  'Deprecated: use /config to change output style': '已弃用：使用 /config 更改输出样式',
  'Manage agent configurations': '管理代理配置',
  'Visualize current context usage as a colored grid': '以彩色网格可视化当前上下文使用情况',
  'Show current context usage': '显示当前上下文使用情况',
  'Show the total cost and duration of the current session': '显示当前会话的总费用和时长',
  'View release notes': '查看发布说明',
  'Continue the current session in LegnaCode Desktop': '在 LegnaCode 桌面版中继续当前会话',
  'Manage MCP servers': '管理 MCP 服务器',
  'Configure the default remote environment for teleport sessions': '配置远程传送会话的默认环境',
  'Restore the code and/or conversation to a previous point': '将代码和/或对话恢复到之前的某个时间点',
  'Generate a report analyzing your LegnaCode sessions': '生成分析你的 LegnaCode 会话的报告',
  "Set up LegnaCode's status line UI": '设置 LegnaCode 的状态栏 UI',
  'Diagnose and verify your LegnaCode installation and settings': '诊断并验证你的 LegnaCode 安装和设置',
  'Sign out from your Anthropic account': '退出 Anthropic 账户',
  'Toggle between Vim and Normal editing modes': '在 Vim 和普通编辑模式之间切换',
  'Create a branch of the current conversation at this point': '在此处创建当前对话的分支',
  'Show plan usage limits': '显示计划使用限制',
  'Meet your coding companion': '认识你的编程伙伴',
  'Force a history snip to free context': '强制裁剪历史以释放上下文',
  'Upgrade to Max for higher rate limits and more Opus': '升级到 Max 以获得更高速率限制和更多 Opus',
  'Manage IDE integrations and show status': '管理 IDE 集成并显示状态',
  'Manage LegnaCode plugins': '管理 LegnaCode 插件',
  'Attach to a running assistant session': '连接到正在运行的助手会话',
  'Fork a sub-agent with the current conversation context': '使用当前对话上下文派生子代理',
  'Ask a quick side question without interrupting the main conversation': '快速提问，不打断主对话',
  'Show LegnaCode status including version, model, account, API connectivity, and tool statuses':
    '显示 LegnaCode 状态，包括版本、模型、账户、API 连接和工具状态',
  'Clear conversation history but keep a summary in context. Optional: /compact [instructions for summarization]':
    '清除对话历史但保留摘要。可选：/compact [摘要指令]',
  "Copy LegnaCode's last response to clipboard (or /copy N for the Nth-latest)":
    '复制 LegnaCode 的最近回复到剪贴板（或 /copy N 复制第 N 条）',
  'Setup LegnaCode on the web (requires connecting your GitHub account)':
    '在网页上设置 LegnaCode（需要连接你的 GitHub 账户）',
  'Share a free week of LegnaCode with friends and earn extra usage':
    '与朋友分享一周免费 LegnaCode 并获得额外用量',
  'Share a free week of LegnaCode with friends': '与朋友分享一周免费 LegnaCode',
  'Switch Anthropic accounts': '切换 Anthropic 账户',
  'Sign in with your Anthropic account': '使用 Anthropic 账户登录',
  'Install Shift+Enter key binding for newlines': '安装 Shift+Enter 换行快捷键',
  'Enable Option+Enter key binding for newlines and visual bell': '启用 Option+Enter 换行快捷键和视觉提示',

  // ── Tip translations ──
  'Start with small features or bug fixes, tell LegnaCode to propose a plan, and verify its suggested edits':
    '从小功能或 bug 修复开始，让 LegnaCode 提出计划，并验证它建议的编辑',
  'Use /config to change your default permission mode (including Plan Mode)':
    '使用 /config 更改默认权限模式（包括计划模式）',
  'Use git worktrees to run multiple LegnaCode sessions in parallel.':
    '使用 git worktree 并行运行多个 LegnaCode 会话。',
  'Running multiple LegnaCode sessions? Use /color and /rename to tell them apart at a glance.':
    '运行多个 LegnaCode 会话？使用 /color 和 /rename 一眼区分它们。',
  'Use /memory to view and manage LegnaCode memory':
    '使用 /memory 查看和管理 LegnaCode 记忆',
  'Use /theme to change the color theme': '使用 /theme 更改颜色主题',
  'Try setting environment variable COLORTERM=truecolor for richer colors':
    '尝试设置环境变量 COLORTERM=truecolor 以获得更丰富的颜色',
  'Use /statusline to set up a custom status line that will display beneath the input box':
    '使用 /statusline 设置自定义状态栏，显示在输入框下方',
  'Hit Enter to queue up additional messages while LegnaCode is working.':
    '在 LegnaCode 工作时按 Enter 排队发送更多消息。',
  'Send messages to LegnaCode while it works to steer LegnaCode in real-time':
    '在 LegnaCode 工作时发送消息以实时引导它',
  'Ask LegnaCode to create a todo list when working on complex tasks to track progress and remain on track':
    '处理复杂任务时让 LegnaCode 创建待办列表以跟踪进度',
  'Did you know you can drag and drop image files into your terminal?':
    '你知道可以将图片文件拖放到终端中吗？',
  'Double-tap esc to rewind the conversation to a previous point in time':
    '双击 esc 将对话回退到之前的时间点',
  'Double-tap esc to rewind the code and/or conversation to a previous point in time':
    '双击 esc 将代码和/或对话回退到之前的时间点',
  'Name your conversations with /rename to find them easily in /resume later':
    '使用 /rename 命名对话，方便之后在 /resume 中找到',
  'Create skills by adding .md files to .claude/skills/ in your project or ~/.claude/skills/ for skills that work in any project':
    '在项目的 .claude/skills/ 或 ~/.claude/skills/ 中添加 .md 文件来创建技能',
  'Use /permissions to pre-approve and pre-deny bash, edit, and MCP tools':
    '使用 /permissions 预先批准或拒绝 bash、编辑和 MCP 工具',
  'Connect LegnaCode to your IDE · /ide': '将 LegnaCode 连接到你的 IDE · /ide',
  'Use /feedback to help us improve!': '使用 /feedback 帮助我们改进！',

  // ── Spinner / Background ──
  '{0} in background': '{0} 个后台任务',

  // ── Teammate tree ──
  'team-lead': '主线程',
  'enter to view': '回车查看',
  'enter to collapse': '回车折叠',
  'shift + ↑/↓ to select': 'shift + ↑/↓ 选择',
  'Using {0}…': '使用 {0}…',
  '{0} tool use': '{0} 次工具调用',
  '{0} tool uses': '{0} 次工具调用',
  '[stopping]': '[停止中]',
  '[awaiting approval]': '[等待审批]',
  'Idle for {0}': '空闲 {0}',

  // ── Pill labels ──
  '1 shell': '1 个 shell',
  '{0} shells': '{0} 个 shell',
  '1 monitor': '1 个监控',
  '{0} monitors': '{0} 个监控',
  '1 team': '1 个团队',
  '{0} teams': '{0} 个团队',
  '1 local agent': '1 个本地代理',
  '{0} local agents': '{0} 个本地代理',
  'ultraplan ready': 'ultraplan 就绪',
  'ultraplan needs your input': 'ultraplan 需要你的输入',
  'ultraplan': 'ultraplan',
  '1 cloud session': '1 个云会话',
  '{0} cloud sessions': '{0} 个云会话',
  '1 background workflow': '1 个后台工作流',
  '{0} background workflows': '{0} 个后台工作流',
  'dreaming': '梦境中',
  '{0} background task': '{0} 个后台任务',
  '{0} background tasks': '{0} 个后台任务',

  // ── KeyboardShortcutHint ──
  'to': '→',
  ' on': ' 开启',
  // ── Tips (simple) ──
  'Run /install-github-app to tag @claude right from your Github issues and PRs':
    '运行 /install-github-app 直接在 Github issues 和 PR 中 @claude',
  'Run /install-slack-app to use LegnaCode in Slack':
    '运行 /install-slack-app 在 Slack 中使用 LegnaCode',
  'Paste images into LegnaCode using control+v (not cmd+v!)':
    '使用 control+v 粘贴图片到 LegnaCode（不是 cmd+v！）',
  'Run legna --continue or legna --resume to resume a conversation':
    '运行 legna --continue 或 legna --resume 恢复对话',
  'Use /agents to optimize specific tasks. Eg. Software Architect, Code Writer, Code Reviewer':
    '使用 /agents 优化特定任务。如：软件架构师、代码编写、代码审查',
  'Use --agent <agent_name> to directly start a conversation with a subagent':
    '使用 --agent <agent_name> 直接与子代理开始对话',
  'Run LegnaCode locally or remotely using the Claude desktop app: clau.de/desktop':
    '使用 Claude 桌面应用本地或远程运行 LegnaCode：clau.de/desktop',
  'Run tasks in the cloud while you keep coding locally · clau.de/web':
    '在云端运行任务，本地继续编码 · clau.de/web',
  '/mobile to use LegnaCode from the LegnaCode app on your phone':
    '/mobile 从手机上的 LegnaCode 应用使用 LegnaCode',
  'Set CLAUDE_CODE_USE_POWERSHELL_TOOL=1 to enable the PowerShell tool (preview)':
    '设置 CLAUDE_CODE_USE_POWERSHELL_TOOL=1 启用 PowerShell 工具（预览）',
}
