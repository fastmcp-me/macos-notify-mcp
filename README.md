[![Add to Cursor](https://fastmcp.me/badges/cursor_dark.svg)](https://fastmcp.me/MCP/Details/887/macos-notifications-with-tmux)
[![Add to VS Code](https://fastmcp.me/badges/vscode_dark.svg)](https://fastmcp.me/MCP/Details/887/macos-notifications-with-tmux)
[![Add to Claude](https://fastmcp.me/badges/claude_dark.svg)](https://fastmcp.me/MCP/Details/887/macos-notifications-with-tmux)
[![Add to ChatGPT](https://fastmcp.me/badges/chatgpt_dark.svg)](https://fastmcp.me/MCP/Details/887/macos-notifications-with-tmux)
[![Add to Codex](https://fastmcp.me/badges/codex_dark.svg)](https://fastmcp.me/MCP/Details/887/macos-notifications-with-tmux)
[![Add to Gemini](https://fastmcp.me/badges/gemini_dark.svg)](https://fastmcp.me/MCP/Details/887/macos-notifications-with-tmux)

# macOS Notify MCP

A Model Context Protocol (MCP) server for macOS notifications with tmux integration. This tool allows AI assistants like Claude to send native macOS notifications that can focus specific tmux sessions when clicked.

## Features

- 🔔 Native macOS notifications using UserNotifications API
- 🖱️ Clickable notifications that focus tmux sessions
- 🎯 Direct navigation to specific tmux session, window, and pane
- 🔊 Customizable notification sounds
- 🚀 Support for multiple concurrent notifications
- 🤖 MCP server for AI assistant integration
- 🖥️ Terminal emulator detection (VSCode, Cursor, iTerm2, Terminal.app)

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

First, install the package globally:

```bash
npm install -g macos-notify-mcp
```

#### Quick Setup with Claude Code

Use the `claude mcp add` command:

```bash
claude mcp add macos-notify -s user -- macos-notify-mcp
```

Then restart Claude Code.

#### Manual Setup for Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "macos-notify": {
      "command": "macos-notify-mcp"
    }
  }
}
```


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
macos-notify-cli -m "Build completed"

# With title
macos-notify-cli -t "Development" -m "Tests passed"

# With tmux integration
macos-notify-cli -m "Task finished" -s my-session -w 1 -p 0

# Use current tmux location
macos-notify-cli -m "Check this pane" --current-tmux

# Detect current terminal emulator
macos-notify-cli --detect-terminal

# List tmux sessions
macos-notify-cli --list-sessions
```

### Terminal Detection

The tool automatically detects which terminal emulator you're using and uses this information when you click on notifications to focus the correct application. You can test terminal detection with:

```bash
# Test terminal detection
macos-notify-cli --detect-terminal
```

#### Supported Terminal Detection

The tool detects terminals using various methods:

1. **Cursor**: Via `CURSOR_TRACE_ID` environment variable
2. **VSCode**: Via `VSCODE_IPC_HOOK_CLI` or `VSCODE_REMOTE` environment variables
3. **alacritty**: Via `ALACRITTY_WINDOW_ID` or `ALACRITTY_SOCKET` environment variables
4. **iTerm2**: Via `TERM_PROGRAM=iTerm.app`
5. **Terminal.app**: Via `TERM_PROGRAM=Apple_Terminal`

#### Terminal Detection in tmux

When running inside tmux, the tool attempts to detect which terminal emulator the active tmux client is using:

1. **Active Client Detection**: Identifies the most recently active tmux client
2. **TTY Process Analysis**: Traces processes using the client's TTY
3. **Environment Preservation**: Checks preserved environment variables
4. **Process Tree Fallback**: Analyzes the process tree as a last resort

For advanced tmux client tracking, see `examples/tmux-client-tracking.sh`.

## How it Works

1. **Notification Delivery**: Uses a native macOS app bundle (MacOSNotifyMCP.app) to send UserNotifications API notifications
2. **Click Handling**: When a notification is clicked, the app activates the detected terminal emulator (VSCode, Cursor, iTerm2, alacritty, or Terminal.app) and switches to the specified tmux session
3. **Terminal Support**: Automatically detects and activates the correct terminal application
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
3. Verify terminal app is supported (Alacritty, iTerm2, WezTerm, or Terminal)

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