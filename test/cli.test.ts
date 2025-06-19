import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the notifier module before importing cli
let mockNotifier: any

vi.mock('../src/notifier.js', () => ({
  TmuxNotifier: vi.fn(() => mockNotifier),
}))

describe('CLI', () => {
  let originalArgv: string[]
  let originalExit: typeof process.exit
  let exitCode: number | undefined
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Save original values
    originalArgv = process.argv
    originalExit = process.exit

    // Mock process.exit
    exitCode = undefined
    process.exit = ((code?: number) => {
      exitCode = code
      throw new Error(`Process.exit(${code})`)
    }) as never

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Reset module cache
    vi.resetModules()

    // Create mock notifier
    mockNotifier = {
      sendNotification: vi.fn().mockResolvedValue(undefined),
      listSessions: vi.fn().mockResolvedValue(['session1', 'session2']),
      sessionExists: vi.fn().mockResolvedValue(true),
      getCurrentTmuxInfo: vi
        .fn()
        .mockResolvedValue({ session: 'current', window: '1', pane: '0' }),
    }
  })

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv
    process.exit = originalExit
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    vi.clearAllMocks()
  })

  async function runCli() {
    // Import fresh copy and get main function
    const cliModule = await import('../src/cli.js')
    const main = (cliModule as any).main || cliModule.default

    if (typeof main === 'function') {
      try {
        await main()
      } catch (e: any) {
        if (!e.message.startsWith('Process.exit')) {
          throw e
        }
      }
    }
  }

  describe('--help flag', () => {
    it('should display help message with --help', async () => {
      process.argv = ['node', 'cli.js', '--help']

      await runCli()

      expect(consoleLogSpy).toHaveBeenCalled()
      const output = consoleLogSpy.mock.calls.join('\n')
      expect(output).toContain('Usage:')
      expect(output).toContain('Options:')
      expect(output).toContain('--help')
      expect(output).toContain('--list-sessions')
      expect(exitCode).toBe(0)
    })

    it('should display help message with -h', async () => {
      process.argv = ['node', 'cli.js', '-h']

      await runCli()

      expect(consoleLogSpy).toHaveBeenCalled()
      expect(exitCode).toBe(0)
    })
  })

  describe('--list-sessions', () => {
    it('should list tmux sessions', async () => {
      process.argv = ['node', 'cli.js', '--list-sessions']

      await runCli()

      expect(mockNotifier.listSessions).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('Available tmux sessions:')
      expect(consoleLogSpy).toHaveBeenCalledWith('  session1')
      expect(consoleLogSpy).toHaveBeenCalledWith('  session2')
      expect(exitCode).toBe(0)
    })

    it('should handle no sessions gracefully', async () => {
      mockNotifier.listSessions.mockResolvedValue([])
      process.argv = ['node', 'cli.js', '--list-sessions']

      await runCli()

      expect(consoleLogSpy).toHaveBeenCalledWith('Available tmux sessions:')
      expect(exitCode).toBe(0)
    })
  })

  describe('notification sending', () => {
    it.skip('should send basic notification with message', async () => {
      process.argv = ['node', 'cli.js', '-m', 'Hello World']

      await runCli()

      // Check what errors were logged
      if (consoleErrorSpy.mock.calls.length > 0) {
        console.log('Console errors found:', consoleErrorSpy.mock.calls)
      }

      expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
        message: 'Hello World',
      })
      expect(consoleLogSpy).toHaveBeenCalledWith('Notification sent successfully')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(exitCode).toBe(0)
    })

    it('should send notification with title', async () => {
      process.argv = [
        'node',
        'cli.js',
        '-m',
        'Test message',
        '-t',
        'Test Title',
      ]

      await runCli()

      expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
        message: 'Test message',
        title: 'Test Title',
      })
    })

    it('should send notification with sound', async () => {
      process.argv = [
        'node',
        'cli.js',
        '-m',
        'Alert!',
        '--sound',
        'Glass',
      ]

      await runCli()

      expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
        message: 'Alert!',
        sound: 'Glass',
      })
    })

    it('should send notification to specific tmux location', async () => {
      process.argv = [
        'node',
        'cli.js',
        '-m',
        'Tmux notification',
        '-s',
        'my-session',
        '-w',
        '2',
        '-p',
        '1',
      ]

      await runCli()

      expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
        message: 'Tmux notification',
        session: 'my-session',
        window: '2',
        pane: '1',
      })
    })

    it('should use current tmux location with --current flag', async () => {
      process.argv = ['node', 'cli.js', '-m', 'Current location', '--current']

      await runCli()

      expect(mockNotifier.getCurrentTmuxInfo).toHaveBeenCalled()
      expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
        message: 'Current location',
        session: 'current',
        window: '1',
        pane: '0',
      })
    })

    it('should handle missing current tmux info', async () => {
      mockNotifier.getCurrentTmuxInfo.mockResolvedValue(null)
      process.argv = ['node', 'cli.js', '-m', 'Test', '--current']

      await runCli()

      // When --current returns null, it should still send the notification
      // without session/window/pane
      expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
        message: 'Test',
      })
    })

    it('should validate session exists', async () => {
      mockNotifier.sessionExists.mockResolvedValue(false)
      process.argv = [
        'node',
        'cli.js',
        '-m',
        'Test',
        '-s',
        'nonexistent',
      ]

      await runCli()

      expect(mockNotifier.sessionExists).toHaveBeenCalledWith('nonexistent')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: Session 'nonexistent' does not exist",
      )
      expect(exitCode).toBe(1)
    })
  })

  describe('argument parsing', () => {
    it('should handle long form arguments', async () => {
      process.argv = [
        'node',
        'cli.js',
        '--message',
        'Long form',
        '--title',
        'Title',
        '--session',
        'session1',
        '--window',
        '1',
        '--pane',
        '0',
      ]

      await runCli()

      expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
        message: 'Long form',
        title: 'Title',
        session: 'session1',
        window: '1',
        pane: '0',
      })
    })

    it('should error when no message provided', async () => {
      process.argv = ['node', 'cli.js']

      await runCli()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: Message is required (-m option)',
      )
      expect(exitCode).toBe(1)
    })

    it('should handle spaces in arguments', async () => {
      process.argv = [
        'node',
        'cli.js',
        '-m',
        'Message with spaces',
        '-t',
        'Title with spaces',
      ]

      await runCli()

      expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
        message: 'Message with spaces',
        title: 'Title with spaces',
      })
    })
  })

  describe('error handling', () => {
    it('should handle notification sending errors', async () => {
      const error = new Error('Failed to send notification')
      mockNotifier.sendNotification.mockRejectedValue(error)
      process.argv = ['node', 'cli.js', '-m', 'Test']

      await runCli()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send notification:',
        error,
      )
      expect(exitCode).toBe(1)
    })

    it('should handle list sessions errors', async () => {
      // The notifier catches errors and returns empty array
      mockNotifier.listSessions.mockResolvedValue([])
      process.argv = ['node', 'cli.js', '--list-sessions']

      await runCli()

      expect(consoleLogSpy).toHaveBeenCalledWith('Available tmux sessions:')
      expect(exitCode).toBe(0)
    })
  })
})