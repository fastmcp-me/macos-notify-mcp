# macOS Notify MCP

A Model Context Protocol (MCP) server for macOS notifications with tmux integration. This tool allows AI assistants like Claude to send native macOS notifications that can focus specific tmux sessions when clicked.

## Features

- 🔔 Native macOS notifications using UserNotifications API
- 🖱️ Clickable notifications that focus tmux sessions
- 🎯 Direct navigation to specific tmux session, window, and pane
- 🔊 Customizable notification sounds
- 🚀 Support for multiple concurrent notifications
- 🤖 MCP server for AI assistant integration

## Installation

### Prerequisites

- macOS (required for notifications)
- Node.js >= 18.0.0
- tmux (optional, for tmux integration)

### Install from npm

```bash
npm install -g macos-notify-mcp
```

### Build from source

```bash
git clone https://github.com/yuki-yano/macos-notify-mcp.git
cd macos-notify-mcp
npm install
npm run build
npm run build-app  # Build the macOS app bundle (only needed for development)
```

## Usage

### As MCP Server

#### Quick Setup with Claude Code

Use the `claude mcp add` command:

```bash
claude mcp add macos-notify -s user -- npx -y macos-notify-mcp
```

Then restart Claude Code.

#### Manual Setup for Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "macos-notify": {
      "command": "npx",
      "args": ["macos-notify-mcp"]
    }
  }
}
```

For detailed setup instructions, see [Claude Code Setup Guide](docs/CLAUDE_CODE_SETUP.md).

### Integrating into Your Projects

To have Claude automatically use notifications in your projects, see [Integration Guide](docs/INTEGRATION_GUIDE.md).

### Available MCP Tools

- `send_notification` - Send a macOS notification
  - `message` (required): Notification message
  - `title`: Notification title (default: "Claude Code")
  - `sound`: Notification sound (default: "Glass")
  - `session`: tmux session name
  - `window`: tmux window number
  - `pane`: tmux pane number
  - `useCurrent`: Use current tmux location

- `list_tmux_sessions` - List available tmux sessions

- `get_current_tmux_info` - Get current tmux session information

### As CLI Tool

```bash
# Basic notification
macos-notify-mcp -m "Build completed"

# With title
macos-notify-mcp -t "Development" -m "Tests passed"

# With tmux integration
macos-notify-mcp -m "Task finished" -s my-session -w 1 -p 0

# Use current tmux location
macos-notify-mcp -m "Check this pane" --current

# List tmux sessions
macos-notify-mcp --list-sessions
```

## How it Works

1. **Notification Delivery**: Uses a native macOS app bundle (MacOSNotifyMCP.app) to send UserNotifications API notifications
2. **Click Handling**: When a notification is clicked, the app activates the terminal and switches to the specified tmux session
3. **Terminal Support**: Works with Alacritty, iTerm2, and Terminal.app
4. **Multiple Instances**: Each notification runs as a separate process, allowing multiple concurrent notifications

## Architecture

The project consists of two main components:

1. **MCP Server/CLI** (TypeScript/Node.js)
   - Implements the Model Context Protocol
   - Provides a command-line interface
   - Manages tmux session detection and validation

2. **MacOSNotifyMCP.app** (Swift/macOS)
   - Native macOS application for notifications
   - Handles notification clicks to focus tmux sessions
   - Runs as a background process for each notification

## MacOSNotifyMCP.app

The MacOSNotifyMCP.app is bundled with the npm package and is automatically available after installation. No additional setup is required.

## Troubleshooting

### Notifications not appearing

1. Check System Settings → Notifications → MacOSNotifyMCP
2. Ensure notifications are allowed
3. Run `macos-notify-mcp -m "test"` to verify

### tmux integration not working

1. Ensure tmux is installed and running
2. Check session names with `macos-notify-mcp --list-sessions`
3. Verify terminal app is supported (Alacritty, iTerm2, or Terminal)

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development
npm run dev

# Lint and format code
npm run lint
npm run format

# Build macOS app (only if modifying Swift code)
npm run build-app
```

## License

MIT

## Author

Yuki Yano