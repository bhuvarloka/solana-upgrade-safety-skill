#!/bin/bash
# upgrade-safety-skill installer (custom location).
# Usage: ./install-custom.sh [--project | --path <dir>] [-y]
#   --project     install into ./.claude/skills (this repo)
#   --path <dir>  install into <dir>/skills
#   (default)     install into ~/.claude/skills
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="upgrade-safety"
CORE_SKILL_NAME="solana-dev"
CORE_SKILL_REPO="https://github.com/solanabr/solana-dev-skill.git"

BASE="$HOME/.claude"
AUTO_YES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) BASE=".claude"; shift ;;
    --path) BASE="$2"; shift 2 ;;
    -y|--yes) AUTO_YES=1; shift ;;
    -h|--help) echo "Usage: ./install-custom.sh [--project | --path <dir>] [-y]"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

SKILLS_DIR="$BASE/skills"
COMMANDS_DIR="$BASE/commands"

confirm() {
  [ "$AUTO_YES" -eq 1 ] && return 0
  read -r -p "$1 [y/N] " r; [[ "$r" =~ ^[Yy]$ ]]
}

echo -e "${BLUE}Installing upgrade-safety-skill into $BASE${NC}"

if [ ! -d "$SKILLS_DIR/$CORE_SKILL_NAME" ]; then
  if confirm "Install core skill '$CORE_SKILL_NAME'?"; then
    mkdir -p "$SKILLS_DIR"
    git clone --depth 1 "$CORE_SKILL_REPO" "$SKILLS_DIR/$CORE_SKILL_NAME"
    echo -e "${GREEN}✓${NC} core skill installed"
  else
    echo -e "${YELLOW}!${NC} skipping core skill — install it separately"
  fi
else
  echo -e "${GREEN}✓${NC} core skill already present"
fi

mkdir -p "$SKILLS_DIR/$SKILL_NAME"
cp -R "$SCRIPT_DIR/skill/." "$SKILLS_DIR/$SKILL_NAME/"
echo -e "${GREEN}✓${NC} skill installed to $SKILLS_DIR/$SKILL_NAME"

mkdir -p "$COMMANDS_DIR"
cp "$SCRIPT_DIR/commands/check-upgrade.md" "$COMMANDS_DIR/"
echo -e "${GREEN}✓${NC} command installed to $COMMANDS_DIR/check-upgrade.md"

echo -e "${GREEN}Done.${NC}"
