#!/bin/bash
# upgrade-safety-skill installer (standard). Installs to ~/.claude/skills.
# Usage: ./install.sh [-y]
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
SKILL_NAME="upgrade-safety"
CORE_SKILL_NAME="solana-dev"
CORE_SKILL_REPO="https://github.com/solanabr/solana-dev-skill.git"
COMMANDS_DIR="$HOME/.claude/commands"

AUTO_YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) AUTO_YES=1 ;;
    -h|--help) echo "Usage: ./install.sh [-y]"; exit 0 ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

confirm() {
  [ "$AUTO_YES" -eq 1 ] && return 0
  read -r -p "$1 [y/N] " r; [[ "$r" =~ ^[Yy]$ ]]
}

echo -e "${BLUE}Installing upgrade-safety-skill${NC}"

# 1. core skill (solana-dev) — clone if missing
if [ ! -d "$SKILLS_DIR/$CORE_SKILL_NAME" ]; then
  if confirm "Install core skill '$CORE_SKILL_NAME' from $CORE_SKILL_REPO?"; then
    mkdir -p "$SKILLS_DIR"
    git clone --depth 1 "$CORE_SKILL_REPO" "$SKILLS_DIR/$CORE_SKILL_NAME"
    echo -e "${GREEN}✓${NC} core skill installed"
  else
    echo -e "${YELLOW}!${NC} skipping core skill — this skill extends it; install it separately"
  fi
else
  echo -e "${GREEN}✓${NC} core skill '$CORE_SKILL_NAME' already present"
fi

# 2. this skill
mkdir -p "$SKILLS_DIR/$SKILL_NAME"
cp -R "$SCRIPT_DIR/skill/." "$SKILLS_DIR/$SKILL_NAME/"
echo -e "${GREEN}✓${NC} skill installed to $SKILLS_DIR/$SKILL_NAME"

# 3. command
mkdir -p "$COMMANDS_DIR"
cp "$SCRIPT_DIR/commands/check-upgrade.md" "$COMMANDS_DIR/"
echo -e "${GREEN}✓${NC} command installed to $COMMANDS_DIR/check-upgrade.md"

echo -e "${GREEN}Done.${NC} Try: \"Is this Anchor upgrade safe?\" or /check-upgrade"
