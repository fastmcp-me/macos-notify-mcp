#!/usr/bin/env node

// CommonJS wrapper for ES module CLI
// This ensures compatibility with npm global installs

async function main() {
  try {
    const { main } = await import('./cli.js')
    await main()
  } catch (error) {
    console.error('Failed to load CLI:', error)
    process.exit(1)
  }
}

main()