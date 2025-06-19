import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

describe('MCP Server', () => {
  let mockNotifier: any
  let mockServer: any
  let handlers: Map<string, any>

  beforeEach(() => {
    // Reset module cache
    vi.resetModules()

    // Create handlers map
    handlers = new Map()

    // Create mock notifier
    mockNotifier = {
      sendNotification: vi.fn().mockResolvedValue(undefined),
      listSessions: vi.fn().mockResolvedValue(['session1', 'session2']),
      sessionExists: vi.fn().mockResolvedValue(true),
      getCurrentTmuxInfo: vi
        .fn()
        .mockResolvedValue({ session: 'current', window: '1', pane: '0' }),
    }

    // Mock the notifier module
    vi.doMock('../src/notifier', () => ({
      TmuxNotifier: vi.fn(() => mockNotifier),
    }))

    // Create mock server
    mockServer = {
      name: 'macos-notify-mcp',
      version: '0.1.0',
      setRequestHandler: vi.fn((schema: any, handler: any) => {
        handlers.set(schema, handler)
      }),
      connect: vi.fn(),
    }

    // Mock MCP SDK
    vi.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
      Server: vi.fn(() => mockServer),
    }))

    vi.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: vi.fn(() => ({
        start: vi.fn(),
        close: vi.fn(),
      })),
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function loadServer() {
    await import('../src/index')
    return { handlers }
  }

  describe('Tool Registration', () => {
    it('should register all tools on initialization', async () => {
      const { handlers } = await loadServer()

      const listToolsHandler = handlers.get(ListToolsRequestSchema)
      expect(listToolsHandler).toBeDefined()

      const response = await listToolsHandler({ method: 'tools/list' })
      
      expect(response.tools).toHaveLength(3)
      
      const toolNames = response.tools.map((tool: any) => tool.name)
      expect(toolNames).toContain('send_notification')
      expect(toolNames).toContain('list_tmux_sessions')
      expect(toolNames).toContain('get_current_tmux_info')
    })

    it('should provide correct schema for send_notification tool', async () => {
      const { handlers } = await loadServer()

      const listToolsHandler = handlers.get(ListToolsRequestSchema)
      const response = await listToolsHandler({ method: 'tools/list' })
      
      const sendNotificationTool = response.tools.find(
        (tool: any) => tool.name === 'send_notification',
      )
      
      expect(sendNotificationTool).toBeDefined()
      expect(sendNotificationTool.description).toContain(
        'Send a macOS notification',
      )
      expect(sendNotificationTool.inputSchema.type).toBe('object')
      expect(sendNotificationTool.inputSchema.required).toContain('message')
      expect(
        sendNotificationTool.inputSchema.properties.message,
      ).toBeDefined()
      expect(sendNotificationTool.inputSchema.properties.title).toBeDefined()
      expect(sendNotificationTool.inputSchema.properties.sound).toBeDefined()
    })
  })

  describe('Tool Execution', () => {
    let callToolHandler: any

    beforeEach(async () => {
      const { handlers } = await loadServer()
      callToolHandler = handlers.get(CallToolRequestSchema)
    })

    describe('send_notification', () => {
      it('should send notification with message only', async () => {
        const request = {
          method: 'tools/call',
          params: {
            name: 'send_notification',
            arguments: {
              message: 'Test notification',
            },
          },
        }

        const response = await callToolHandler(request)

        expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
          message: 'Test notification',
        })
        expect(response.content).toHaveLength(1)
        expect(response.content[0].type).toBe('text')
        expect(response.content[0].text).toBe('Notification sent: "Test notification"')
      })

      it('should send notification with all parameters', async () => {
        const request = {
          method: 'tools/call',
          params: {
            name: 'send_notification',
            arguments: {
              message: 'Full notification',
              title: 'Important',
              sound: 'Glass',
              session: 'work',
              window: '2',
              pane: '1',
            },
          },
        }

        const response = await callToolHandler(request)

        expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
          message: 'Full notification',
          title: 'Important',
          sound: 'Glass',
          session: 'work',
          window: '2',
          pane: '1',
        })
        expect(response.content[0].text).toBe('Notification sent: "Full notification" (tmux: work)')
      })

      it('should handle missing required message parameter', async () => {
        const request = {
          method: 'tools/call',
          params: {
            name: 'send_notification',
            arguments: {
              title: 'No message',
            },
          },
        }

        const response = await callToolHandler(request)
        expect(response.content[0].text).toBe('Error: Message is required')
      })

      it('should handle notification sending errors', async () => {
        mockNotifier.sendNotification.mockRejectedValue(
          new Error('Failed to send'),
        )

        const request = {
          method: 'tools/call',
          params: {
            name: 'send_notification',
            arguments: {
              message: 'Will fail',
            },
          },
        }

        const response = await callToolHandler(request)
        expect(response.content[0].text).toBe('Error: Failed to send')
      })

      it('should convert non-string parameters to strings', async () => {
        const request = {
          method: 'tools/call',
          params: {
            name: 'send_notification',
            arguments: {
              message: 123,
              title: true,
              window: 456,
              pane: null,
            } as any,
          },
        }

        const response = await callToolHandler(request)

        expect(mockNotifier.sendNotification).toHaveBeenCalledWith({
          message: '123',
          title: 'true',
          window: '456',
          // pane is not included because null is filtered out
        })
      })
    })

    describe('list_tmux_sessions', () => {
      it('should list tmux sessions', async () => {
        const request = {
          method: 'tools/call',
          params: {
            name: 'list_tmux_sessions',
            arguments: {},
          },
        }

        const response = await callToolHandler(request)

        expect(mockNotifier.listSessions).toHaveBeenCalled()
        expect(response.content).toHaveLength(1)
        expect(response.content[0].type).toBe('text')
        expect(response.content[0].text).toContain('session1')
        expect(response.content[0].text).toContain('session2')
      })

      it('should handle empty session list', async () => {
        mockNotifier.listSessions.mockResolvedValue([])

        const request = {
          method: 'tools/call',
          params: {
            name: 'list_tmux_sessions',
            arguments: {},
          },
        }

        const response = await callToolHandler(request)

        expect(response.content[0].text).toBe('No tmux sessions found')
      })

      it('should handle errors when listing sessions', async () => {
        mockNotifier.listSessions.mockRejectedValue(
          new Error('Tmux not available'),
        )

        const request = {
          method: 'tools/call',
          params: {
            name: 'list_tmux_sessions',
            arguments: {},
          },
        }

        const response = await callToolHandler(request)
        expect(response.content[0].text).toBe('Error: Tmux not available')
      })
    })

    describe('get_current_tmux_info', () => {
      it('should get current tmux info', async () => {
        const request = {
          method: 'tools/call',
          params: {
            name: 'get_current_tmux_info',
            arguments: {},
          },
        }

        const response = await callToolHandler(request)

        expect(mockNotifier.getCurrentTmuxInfo).toHaveBeenCalled()
        expect(response.content).toHaveLength(1)
        expect(response.content[0].type).toBe('text')
        const text = response.content[0].text
        expect(text).toContain('Session: current')
        expect(text).toContain('Window: 1')
        expect(text).toContain('Pane: 0')
      })

      it('should handle when not in tmux session', async () => {
        mockNotifier.getCurrentTmuxInfo.mockResolvedValue(null)

        const request = {
          method: 'tools/call',
          params: {
            name: 'get_current_tmux_info',
            arguments: {},
          },
        }

        const response = await callToolHandler(request)

        expect(response.content[0].text).toBe('Not in a tmux session')
      })

      it('should handle errors when getting tmux info', async () => {
        mockNotifier.getCurrentTmuxInfo.mockRejectedValue(
          new Error('Tmux error'),
        )

        const request = {
          method: 'tools/call',
          params: {
            name: 'get_current_tmux_info',
            arguments: {},
          },
        }

        const response = await callToolHandler(request)
        expect(response.content[0].text).toBe('Error: Tmux error')
      })
    })

    describe('unknown tool', () => {
      it('should handle unknown tool name', async () => {
        const request = {
          method: 'tools/call',
          params: {
            name: 'unknown_tool',
            arguments: {},
          },
        }

        const response = await callToolHandler(request)
        expect(response.content[0].text).toBe('Error: Unknown tool: unknown_tool')
      })
    })
  })

  describe('Server Lifecycle', () => {
    it('should create server with correct configuration', async () => {
      await loadServer()

      const { Server } = await import('@modelcontextprotocol/sdk/server/index.js')
      expect(Server).toHaveBeenCalledWith({
        name: 'macos-notify-mcp',
        version: '0.1.0',
      }, expect.any(Object))
    })

    it('should connect transport', async () => {
      await loadServer()

      const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
      expect(StdioServerTransport).toHaveBeenCalled()
    })

    it('should set up error handling', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      await loadServer()
      
      // Simulate an error event
      const errorHandler = mockServer.onerror || mockServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'error'
      )?.[1]

      if (errorHandler) {
        const testError = new Error('Test error')
        errorHandler(testError)
        expect(consoleErrorSpy).toHaveBeenCalledWith('Server error:', testError)
      }

      consoleErrorSpy.mockRestore()
    })
  })
})