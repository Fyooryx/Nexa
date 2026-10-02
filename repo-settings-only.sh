#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# GitHub Repository Settings Configuration
# Repository: Fyooryx/Nexa
# ============================================================

OWNER="Fyooryx"
REPO="Nexa"
BRANCH="main"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_step() {
  echo -e "\n${YELLOW}[STEP]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================================
# STEP 0: VALIDATION & AUTH
# ============================================================

log_step "0/8 - Verifikasi & Autentikasi"

if ! gh auth status >/dev/null 2>&1; then
  log_error "GitHub CLI belum login"
  log_info "Jalankan: gh auth login"
  log_info "Atau: export GH_TOKEN='your_token_here'"
  exit 1
fi

log_success "GitHub CLI authenticated"

# ============================================================
# STEP 1: CHANGE VISIBILITY TO PUBLIC
# ============================================================

log_step "1/8 - Change Visibility to PUBLIC"

gh repo edit "$OWNER/$REPO" --visibility public

log_success "Repository is now PUBLIC"

# ============================================================
# STEP 2: BASIC REPOSITORY SETTINGS
# ============================================================

log_step "2/8 - Configure Basic Settings"

gh api --method PATCH "repos/$OWNER/$REPO" \
  -f allow_auto_merge=true \
  -f allow_forking=true \
  -f allow_merge_commit=true \
  -f allow_rebase_merge=true \
  -f allow_squash_merge=true \
  -f allow_update_branch=true \
  -f delete_branch_on_merge=true \
  -f has_issues=true \
  -f has_projects=true \
  -f has_discussions=true \
  -f has_wiki=false \
  -f has_downloads=false \
  -f web_commit_signoff_required=true \
  -f is_template=false \
  -f archived=false \
  -f disabled=false \
  -f pull_request_creation_policy='all'

log_success "Basic settings configured"

# ============================================================
# STEP 3: MERGE & COMMIT STRATEGY
# ============================================================

log_step "3/8 - Configure Merge Strategy"

gh api --method PATCH "repos/$OWNER/$REPO" \
  -f merge_commit_title='MERGE_MESSAGE' \
  -f merge_commit_message='PR_TITLE_AND_BODY' \
  -f squash_merge_commit_title='COMMIT_OR_PR_TITLE' \
  -f squash_merge_commit_message='COMMIT_MESSAGES' \
  -f use_squash_pr_title_as_default=true

log_success "Merge strategy configured"

# ============================================================
# STEP 4: BRANCH PROTECTION
# ============================================================

log_step "4/8 - Setup Branch Protection"

gh api --method PUT "repos/$OWNER/$REPO/branches/$BRANCH/protection" \
  -f required_status_checks='{"strict":true,"contexts":[]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  }' \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f required_linear_history=true \
  -f required_conversation_resolution=true

log_success "Branch protection enabled for main"

# ============================================================
# STEP 5: SECURITY & ANALYSIS
# ============================================================

log_step "5/8 - Enable Security Features"

gh api --method PATCH "repos/$OWNER/$REPO" \
  -f security_and_analysis='{
    "advanced_security": { "status": "enabled" },
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" },
    "dependabot_alerts": { "status": "enabled" },
    "dependabot_security_updates": { "status": "enabled" }
  }'

gh api --method PATCH "repos/$OWNER/$REPO" \
  -f private_vulnerability_reporting_enabled=true

log_success "Security features enabled"

# ============================================================
# STEP 6: ADDITIONAL SETTINGS
# ============================================================

log_step "6/8 - Configure Additional Settings"

gh api --method PATCH "repos/$OWNER/$REPO" \
  -f merge_commit_title='MERGE_MESSAGE' \
  -f allow_update_branch=true \
  -f use_squash_pr_title_as_default=true

log_success "Additional settings configured"

# ============================================================
# STEP 7: VERIFY SETTINGS
# ============================================================

log_step "7/8 - Verifying Repository Settings"

gh repo view "$OWNER/$REPO" --json name,visibility,defaultBranchRef,hasIssues,hasProjects,hasDiscussions,hasWiki

log_success "Settings verified"

# ============================================================
# STEP 8: SUMMARY
# ============================================================

log_step "8/8 - Summary"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ REPOSITORY SETTINGS CONFIGURED${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}📊 VISIBILITY & FEATURES:${NC}"
echo "  ✓ Visibility: PUBLIC"
echo "  ✓ Issues: ENABLED"
echo "  ✓ Projects: ENABLED"
echo "  ✓ Discussions: ENABLED"
echo "  ✓ Wiki: DISABLED"
echo "  ✓ Downloads: DISABLED"
echo ""

echo -e "${YELLOW}🔄 MERGE & COMMIT SETTINGS:${NC}"
echo "  ✓ Merge commits: ENABLED"
echo "  ✓ Rebase merging: ENABLED"
echo "  ✓ Squash merging: ENABLED (Default)"
echo "  ✓ Auto merge: ENABLED"
echo "  ✓ Delete branch on merge: ENABLED"
echo "  ✓ Allow branch updates: ENABLED"
echo ""

echo -e "${YELLOW}🔐 BRANCH PROTECTION (Main):${NC}"
echo "  ✓ Require 1 PR review: YES"
echo "  ✓ Require code owner review: YES"
echo "  ✓ Dismiss stale reviews: YES"
echo "  ✓ Require conversation resolution: YES"
echo "  ✓ Allow force pushes: NO"
echo "  ✓ Allow deletions: NO"
echo "  ✓ Required linear history: YES"
echo ""

echo -e "${YELLOW}🛡️ SECURITY FEATURES:${NC}"
echo "  ✓ Advanced Security: ENABLED"
echo "  ✓ Secret Scanning: ENABLED"
echo "  ✓ Secret Scanning Push Protection: ENABLED"
echo "  ✓ Dependabot Alerts: ENABLED"
echo "  ✓ Dependabot Security Updates: ENABLED"
echo "  ✓ Private Vulnerability Reporting: ENABLED"
echo "  ✓ Commit Signoff Required: YES"
echo ""

echo -e "${YELLOW}🔗 QUICK LINKS:${NC}"
echo "  • Repository: https://github.com/$OWNER/$REPO"
echo "  • Settings: https://github.com/$OWNER/$REPO/settings"
echo "  • Security: https://github.com/$OWNER/$REPO/settings/security_analysis"
echo "  • Branch Protection: https://github.com/$OWNER/$REPO/settings/branches"
echo ""

echo -e "${GREEN}Repository is ready for professional use! 🚀${NC}"
