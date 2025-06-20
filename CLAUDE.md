# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server for macOS notifications with tmux integration. The project consists of:
- A TypeScript-based MCP server and CLI tool
- A native macOS Swift application (MacOSNotifyMCP.app) that handles notifications

## Key Commands

### Development
```bash
npm install          # Install dependencies
npm run build        # Build TypeScript to dist/
npm run dev          # Run MCP server in watch mode
npm run build-app    # Build the macOS app bundle (MacOSNotifyMCP.app)
```

### Linting & Formatting
```bash
npm run lint         # Run biome linter with auto-fix
npm run format       # Format code with biome
npm run check        # Check code without modifications
```

### Testing
```bash
npm test             # Build and test CLI help output
node dist/cli.js -m "test" --current-tmux  # Test notification with current tmux session
```

## Architecture

### Core Components

1. **MCP Server** (`src/index.ts`)
   - Implements Model Context Protocol server
   - Provides tools: `send_notification`, `list_tmux_sessions`, `get_current_tmux_info`
   - Uses StdioServerTransport for communication

2. **Notifier Core** (`src/notifier.ts`)
   - Main notification logic
   - Searches for MacOSNotifyMCP.app in multiple locations
   - Handles tmux session detection and validation
   - Uses `spawn` for subprocess management (not `exec`)

3. **CLI Interface** (`src/cli.js`)
   - Command-line tool for direct notification sending
   - Argument parsing for tmux session/window/pane
   - Session validation before sending notifications

4. **MacOSNotifyMCP.app** (`MacOSNotifyMCP/main.swift`)
   - Native macOS app using UserNotifications API
   - Handles notification clicks to focus tmux sessions
   - Runs as background process (no Dock icon)
   - Supports multiple concurrent notifications via `-n` flag

### Key Design Decisions

1. **Single Notification Method**: All notifications go through MacOSNotifyMCP.app (no osascript fallbacks)
2. **App Bundling**: MacOSNotifyMCP.app is included in the npm package, no post-install scripts
3. **App Discovery**: MacOSNotifyMCP.app is searched in order:
   - Package installation directory (primary)
   - Current working directory (development)
4. **Process Management**: Each notification spawns a new MacOSNotifyMCP.app instance
5. **Error Handling**: Commands use `spawn` to properly handle arguments with special characters

## Important Notes

- The project uses ES modules (`"type": "module"` in package.json)
- MacOSNotifyMCP.app is pre-built and included in the npm package
- The app uses ad-hoc signing
- Biome is configured for linting/formatting (config embedded in package.json)
- tmux integration requires tmux to be installed and running
- The app path is resolved from the npm package installation directory

## MCP Tools Usage

When this project is installed as an MCP server, use these tools for notifications:

### Available MCP Tools

1. **send_notification** - Send macOS notifications
   - Required: `message` (string)
   - Optional: `title`, `sound`, `session`, `window`, `pane`, `useCurrent`
   - Example: "Send a notification with message 'Build completed'"

2. **list_tmux_sessions** - List available tmux sessions
   - No parameters required
   - Returns list of active tmux sessions

3. **get_current_tmux_info** - Get current tmux location
   - No parameters required
   - Returns current session, window, and pane

### Usage Examples

When users ask about notifications or tmux, actively use these tools:

- "Notify me when done" → Use `send_notification` with appropriate message
- "Send notification to current tmux" → Use `send_notification` with `useCurrent: true`
- "What tmux sessions are available?" → Use `list_tmux_sessions`
- "Where am I in tmux?" → Use `get_current_tmux_info`

### Interactive Patterns

When waiting for user input, always send a notification first:

1. **Before asking for confirmation**:
   ```
   send_notification("Build complete. Waiting for deployment confirmation")
   // Then ask: "Deploy to production?"
   ```

2. **When presenting options**:
   ```
   send_notification("Multiple matches found. Please choose in terminal")
   // Then show options
   ```

3. **On errors requiring user decision**:
   ```
   send_notification("Error encountered. Need your input to proceed")
   // Then present error and options
   ```

### Testing Commands

For development testing, use these CLI commands:
```bash
# Test notification directly
node dist/cli.js -m "Test message"

# Test with current tmux session
node dist/cli.js -m "Test message" --current-tmux

# List tmux sessions
node dist/cli.js --list-sessions
```