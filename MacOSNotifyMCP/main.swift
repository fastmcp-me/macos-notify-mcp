#!/usr/bin/env swift

import Foundation
import UserNotifications
import Cocoa

class MacOSNotifyMCP: NSObject, UNUserNotificationCenterDelegate {
    private let center = UNUserNotificationCenter.current()
    
    override init() {
        super.init()
        center.delegate = self
    }
    
    func requestPermissionAndSendNotification(
        title: String, 
        message: String, 
        sound: String = "default",
        session: String? = nil,
        window: String? = nil,
        pane: String? = nil,
        terminal: String? = nil
    ) {
        center.requestAuthorization(options: [.alert, .sound]) { granted, error in
            if granted {
                self.sendNotification(
                    title: title,
                    message: message,
                    sound: sound,
                    session: session,
                    window: window,
                    pane: pane,
                    terminal: terminal
                )
            } else {
                print("Notification permission denied")
                exit(1)
            }
        }
    }
    
    private func sendNotification(
        title: String,
        message: String,
        sound: String,
        session: String?,
        window: String?,
        pane: String?,
        terminal: String?
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = message
        if sound == "default" {
            content.sound = .default
        } else {
            content.sound = UNNotificationSound(named: UNNotificationSoundName(sound + ".aiff"))
        }
        
        // tmux情報とターミナル情報をuserInfoに格納
        var userInfo: [String: Any] = [:]
        if let session = session {
            userInfo["session"] = session
            if let window = window {
                userInfo["window"] = window
            }
            if let pane = pane {
                userInfo["pane"] = pane
            }
        }
        if let terminal = terminal {
            userInfo["terminal"] = terminal
        }
        content.userInfo = userInfo
        
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        
        center.add(request) { error in
            if let error = error {
                print("Notification error: \(error)")
                exit(1)
            }
            print("Notification sent")
        }
    }
    
    // Handle notification click
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let terminal = userInfo["terminal"] as? String
        
        if let session = userInfo["session"] as? String {
            focusToTmux(
                session: session,
                window: userInfo["window"] as? String,
                pane: userInfo["pane"] as? String,
                terminal: terminal
            )
        } else if let terminal = terminal {
            // tmuxセッションがない場合でもターミナルをアクティブ化
            activateTerminal(preferredTerminal: terminal)
        }
        
        completionHandler()
        
        // Exit after handling click
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            NSApplication.shared.terminate(nil)
        }
    }
    
    private func focusToTmux(session: String, window: String?, pane: String?, terminal: String?) {
        // Activate terminal
        activateTerminal(preferredTerminal: terminal)
        
        // Execute tmux commands
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let tmuxPath = self.findTmuxPath()
            guard !tmuxPath.isEmpty else { return }
            
            // Switch to session
            var tmuxTarget = session
            if let window = window {
                tmuxTarget += ":\(window)"
                if let pane = pane {
                    tmuxTarget += ".\(pane)"
                }
            }
            
            self.runCommand(tmuxPath, args: ["switch-client", "-t", tmuxTarget])
        }
    }
    
    private func activateTerminal(preferredTerminal: String? = nil) {
        // ターミナルタイプからアプリケーション名へのマッピング
        let terminalMap: [String: String] = [
            "VSCode": "Visual Studio Code",
            "Cursor": "Cursor",
            "iTerm2": "iTerm2",
            "Terminal": "Terminal",
            "alacritty": "Alacritty"
        ]
        
        // 検出されたターミナルを優先的に使用
        if let preferred = preferredTerminal,
           let appName = terminalMap[preferred] {
            if isAppRunning(appName) {
                runCommand("/usr/bin/osascript", args: ["-e", "tell application \"\(appName)\" to activate"])
                return
            }
        }
        
        // フォールバック: 実行中のターミナルを探す
        let terminals = ["Alacritty", "iTerm2", "WezTerm", "Terminal", "Visual Studio Code", "Cursor"]
        
        for terminal in terminals {
            if isAppRunning(terminal) {
                runCommand("/usr/bin/osascript", args: ["-e", "tell application \"\(terminal)\" to activate"])
                return
            }
        }
        
        // Default to Terminal.app
        runCommand("/usr/bin/osascript", args: ["-e", "tell application \"Terminal\" to activate"])
    }
    
    private func isAppRunning(_ appName: String) -> Bool {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
        task.arguments = ["-f", appName]
        task.standardOutput = Pipe()
        
        do {
            try task.run()
            task.waitUntilExit()
            return task.terminationStatus == 0
        } catch {
            return false
        }
    }
    
    private func findTmuxPath() -> String {
        let paths = ["/opt/homebrew/bin/tmux", "/usr/local/bin/tmux", "/usr/bin/tmux"]
        
        for path in paths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }
        
        // Search using which
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        task.arguments = ["tmux"]
        let pipe = Pipe()
        task.standardOutput = pipe
        
        do {
            try task.run()
            task.waitUntilExit()
            
            if task.terminationStatus == 0 {
                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                if let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) {
                    return output
                }
            }
        } catch {}
        
        return ""
    }
    
    @discardableResult
    private func runCommand(_ path: String, args: [String]) -> Bool {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: path)
        task.arguments = args
        
        do {
            try task.run()
            task.waitUntilExit()
            return task.terminationStatus == 0
        } catch {
            return false
        }
    }
}

// Main process
let app = NSApplication.shared
app.setActivationPolicy(.accessory) // Run in background (no Dock icon, but can show notification icons)

// Parse arguments
var title = "Claude Code"
var message = ""
var session: String?
var window: String?
var pane: String?
var sound = "default"
var terminal: String?

var i = 1
let args = CommandLine.arguments
while i < args.count {
    switch args[i] {
    case "-t", "--title":
        if i + 1 < args.count {
            title = args[i + 1]
            i += 1
        }
    case "-m", "--message":
        if i + 1 < args.count {
            message = args[i + 1]
            i += 1
        }
    case "-s", "--session":
        if i + 1 < args.count {
            session = args[i + 1]
            i += 1
        }
    case "-w", "--window":
        if i + 1 < args.count {
            window = args[i + 1]
            i += 1
        }
    case "-p", "--pane":
        if i + 1 < args.count {
            pane = args[i + 1]
            i += 1
        }
    case "--sound":
        if i + 1 < args.count {
            sound = args[i + 1]
            i += 1
        }
    case "--terminal":
        if i + 1 < args.count {
            terminal = args[i + 1]
            i += 1
        }
    case "-h", "--help":
        print("""
        Usage:
          MacOSNotifyMCP [options]
        
        Options:
          -t, --title <text>      Notification title (default: "Claude Code")
          -m, --message <text>    Notification message (required)
          -s, --session <name>    tmux session name
          -w, --window <number>   tmux window number
          -p, --pane <number>     tmux pane number
          --sound <name>          Notification sound (default: "default")
          --terminal <type>       Terminal type (VSCode, Cursor, iTerm2, etc.)
        
        Examples:
          MacOSNotifyMCP -m "Build completed"
          MacOSNotifyMCP -t "Build" -m "Success" -s development -w 1 -p 0
        """)
        exit(0)
    default:
        break
    }
    i += 1
}

// Message is required
if message.isEmpty {
    print("Error: Message is required (-m option)")
    exit(1)
}

// Create MacOSNotifyMCP instance and send notification
let notifier = MacOSNotifyMCP()

// Send notification and wait in RunLoop
notifier.requestPermissionAndSendNotification(
    title: title,
    message: message,
    sound: sound,
    session: session,
    window: window,
    pane: pane,
    terminal: terminal
)

// Run the app
app.run()