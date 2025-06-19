#!/bin/bash
# Create complete macOS app bundle

APP_NAME="MacOSNotifyMCP"
APP_DIR="${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

# Create directory structure
mkdir -p "${MACOS_DIR}"
mkdir -p "${RESOURCES_DIR}"

# Create Info.plist
cat > "${CONTENTS_DIR}/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.macos-notify-mcp.app</string>
    <key>CFBundleName</key>
    <string>MacOSNotifyMCP</string>
    <key>CFBundleDisplayName</key>
    <string>MacOSNotifyMCP</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleExecutable</key>
    <string>MacOSNotifyMCP</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSUserNotificationAlertStyle</key>
    <string>alert</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>NSSupportsAutomaticTermination</key>
    <true/>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
    </dict>
    <key>CFBundleIconFile</key>
    <string>MacOSNotifyMCP</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
EOF

# Copy icon file to Resources directory
if [ -f "${APP_NAME}.icns" ]; then
    cp "${APP_NAME}.icns" "${RESOURCES_DIR}/"
    echo "Icon file copied: ${APP_NAME}.icns"
else
    echo "Warning: Icon file ${APP_NAME}.icns not found"
fi

# Compile Swift binary and place it in the app
swiftc -o "${MACOS_DIR}/${APP_NAME}" main.swift

# Add signature to app (ad-hoc signing)
echo "Signing app..."
codesign --force --deep --sign - "${APP_DIR}"

echo "App bundle created: ${APP_DIR}"
echo "Usage: open ${APP_DIR} --args -m \"Test message\""
echo "Bundle ID: com.macos-notify-mcp.app"