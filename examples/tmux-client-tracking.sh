#!/bin/bash

# tmux client tracking example
# This script demonstrates how to track which terminal emulator is attached to tmux

# Method 1: Setup tmux hooks to track client information
setup_tmux_hooks() {
    # Track when clients attach
    tmux set-hook -g client-attached 'run-shell "echo \"Client attached: #{client_tty} at $(date)\" >> ~/.tmux-client.log"'
    
    # Track when clients change sessions
    tmux set-hook -g client-session-changed 'run-shell "echo \"Client #{client_tty} switched to #{session_name} at $(date)\" >> ~/.tmux-client.log"'
    
    # Track client activity
    tmux set-hook -g after-select-pane 'run-shell "echo \"Pane selected by #{client_tty} in #{session_name}:#{window_index}.#{pane_index} at $(date)\" >> ~/.tmux-client.log"'
}

# Method 2: Get terminal info from active client
get_active_client_terminal() {
    # Get the most recently active client
    local active_client=$(tmux list-clients -F '#{client_tty}:#{client_activity}' | sort -t: -k2 -nr | head -1 | cut -d: -f1)
    
    if [ -n "$active_client" ]; then
        echo "Active client TTY: $active_client"
        
        # Try to find the terminal process
        if command -v lsof >/dev/null 2>&1; then
            echo "Processes using TTY:"
            lsof "$active_client" 2>/dev/null | grep -E '(Cursor|Code|iTerm|Terminal|alacritty)' | head -5
        fi
        
        # Alternative: Check parent processes
        local pids=$(ps aux | grep "$active_client" | grep -v grep | awk '{print $2}')
        for pid in $pids; do
            if [ -f "/proc/$pid/environ" ]; then
                echo "Environment for PID $pid:"
                tr '\0' '\n' < "/proc/$pid/environ" | grep -E '(TERM_PROGRAM|CURSOR_TRACE_ID|VSCODE_IPC_HOOK_CLI|ALACRITTY)'
            fi
        done
    fi
}

# Method 3: Store client info in tmux environment
track_client_terminal() {
    # This would be called when Claude Code starts
    local terminal_type="Unknown"
    
    # Detect terminal type
    if [ -n "$CURSOR_TRACE_ID" ]; then
        terminal_type="Cursor"
    elif [ -n "$VSCODE_IPC_HOOK_CLI" ]; then
        terminal_type="VSCode"
    elif [ "$TERM_PROGRAM" = "iTerm.app" ]; then
        terminal_type="iTerm2"
    elif [ "$TERM_PROGRAM" = "Apple_Terminal" ]; then
        terminal_type="Terminal"
    elif [ -n "$ALACRITTY_WINDOW_ID" ]; then
        terminal_type="alacritty"
    fi
    
    # Store in tmux environment
    tmux set-environment -g "CLAUDE_CODE_TERMINAL_${TMUX_PANE}" "$terminal_type"
    tmux set-environment -g "CLAUDE_CODE_STARTED_$(date +%s)" "$terminal_type:$TMUX_PANE"
}

# Method 4: Real-time client detection
detect_current_client() {
    # Get current pane
    local current_pane=$(tmux display-message -p '#{pane_id}')
    
    # Find which client is currently viewing this pane
    tmux list-clients -F '#{client_tty}:#{client_session}:#{session_id}:#{window_id}:#{pane_id}' | while IFS=: read -r tty session session_id window_id pane_id; do
        # Check if this client is viewing our pane
        local client_pane=$(tmux display-message -t "$tty" -p '#{pane_id}' 2>/dev/null)
        if [ "$client_pane" = "$current_pane" ]; then
            echo "Client $tty is viewing this pane"
            # Now detect terminal from this TTY
        fi
    done
}

# Example usage
case "${1:-}" in
    "setup")
        setup_tmux_hooks
        echo "tmux hooks configured"
        ;;
    "track")
        track_client_terminal
        echo "Terminal tracked: $(tmux show-environment -g | grep CLAUDE_CODE_TERMINAL)"
        ;;
    "detect")
        get_active_client_terminal
        ;;
    "current")
        detect_current_client
        ;;
    *)
        echo "Usage: $0 {setup|track|detect|current}"
        echo "  setup   - Configure tmux hooks for client tracking"
        echo "  track   - Track current terminal in tmux environment"
        echo "  detect  - Detect active client's terminal"
        echo "  current - Detect which client is viewing current pane"
        ;;
esac