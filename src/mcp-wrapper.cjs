#!/usr/bin/env node

// CommonJS wrapper for ES module MCP server
// This ensures compatibility with npm global installs

async function main() {
  try {
    await import('./index.js')
  } catch (error) {
    console.error('Failed to start MCP server:', error)
    process.exit(1)
  }
}

main()