#!/usr/bin/env bash
# Android build footprint: report, and clean at three escalating levels.
#
# MEASURED on finn after the first full build (2026-07-27): one build cost ~3.9G.
#   ~/Android/Sdk        7.7G   shared, keep. Gradle AUTO-INSTALLS into here:
#                               ndk/27.1  2.0G  (a dep compiles C++ from source)
#                               build-tools 36 + platform 36 — Expo SDK 57 needs 36,
#                               NOT 34; installing 34 by hand was wasted.
#   ~/.android/avd       ~5G    per AVD; snapshots+userdata grow with use
#   ~/.gradle            1.7G after ONE build — caches per dependency AND a full
#                        Gradle distribution per version ever used. Biggest prunable win.
#   <app>/android        regenerable: `expo prebuild` recreates it from app.config.ts
#
# The last one is the important one: android/ is gitignored and fully derived, so it is
# always safe to delete. Nothing in it is authored.
#
# Usage:
#   ./android-space.sh              report + memory headroom check
#   ./android-space.sh preflight    headroom check only (run BEFORE a build)
#   ./android-space.sh build        drop build outputs, keep the project + caches (fast rebuild)
#   ./android-space.sh project      also drop android/ entirely (next build re-runs prebuild)
#   ./android-space.sh deep         also prune Gradle caches + old distributions (slow rebuild)
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-report}"

human() { [ -e "$1" ] || { echo "-"; return; }; du -sh "$1" 2>/dev/null | head -1 | cut -f1; }

# earlyoom on finn runs with `-m 10 -s 10`, firing when memory AND swap are both under 10%.
# Its --prefer list contains qemu, java and node — which is the ENTIRE Android toolchain:
# the emulator, the Gradle daemon, and Metro. Under pressure an Android session is dismantled
# first, by design. It has already claimed a qemu-system-x86 once (Jul 25).
#
# So check headroom before starting anything expensive, rather than discovering it as a
# mysteriously vanished emulator mid-build.
preflight() {
  local mem swap
  mem=$(free -m | awk '/^Mem:/{printf "%.0f", $7/$2*100}')
  swap=$(free -m | awk '/^Swap:/{if($2>0) printf "%.0f", $4/$2*100; else print 100}')
  echo "headroom: mem ${mem}% avail, swap ${swap}% free  (earlyoom fires at 10% / 10%)"

  local running=""
  pgrep -f qemu-system >/dev/null 2>&1 && running+=" emulator(~3.3G)"
  pgrep -f GradleDaemon >/dev/null 2>&1 && running+=" gradle(~1.3G)"
  [ -n "$(pgrep -f 'expo start' || true)" ] && running+=" metro(~0.5G each)"
  [ -n "$running" ] && echo "running:$running"

  if [ "$mem" -lt 25 ] || [ "$swap" -lt 20 ]; then
    echo "WARNING: low headroom. Free space before building — the emulator, Gradle and Metro"
    echo "         are all preferred earlyoom victims and will be killed before anything else."
    return 1
  fi
  return 0
}

report() {
  echo "disk: $(df -h / | awk 'NR==2{print $4" free of "$2" ("$5" used)"}')"
  echo
  printf "  %-34s %8s  %s\n" "path" "size" "policy"
  printf "  %-34s %8s  %s\n" "~/Android/Sdk"       "$(human "$HOME/Android/Sdk")"        "keep (NDK 2G + build-tools; shared)"
  printf "  %-34s %8s  %s\n" "~/.android/avd"      "$(human "$HOME/.android/avd")"       "keep 1 AVD; wipe userdata if bloated"
  printf "  %-34s %8s  %s\n" "~/.gradle/caches"    "$(human "$HOME/.gradle/caches")"     "prunable (deep)"
  printf "  %-34s %8s  %s\n" "~/.gradle/wrapper"   "$(human "$HOME/.gradle/wrapper")"    "prunable (deep) — one dist per version"
  printf "  %-34s %8s  %s\n" "android/"            "$(human "$APP_DIR/android")"         "REGENERABLE — expo prebuild"
  printf "  %-34s %8s  %s\n" "android/app/build"   "$(human "$APP_DIR/android/app/build")" "REGENERABLE — build output"
  echo
  if pgrep -f "GradleDaemon" > /dev/null 2>&1; then
    echo "  ! Gradle daemon is running (holds ~1-2G RSS). Stop with: ./android-space.sh build"
  fi
}

stop_daemon() {
  # The daemon is a long-lived JVM; it survives the build and keeps its heap.
  if pgrep -f "GradleDaemon" > /dev/null 2>&1; then
    ( cd "$APP_DIR/android" 2>/dev/null && ./gradlew --stop >/dev/null 2>&1 ) || pkill -f GradleDaemon || true
    echo "stopped Gradle daemon"
  fi
}

case "$MODE" in
  report) preflight || true; echo; report ;;
  preflight) preflight ;;
  build)
    stop_daemon
    rm -rf "$APP_DIR/android/app/build" "$APP_DIR/android/build" "$APP_DIR/android/.gradle"
    echo "dropped build outputs"; report ;;
  project)
    stop_daemon
    rm -rf "$APP_DIR/android"
    echo "dropped android/ — next build re-runs prebuild"; report ;;
  deep)
    stop_daemon
    rm -rf "$APP_DIR/android"
    # Keep only the newest Gradle distribution; older ones are dead weight.
    if [ -d "$HOME/.gradle/wrapper/dists" ]; then
      ls -1dt "$HOME/.gradle/wrapper/dists"/* 2>/dev/null | tail -n +2 | xargs -r rm -rf
    fi
    rm -rf "$HOME/.gradle/caches/build-cache-1" "$HOME/.gradle/caches/transforms-"* 2>/dev/null || true
    echo "dropped android/, old Gradle dists, and derived caches"; report ;;
  *) echo "usage: android-space.sh [report|preflight|build|project|deep]" >&2; exit 1 ;;
esac
