import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { TmuxNotifier } from './notifier.js'

interface NotificationOptions {
  message: string
  title?: string
  sound?: string
  session?: string
  window?: string
  pane?: string
}

const server = new Server(
  {
    name: 'macos-notify-mcp',
    version: '0.0.3',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

const notifier = new TmuxNotifier()

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'send_notification',
        description: 'Send a macOS notification with optional tmux integration',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The notification message',
            },
            title: {
              type: 'string',
              description: 'The notification title (default: "Claude Code")',
            },
            sound: {
              type: 'string',
              description: 'The notification sound (default: "Glass")',
            },
            session: {
              type: 'string',
              description: 'tmux session name',
            },
            window: {
              type: 'string',
              description: 'tmux window number',
            },
            pane: {
              type: 'string',
              description: 'tmux pane number',
            },
            useCurrent: {
              type: 'boolean',
              description: 'Use current tmux location',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'list_tmux_sessions',
        description: 'List available tmux sessions',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_current_tmux_info',
        description: 'Get current tmux session information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (!args) {
    throw new Error('No arguments provided')
  }

  try {
    switch (name) {
      case 'send_notification': {
        // Safely extract properties from args
        const notificationArgs = args as Record<string, unknown>

        // Validate message is provided
        if (!notificationArgs.message) {
          throw new Error('Message is required')
        }

        const options: NotificationOptions = {
          message: String(notificationArgs.message),
          title: notificationArgs.title
            ? String(notificationArgs.title)
            : undefined,
          sound: notificationArgs.sound
            ? String(notificationArgs.sound)
            : undefined,
        }

        if (notificationArgs.useCurrent) {
          const current = await notifier.getCurrentTmuxInfo()
          if (current) {
            options.session = current.session
            options.window = current.window
            options.pane = current.pane
          }
        } else {
          if (notificationArgs.session)
            options.session = String(notificationArgs.session)
          if (notificationArgs.window)
            options.window = String(notificationArgs.window)
          if (notificationArgs.pane)
            options.pane = String(notificationArgs.pane)
        }

        // Validate session if specified
        if (options.session) {
          const exists = await notifier.sessionExists(options.session)
          if (!exists) {
            const sessions = await notifier.listSessions()
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Session '${options.session}' does not exist. Available sessions: ${sessions.join(', ')}`,
                },
              ],
            }
          }
        }

        await notifier.sendNotification(options)

        return {
          content: [
            {
              type: 'text',
              text: `Notification sent: "${options.message}"${options.session ? ` (tmux: ${options.session})` : ''}`,
            },
          ],
        }
      }

      case 'list_tmux_sessions': {
        const sessions = await notifier.listSessions()
        return {
          content: [
            {
              type: 'text',
              text:
                sessions.length > 0
                  ? `Available tmux sessions:\n${sessions.map((s) => `- ${s}`).join('\n')}`
                  : 'No tmux sessions found',
            },
          ],
        }
      }

      case 'get_current_tmux_info': {
        const info = await notifier.getCurrentTmuxInfo()
        if (info) {
          return {
            content: [
              {
                type: 'text',
                text: `Current tmux location:\n- Session: ${info.session}\n- Window: ${info.window}\n- Pane: ${info.pane}`,
              },
            ],
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: 'Not in a tmux session',
            },
          ],
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('macOS Notify MCP server started')
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
