#!/usr/bin/env bash
# ArmPal — verify Capacitor Local Notifications iOS wiring (SPM project; no root Podfile).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== npm install =="
npm install

echo "== production build =="
npm run build

echo "== cap sync ios =="
npx cap sync ios

PKG_SWIFT="$ROOT/ios/App/CapApp-SPM/Package.swift"
CFG_JSON="$ROOT/ios/App/App/capacitor.config.json"

echo "== grep native registration hints =="
if [[ -f "$PKG_SWIFT" ]]; then
  grep -n "CapacitorLocalNotifications\|local-notifications" "$PKG_SWIFT" || true
else
  echo "MISSING: $PKG_SWIFT"
  exit 1
fi

if [[ -f "$CFG_JSON" ]]; then
  echo "--- capacitor.config.json (synced) ---"
  cat "$CFG_JSON"
else
  echo "MISSING: $CFG_JSON (run npx cap sync ios)"
  exit 1
fi

if [[ -f "$ROOT/ios/App/Podfile" ]]; then
  echo "== pod install (ios/App) =="
  (cd "$ROOT/ios/App" && pod install)
else
  echo "== No ios/App/Podfile — this app uses Swift Package Manager (CapApp-SPM). Skip pod install."
  echo "   Open ios/App/App.xcodeproj in Xcode → Product → Clean Build Folder, then build."
fi

echo ""
echo "Done. Next: Xcode → open ios/App/App.xcodeproj → select iPhone → Run."
echo "In the app: Settings → Reminders → use 'Native bridge diagnostics' and the orange permission button."
