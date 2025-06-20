#!/usr/bin/env node

import { TmuxNotifier } from '../dist/notifier.js'

async function demonstrateTerminalDetection() {
  const notifier = new TmuxNotifier()
  
  console.log('Terminal Detection Example')
  console.log('==========================\n')
  
  // Show environment variables
  console.log('Environment variables:')
  console.log(`  VSCODE_IPC_HOOK_CLI: ${process.env.VSCODE_IPC_HOOK_CLI ? 'Set' : 'Not set'}`)
  console.log(`  TERM_PROGRAM: ${process.env.TERM_PROGRAM || 'Not set'}`)
  console.log(`  TMUX: ${process.env.TMUX ? 'Set' : 'Not set'}\n`)
  
  // Detect terminal
  const terminal = await notifier.getTerminalEmulator()
  console.log(`Detected Terminal: ${terminal}\n`)
  
  // Send notification without terminal info
  console.log('Sending notification without terminal info...')
  await notifier.sendNotification({
    message: 'Standard notification',
    title: 'Test'
  })
  
  // Send notification with terminal info
  console.log('Sending notification with terminal info...')
  await notifier.sendNotification({
    message: 'Notification with terminal detection',
    title: 'Test',
    includeTerminalInfo: true
  })
  
  console.log('\nDone! Check your notifications.')
}

demonstrateTerminalDetection().catch(console.error)