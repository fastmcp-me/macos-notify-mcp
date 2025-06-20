#!/usr/bin/env node

import { TmuxNotifier } from './notifier.js'

interface CliOptions {
  message: string
  title?: string
  sound?: string
  session?: string
  window?: string
  pane?: string
}

export async function main() {
  const notifier = new TmuxNotifier()

  // Parse command line arguments
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  macos-notify-cli [options]

Options:
  -m, --message <text>    Notification message (required)
  -t, --title <text>      Notification title (default: "Claude Code")
  -s, --session <name>    tmux session name
  -w, --window <number>   tmux window number
  -p, --pane <number>     tmux pane number
  --sound <name>          Notification sound (default: "Glass")
  --current-tmux          Use current tmux location
  --list-sessions         List available tmux sessions
  -h, --help              Show this help message

Examples:
  # Basic notification
  macos-notify-cli -m "Build completed"
  
  # Navigate to specific session
  macos-notify-cli -m "Tests passed" -s development -w 1 -p 0
  
  # Use current tmux location
  macos-notify-cli -m "Task finished" --current-tmux
    `)
    process.exit(0)
  }

  if (args.includes('--list-sessions')) {
    const sessions = await notifier.listSessions()
    console.log('Available tmux sessions:')
    sessions.forEach((s) => console.log(`  ${s}`))
    process.exit(0)
  }

  // Parse arguments
  const options: CliOptions = {
    message: '',
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-m':
      case '--message':
        options.message = args[++i]
        break
      case '-t':
      case '--title':
        options.title = args[++i]
        break
      case '-s':
      case '--session':
        options.session = args[++i]
        break
      case '-w':
      case '--window':
        options.window = args[++i]
        break
      case '-p':
      case '--pane':
        options.pane = args[++i]
        break
      case '--sound':
        options.sound = args[++i]
        break
      case '--current-tmux': {
        const current = await notifier.getCurrentTmuxInfo()
        if (current) {
          options.session = current.session
          options.window = current.window
          options.pane = current.pane
        }
        break
      }
    }
  }

  if (!options.message) {
    console.error('Error: Message is required (-m option)')
    process.exit(1)
  }

  // Check if session exists
  if (options.session) {
    const exists = await notifier.sessionExists(options.session)
    if (!exists) {
      console.error(`Error: Session '${options.session}' does not exist`)
      const sessions = await notifier.listSessions()
      if (sessions.length > 0) {
        console.log('\nAvailable sessions:')
        sessions.forEach((s) => console.log(`  ${s}`))
      }
      process.exit(1)
    }
  }

  // Send notification
  try {
    await notifier.sendNotification(options)
    console.log('Notification sent successfully')
    process.exit(0)
  } catch (error) {
    console.error('Failed to send notification:', error)
    process.exit(1)
  }
}

// Export for testing (already exported as function declaration)

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
