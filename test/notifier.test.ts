import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest'
import { TmuxNotifier } from '../src/notifier'
import type { ChildProcess } from 'node:child_process'

// Mock modules
vi.mock('node:child_process')
vi.mock('node:fs')
vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(() => '/mocked/path/notifier.js'),
}))

describe('TmuxNotifier', () => {
  let notifier: TmuxNotifier
  let mockSpawn: Mock
  let mockExistsSync: Mock

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Get mocked functions
    const childProcess = await import('node:child_process')
    const fs = await import('node:fs')
    mockSpawn = childProcess.spawn as unknown as Mock
    mockExistsSync = fs.existsSync as unknown as Mock

    // Default mock implementations
    mockExistsSync.mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should use custom app path when provided', () => {
      const customPath = '/custom/path/to/MacOSNotifyMCP.app'
      notifier = new TmuxNotifier(customPath)
      expect(notifier['appPath']).toBe(customPath)
    })

    it('should find app in default locations when no custom path provided', () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes('MacOSNotifyMCP/MacOSNotifyMCP.app')
      })

      notifier = new TmuxNotifier()
      expect(notifier['appPath']).toContain('MacOSNotifyMCP.app')
    })

    it('should handle missing app gracefully', () => {
      mockExistsSync.mockReturnValue(false)
      notifier = new TmuxNotifier()
      // Should default to first possible path even if it doesn't exist
      expect(notifier['appPath']).toContain('MacOSNotifyMCP.app')
    })
  })

  describe('runCommand', () => {
    beforeEach(() => {
      notifier = new TmuxNotifier('/test/app/path')
    })

    it('should execute command successfully', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess)

      const result = notifier['runCommand']('echo', ['hello'])

      // Simulate successful execution
      mockProcess.stdout.emit('data', Buffer.from('hello'))
      mockProcess.emit('close', 0)

      expect(await result).toBe('hello')
      expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello'])
    })

    it('should handle command failure with non-zero exit code', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess)

      const promise = notifier['runCommand']('false', [])

      // Simulate failure
      mockProcess.stderr.emit('data', Buffer.from('Command failed'))
      mockProcess.emit('close', 1)

      await expect(promise).rejects.toThrow('Command failed: false')
    })

    it('should handle spawn errors', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess)

      const promise = notifier['runCommand']('nonexistent', [])

      // Simulate spawn error
      mockProcess.emit('error', new Error('spawn ENOENT'))

      await expect(promise).rejects.toThrow('spawn ENOENT')
    })

    it('should accumulate stdout and stderr data', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess)

      const result = notifier['runCommand']('test', [])

      // Emit multiple data chunks
      mockProcess.stdout.emit('data', Buffer.from('Hello '))
      mockProcess.stdout.emit('data', Buffer.from('World'))
      mockProcess.stderr.emit('data', Buffer.from('Warning'))
      mockProcess.emit('close', 0)

      expect(await result).toBe('Hello World')
    })
  })

  describe('getCurrentTmuxInfo', () => {
    beforeEach(() => {
      notifier = new TmuxNotifier('/test/app/path')
    })

    it('should return current tmux session info', async () => {
      const runCommandSpy = vi
        .spyOn(notifier as any, 'runCommand')
        .mockResolvedValueOnce('my-session')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('0')

      const result = await notifier.getCurrentTmuxInfo()

      expect(result).toEqual({
        session: 'my-session',
        window: '1',
        pane: '0',
      })
      expect(runCommandSpy).toHaveBeenCalledTimes(3)
    })

    it('should return null when not in tmux session', async () => {
      const runCommandSpy = vi
        .spyOn(notifier as any, 'runCommand')
        .mockRejectedValue(new Error('not in tmux'))

      const result = await notifier.getCurrentTmuxInfo()

      expect(result).toBeNull()
      expect(runCommandSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('listSessions', () => {
    beforeEach(() => {
      notifier = new TmuxNotifier('/test/app/path')
    })

    it('should return list of tmux sessions', async () => {
      const runCommandSpy = vi
        .spyOn(notifier as any, 'runCommand')
        .mockResolvedValue('session1\nsession2\nsession3\n')

      const result = await notifier.listSessions()

      expect(result).toEqual(['session1', 'session2', 'session3'])
      expect(runCommandSpy).toHaveBeenCalledWith('tmux', [
        'list-sessions',
        '-F',
        '#{session_name}',
      ])
    })

    it('should return empty array when no sessions exist', async () => {
      const runCommandSpy = vi
        .spyOn(notifier as any, 'runCommand')
        .mockRejectedValue(new Error('no sessions'))

      const result = await notifier.listSessions()

      expect(result).toEqual([])
    })

    it('should filter out empty lines', async () => {
      const runCommandSpy = vi
        .spyOn(notifier as any, 'runCommand')
        .mockResolvedValue('session1\n\nsession2\n\n')

      const result = await notifier.listSessions()

      expect(result).toEqual(['session1', 'session2'])
    })
  })

  describe('sessionExists', () => {
    beforeEach(() => {
      notifier = new TmuxNotifier('/test/app/path')
    })

    it('should return true when session exists', async () => {
      const listSessionsSpy = vi
        .spyOn(notifier, 'listSessions')
        .mockResolvedValue(['session1', 'session2', 'my-session'])

      const result = await notifier.sessionExists('my-session')

      expect(result).toBe(true)
      expect(listSessionsSpy).toHaveBeenCalled()
    })

    it('should return false when session does not exist', async () => {
      const listSessionsSpy = vi
        .spyOn(notifier, 'listSessions')
        .mockResolvedValue(['session1', 'session2'])

      const result = await notifier.sessionExists('nonexistent')

      expect(result).toBe(false)
    })

    it('should handle empty session list', async () => {
      const listSessionsSpy = vi
        .spyOn(notifier, 'listSessions')
        .mockResolvedValue([])

      const result = await notifier.sessionExists('any-session')

      expect(result).toBe(false)
    })
  })

  describe('sendNotification', () => {
    beforeEach(() => {
      notifier = new TmuxNotifier('/test/app/path')
    })

    it('should send basic notification with message only', async () => {
      const runCommandSpy = vi
        .spyOn(notifier as any, 'runCommand')
        .mockResolvedValue('')

      await notifier.sendNotification({ message: 'Hello World' })

      expect(runCommandSpy).toHaveBeenCalledWith('/usr/bin/open', [
        '-n',
        '/test/app/path',
        '--args',
        '-t',
        'macos-notify-mcp',
        '-m',
        'Hello World',
        '--sound',
        'Glass',
      ])
    })

    it('should send notification with all options', async () => {
      const runCommandSpy = vi
        .spyOn(notifier as any, 'runCommand')
        .mockResolvedValue('')

      await notifier.sendNotification({
        message: 'Test message',
        title: 'Test Title',
        sound: 'Glass',
        session: 'my-session',
        window: '2',
        pane: '1',
      })

      expect(runCommandSpy).toHaveBeenCalledWith('/usr/bin/open', [
        '-n',
        '/test/app/path',
        '--args',
        '-t',
        'Test Title',
        '-m',
        'Test message',
        '--sound',
        'Glass',
        '-s',
        'my-session',
        '-w',
        '2',
        '-p',
        '1',
      ])
    })

    it('should handle empty app path', async () => {
      notifier = new TmuxNotifier()
      notifier['appPath'] = ''

      await expect(
        notifier.sendNotification({ message: 'Test' }),
      ).rejects.toThrow('MacOSNotifyMCP.app not found')
    })

    it('should escape special characters in arguments', async () => {
      const runCommandSpy = vi
        .spyOn(notifier as any, 'runCommand')
        .mockResolvedValue('')

      await notifier.sendNotification({
        message: 'Message with "quotes"',
        title: "Title with 'apostrophes'",
      })

      const call = runCommandSpy.mock.calls[0]
      expect(call[1]).toContain('Message with "quotes"')
      expect(call[1]).toContain('-t')
      expect(call[1]).toContain("Title with 'apostrophes'")
    })

    it('should omit undefined optional parameters', async () => {
      const runCommandSpy = vi
        .spyOn(notifier as any, 'runCommand')
        .mockResolvedValue('')

      await notifier.sendNotification({
        message: 'Simple message',
        title: 'Title',
        // Other options undefined
      })

      const args = runCommandSpy.mock.calls[0][1]
      expect(args).toEqual([
        '-n',
        '/test/app/path',
        '--args',
        '-t',
        'Title',
        '-m',
        'Simple message',
        '--sound',
        'Glass',
      ])
      expect(args).not.toContain('-s')
      expect(args).not.toContain('-w')
      expect(args).not.toContain('-p')
    })
  })
})

// Helper function to create a mock child process
function createMockProcess(): Partial<ChildProcess> {
  const EventEmitter = require('node:events').EventEmitter
  const stdout = new EventEmitter()
  const stderr = new EventEmitter()
  const process = new EventEmitter()

  return Object.assign(process, {
    stdout,
    stderr,
    stdin: {
      end: vi.fn(),
    },
    kill: vi.fn(),
    pid: 12345,
  }) as unknown as ChildProcess
}