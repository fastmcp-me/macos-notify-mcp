import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface NotificationOptions {
  title?: string
  message: string
  sound?: string
  session?: string
  window?: string
  pane?: string
}

interface TmuxInfo {
  session: string
  window: string
  pane: string
}

interface CommandError extends Error {
  code?: number
  stderr?: string
  stdout?: string
}

export type TerminalType =
  | 'VSCode'
  | 'Cursor'
  | 'iTerm2'
  | 'Terminal'
  | 'alacritty'
  | 'Unknown'

export class TmuxNotifier {
  private appPath = ''
  private defaultTitle = 'macos-notify-mcp'

  constructor(customAppPath?: string) {
    if (customAppPath) {
      this.appPath = customAppPath
    } else {
      // Try multiple locations
      const possiblePaths = [
        // Relative to the package installation (primary location)
        join(
          dirname(fileURLToPath(import.meta.url)),
          '..',
          'MacOSNotifyMCP',
          'MacOSNotifyMCP.app',
        ),
        // Development path
        join(process.cwd(), 'MacOSNotifyMCP', 'MacOSNotifyMCP.app'),
      ]

      // Find the first existing path
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          this.appPath = path
          break
        }
      }

      // Default to package-relative path
      if (!this.appPath) {
        this.appPath = possiblePaths[0]
      }
    }

    // Get repository name as default title
    this.initializeDefaultTitle()
  }

  /**
   * Initialize default title from git repository name
   */
  private async initializeDefaultTitle(): Promise<void> {
    try {
      const repoName = await this.getGitRepoName()
      if (repoName) {
        this.defaultTitle = repoName
      }
    } catch (_error) {
      // Keep default title if git command fails
    }
  }

  /**
   * Get the active tmux client information
   */
  private async getActiveClientInfo(): Promise<{
    tty: string
    session: string
    activity: string
  } | null> {
    try {
      // Get list of all clients attached to the current session
      const currentSession = process.env.TMUX_PANE
        ? await this.runCommand('tmux', [
            'display-message',
            '-p',
            '#{session_name}',
          ])
        : null

      if (!currentSession) return null

      // Get all clients attached to this session
      const clientsOutput = await this.runCommand('tmux', [
        'list-clients',
        '-t',
        currentSession.trim(),
        '-F',
        '#{client_tty}|#{client_session}|#{client_activity}',
      ])

      const clients = clientsOutput
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [tty, session, activity] = line.split('|')
          return { tty, session, activity: Number(activity) }
        })

      // Get the most recently active client
      const activeClient = clients.reduce((prev, curr) =>
        curr.activity > prev.activity ? curr : prev,
      )

      return {
        tty: activeClient.tty,
        session: activeClient.session,
        activity: activeClient.activity.toString(),
      }
    } catch (_error) {
      return null
    }
  }

  /**
   * Detect terminal emulator from client TTY
   */
  private async detectTerminalFromClient(
    clientTty: string,
  ): Promise<TerminalType> {
    try {
      // Find processes using this TTY
      const lsofOutput = await this.runCommand('lsof', [clientTty])
      const lines = lsofOutput.trim().split('\n').slice(1) // Skip header

      for (const line of lines) {
        const parts = line.split(/\s+/)
        if (parts.length < 2) continue

        const pid = parts[1]
        // Get process info
        const psOutput = await this.runCommand('ps', ['-p', pid, '-o', 'comm='])
        const command = psOutput.trim()

        // Check for known terminal emulators
        if (command.includes('Cursor')) return 'Cursor'
        if (command.includes('Code')) return 'VSCode'
        if (command.includes('iTerm2')) return 'iTerm2'
        if (command.includes('Terminal')) return 'Terminal'
        if (command.includes('alacritty')) return 'alacritty'
      }
    } catch (_error) {
      // lsof might fail, continue with other methods
    }

    return 'Unknown'
  }

  /**
   * Detect the parent terminal emulator
   */
  private async detectTerminalEmulator(): Promise<TerminalType> {
    // 1. Check for Cursor via CURSOR_TRACE_ID
    if (process.env.CURSOR_TRACE_ID) {
      return 'Cursor'
    }

    // 2. Check for VSCode/Cursor via VSCODE_IPC_HOOK_CLI
    if (process.env.VSCODE_IPC_HOOK_CLI) {
      // Check if it's Cursor by looking for cursor-specific paths
      if (process.env.VSCODE_IPC_HOOK_CLI.includes('Cursor')) {
        return 'Cursor'
      }
      return 'VSCode'
    }

    // 3. Check for VSCode Remote (for tmux attached from VSCode)
    if (process.env.VSCODE_REMOTE || process.env.VSCODE_PID) {
      return 'VSCode'
    }

    // 4. Check for alacritty via specific environment variables
    if (process.env.ALACRITTY_WINDOW_ID || process.env.ALACRITTY_SOCKET) {
      return 'alacritty'
    }

    // 5. Check TERM_PROGRAM for iTerm2 and Terminal.app
    if (process.env.TERM_PROGRAM) {
      if (process.env.TERM_PROGRAM === 'iTerm.app') {
        return 'iTerm2'
      }
      if (process.env.TERM_PROGRAM === 'Apple_Terminal') {
        return 'Terminal'
      }
      if (process.env.TERM_PROGRAM === 'alacritty') {
        return 'alacritty'
      }
    }

    // 6. If we're in tmux, try to detect the active client's terminal
    if (process.env.TMUX) {
      try {
        // Get active client info
        const clientInfo = await this.getActiveClientInfo()
        if (clientInfo) {
          const detectedTerminal = await this.detectTerminalFromClient(
            clientInfo.tty,
          )
          if (detectedTerminal !== 'Unknown') {
            return detectedTerminal
          }
        }

        // Fallback: Get the tmux client's terminal info
        const clientTerm = await this.runCommand('tmux', [
          'display-message',
          '-p',
          '#{client_termname}',
        ])

        // Check for specific terminal indicators in the client termname
        if (clientTerm.includes('iterm') || clientTerm.includes('iTerm')) {
          return 'iTerm2'
        }
        if (clientTerm.includes('Apple_Terminal')) {
          return 'Terminal'
        }

        // Also check tmux client environment variables
        try {
          const clientEnv = await this.runCommand('tmux', [
            'show-environment',
            '-g',
            'TERM_PROGRAM',
          ])
          if (clientEnv.includes('TERM_PROGRAM=iTerm.app')) {
            return 'iTerm2'
          }
          if (clientEnv.includes('TERM_PROGRAM=Apple_Terminal')) {
            return 'Terminal'
          }
        } catch (_) {
          // Ignore if show-environment fails
        }
      } catch (_) {
        // Ignore tmux command failures
      }
    }

    // 3. Fallback: Check process tree
    try {
      // Get the parent process ID chain
      let currentPid = process.pid
      const maxDepth = 10 // Prevent infinite loops

      for (let i = 0; i < maxDepth; i++) {
        // Get parent process info using ps command
        const psOutput = await this.runCommand('ps', [
          '-p',
          currentPid.toString(),
          '-o',
          'ppid=,comm=',
        ])

        const [ppidStr, command] = psOutput.trim().split(/\s+/, 2)
        const ppid = Number.parseInt(ppidStr)

        if (!ppid || ppid === 1) {
          break // Reached init process
        }

        // Check if the command matches known terminal emulators
        if (command) {
          if (command.includes('Cursor')) {
            return 'Cursor'
          }
          if (command.includes('Code') || command.includes('code-insiders')) {
            return 'VSCode'
          }
          if (command.includes('iTerm2')) {
            return 'iTerm2'
          }
          if (command.includes('Terminal')) {
            return 'Terminal'
          }
        }

        currentPid = ppid
      }
    } catch (_error) {
      // Ignore errors in process tree detection
    }

    return 'Unknown'
  }

  /**
   * Get git repository name from current directory
   */
  private async getGitRepoName(): Promise<string | null> {
    try {
      // Get the remote URL
      const remoteUrl = (
        await this.runCommand('git', ['config', '--get', 'remote.origin.url'])
      ).trim()

      if (!remoteUrl) {
        // If no remote, try to get the directory name of the git root
        const gitRoot = (
          await this.runCommand('git', ['rev-parse', '--show-toplevel'])
        ).trim()
        return gitRoot.split('/').pop() || null
      }

      // Extract repo name from URL
      // Handle both HTTPS and SSH formats
      // https://github.com/user/repo.git
      // git@github.com:user/repo.git
      const match = remoteUrl.match(/[/:]([\w-]+)\/([\w-]+?)(\.git)?$/)
      if (match) {
        return match[2]
      }

      // Fallback to directory name
      const gitRoot = (
        await this.runCommand('git', ['rev-parse', '--show-toplevel'])
      ).trim()
      return gitRoot.split('/').pop() || null
    } catch (_error) {
      return null
    }
  }

  /**
   * Run a command and return the output
   */
  private async runCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args)
      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          const error = new Error(
            `Command failed: ${command} ${args.join(' ')}\n${stderr}`,
          ) as CommandError
          error.code = code ?? undefined
          error.stderr = stderr
          error.stdout = stdout
          reject(error)
        }
      })

      proc.on('error', reject)
    })
  }

  /**
   * Get current tmux session info
   */
  async getCurrentTmuxInfo(): Promise<TmuxInfo | null> {
    try {
      const session = (
        await this.runCommand('tmux', [
          'display-message',
          '-p',
          '#{session_name}',
        ])
      ).trim()
      const window = (
        await this.runCommand('tmux', [
          'display-message',
          '-p',
          '#{window_index}',
        ])
      ).trim()
      const pane = (
        await this.runCommand('tmux', [
          'display-message',
          '-p',
          '#{pane_index}',
        ])
      ).trim()

      return { session, window, pane }
    } catch (_error) {
      return null
    }
  }

  /**
   * List tmux sessions
   */
  async listSessions(): Promise<string[]> {
    try {
      const output = await this.runCommand('tmux', [
        'list-sessions',
        '-F',
        '#{session_name}',
      ])
      return output.trim().split('\n').filter(Boolean)
    } catch (_error) {
      return []
    }
  }

  /**
   * Check if a session exists
   */
  async sessionExists(session: string): Promise<boolean> {
    const sessions = await this.listSessions()
    return sessions.includes(session)
  }

  /**
   * Get the detected terminal emulator type
   */
  async getTerminalEmulator(): Promise<TerminalType> {
    return this.detectTerminalEmulator()
  }

  /**
   * Send notification
   */
  async sendNotification(options: NotificationOptions): Promise<void> {
    const {
      title = this.defaultTitle,
      message,
      sound = 'Glass',
      session,
      window,
      pane,
    } = options

    // Check if app path is valid
    if (!this.appPath) {
      throw new Error('MacOSNotifyMCP.app not found')
    }

    // Always detect terminal emulator to pass to notification app
    const terminal = await this.detectTerminalEmulator()

    // Use MacOSNotifyMCP.app for notifications
    const args = [
      '-n',
      this.appPath,
      '--args',
      '-t',
      title,
      '-m',
      message,
      '--sound',
      sound,
      '--terminal',
      terminal,
    ]

    if (session) {
      args.push('-s', session)
      if (window !== undefined && window !== '') {
        args.push('-w', window)
      }
      if (pane !== undefined && pane !== '') {
        args.push('-p', pane)
      }
    }

    await this.runCommand('/usr/bin/open', args)
  }
}
