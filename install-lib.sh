# shellcheck shell=bash
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'

SKILL_NAME="upgrade-safety"
CORE_SKILL_NAME="solana-dev"
CORE_SKILL_REPO="https://github.com/solanabr/solana-dev-skill.git"

die() { echo -e "${RED}✗${NC} $1" >&2; exit 1; }

preflight() {
  command -v node >/dev/null || die "node not found — install Node 20+ first."
  [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "Node 20+ required."
  command -v pnpm >/dev/null || die "pnpm not found — see https://pnpm.io/installation"
  command -v git  >/dev/null || die "git not found."
}

install_core_skill() {
  local skills_dir="$1"
  if [ -d "$skills_dir/$CORE_SKILL_NAME" ]; then
    echo -e "${GREEN}✓${NC} core skill '$CORE_SKILL_NAME' already present"; return
  fi
  if confirm "Install core skill '$CORE_SKILL_NAME' from $CORE_SKILL_REPO?"; then
    mkdir -p "$skills_dir"
    git clone --depth 1 "$CORE_SKILL_REPO" "$skills_dir/$CORE_SKILL_NAME" || die "core skill clone failed"
    echo -e "${GREEN}✓${NC} core skill installed"
  else
    echo -e "${YELLOW}!${NC} skipping core skill — install it separately"
  fi
}

install_skill() {
  local src_dir="$1" skills_dir="$2" commands_dir="$3"
  local dest="$skills_dir/$SKILL_NAME"

  rm -rf "$dest"; mkdir -p "$dest"
  cp -R "$src_dir/skill/." "$dest/"
  rsync -a --exclude node_modules --exclude test --exclude vitest.config.ts "$src_dir/engine" "$dest/"
  echo -e "${GREEN}✓${NC} skill installed to $dest"

  echo -e "${BLUE}Installing engine dependencies…${NC}"
  ( cd "$dest/engine" && pnpm install --frozen-lockfile --prod ) || die "engine dependency install failed"

  local fx="$src_dir/fixtures/pairs/identical-safe"
  ( cd "$dest/engine" && pnpm run check-upgrade "$fx/before.json" "$fx/after.json" --out /tmp/upgrade-safety-smoke >/dev/null 2>&1 )
  [ $? -eq 0 ] || die "engine smoke test failed — install is broken"
  echo -e "${GREEN}✓${NC} engine ready (smoke test passed)"

  mkdir -p "$commands_dir"
  cp "$src_dir/commands/check-upgrade.md" "$commands_dir/"
  echo -e "${GREEN}✓${NC} command installed to $commands_dir/check-upgrade.md"
}
