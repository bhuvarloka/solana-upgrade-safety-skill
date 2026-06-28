#!/bin/bash
# upgrade-safety-skill installer (standard). Installs to ~/.claude.
# Usage: ./install.sh [-y]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/install-lib.sh"

SKILLS_DIR="$HOME/.claude/skills"
COMMANDS_DIR="$HOME/.claude/commands"

AUTO_YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) AUTO_YES=1 ;;
    -h|--help) echo "Usage: ./install.sh [-y]"; exit 0 ;;
    *) die "Unknown option: $arg" ;;
  esac
done

confirm() { [ "$AUTO_YES" -eq 1 ] && return 0; read -r -p "$1 [y/N] " r; [[ "$r" =~ ^[Yy]$ ]]; }

echo -e "${BLUE}Installing upgrade-safety-skill${NC}"
preflight
install_core_skill "$SKILLS_DIR"
install_skill "$SCRIPT_DIR" "$SKILLS_DIR" "$COMMANDS_DIR"
echo -e "${GREEN}Done.${NC} Try: \"Is this Anchor upgrade safe?\" or /check-upgrade"
