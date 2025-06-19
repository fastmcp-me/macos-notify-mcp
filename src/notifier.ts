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
