#!/bin/bash
# upgrade-safety-skill installer (custom location).
# Usage: ./install-custom.sh [--project | --path <dir>] [-y]
#   --project     install into ./.claude (this repo)
#   --path <dir>  install into <dir>
#   (default)     install into ~/.claude
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/install-lib.sh"

BASE="$HOME/.claude"
AUTO_YES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) BASE=".claude"; shift ;;
    --path) BASE="$2"; shift 2 ;;
    -y|--yes) AUTO_YES=1; shift ;;
    -h|--help) echo "Usage: ./install-custom.sh [--project | --path <dir>] [-y]"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

confirm() { [ "$AUTO_YES" -eq 1 ] && return 0; read -r -p "$1 [y/N] " r; [[ "$r" =~ ^[Yy]$ ]]; }

echo -e "${BLUE}Installing upgrade-safety-skill into $BASE${NC}"
preflight
install_core_skill "$BASE/skills"
install_skill "$SCRIPT_DIR" "$BASE/skills" "$BASE/commands"
echo -e "${GREEN}Done.${NC}"
