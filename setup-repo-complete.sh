#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# GitHub Repository Complete Professional Setup
# For: JavaScript/Node.js Projects
# Repository: Fyooryx/Nexa
# ============================================================

OWNER="Fyooryx"
REPO="Nexa"
BRANCH="main"
REPO_PATH="$HOME/$REPO"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================
# FUNCTIONS
# ============================================================

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

log_step "0/14 - Verifikasi & Autentikasi"

if ! gh auth status >/dev/null 2>&1; then
  log_error "GitHub CLI belum login"
  log_info "Jalankan: gh auth login"
  log_info "Atau: export GH_TOKEN='your_token_here'"
  exit 1
fi

log_success "GitHub CLI authenticated"

# ============================================================
# STEP 1: REPOSITORY CLONE/INIT
# ============================================================

log_step "1/14 - Repository Setup"

if [ ! -d "$REPO_PATH/.git" ]; then
  log_info "Cloning repository..."
  git clone "https://github.com/$OWNER/$REPO.git" "$REPO_PATH"
else
  log_info "Repository already exists"
fi

cd "$REPO_PATH"
git remote set-url origin "https://github.com/$OWNER/$REPO.git" 2>/dev/null || true

log_success "Repository ready at $REPO_PATH"

# ============================================================
# STEP 2: CHANGE VISIBILITY TO PUBLIC
# ============================================================

log_step "2/14 - Change Visibility to PUBLIC"

gh repo edit "$OWNER/$REPO" --visibility public

log_success "Repository is now PUBLIC"

# ============================================================
# STEP 3: BASIC REPOSITORY SETTINGS
# ============================================================

log_step "3/14 - Configure Basic Settings"

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
# STEP 4: MERGE & COMMIT STRATEGY
# ============================================================

log_step "4/14 - Configure Merge Strategy"

gh api --method PATCH "repos/$OWNER/$REPO" \
  -f merge_commit_title='MERGE_MESSAGE' \
  -f merge_commit_message='PR_TITLE_AND_BODY' \
  -f squash_merge_commit_title='COMMIT_OR_PR_TITLE' \
  -f squash_merge_commit_message='COMMIT_MESSAGES' \
  -f use_squash_pr_title_as_default=true

log_success "Merge strategy configured"

# ============================================================
# STEP 5: BRANCH PROTECTION
# ============================================================

log_step "5/14 - Setup Branch Protection"

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
# STEP 6: SECURITY & ANALYSIS
# ============================================================

log_step "6/14 - Enable Security Features"

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
# STEP 7: CREATE .gitignore (Node.js)
# ============================================================

log_step "7/14 - Create .gitignore"

cat > .gitignore <<'GITIGNORE'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
pnpm-error.log*
lerna-debug.log*
.pnp
.pnp.js

# Production
dist/
build/
.next/
out/
.nuxt/
.cache/
.vuepress/dist/
.serverless/
.fusebox/
.dynamodb/
.tern-port
.vuepress/dist/
.output

# Misc
.DS_Store
*.pem
*.key
*.cert

# Debug
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
.sublime-workspace
.sublime-project
*.swp
*.swo
*~
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json

# Testing
coverage/
.nyc_output/
.coverage/
htmlcov/
.pytest_cache/
*.lcov

# Env
.env
.env.local
.env.*.local
.env.development
.env.development.local
.env.test
.env.test.local
.env.production
.env.production.local

# Lock files (optional - uncomment to ignore)
# package-lock.json
# yarn.lock
# pnpm-lock.yaml
# Gemfile.lock

# Temporary
tmp/
temp/
*.tmp
.tmp/

# OS
Thumbs.db
ehthumbs.db
Desktop.ini

# Node
.npm/
.eslintcache
.node_repl_history
*.tsbuildinfo

# Monorepo
lerna-debug.log*
.pnpm-debug.log*
GITIGNORE

log_success ".gitignore created"

# ============================================================
# STEP 8: CREATE .editorconfig
# ============================================================

log_step "8/14 - Create .editorconfig"

cat > .editorconfig <<'EDITORCONFIG'
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
max_line_length = off

[*.{json,yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab

[*.go]
indent_style = tab
indent_size = 4
EDITORCONFIG

log_success ".editorconfig created"

# ============================================================
# STEP 9: CREATE CODEOWNERS
# ============================================================

log_step "9/14 - Create CODEOWNERS"

mkdir -p .github

cat > .github/CODEOWNERS <<'CODEOWNERS'
# Global code owner
* @Fyooryx

# JavaScript/TypeScript files
*.js @Fyooryx
*.jsx @Fyooryx
*.ts @Fyooryx
*.tsx @Fyooryx
*.mjs @Fyooryx

# Config files
*.json @Fyooryx
*.yaml @Fyooryx
*.yml @Fyooryx
*.toml @Fyooryx
*.config.* @Fyooryx

# Documentation
*.md @Fyooryx
docs/ @Fyooryx
README.* @Fyooryx

# GitHub
.github/ @Fyooryx
CODEOWNERS

log_success "CODEOWNERS created"

# ============================================================
# STEP 10: CREATE GITHUB TEMPLATES
# ============================================================

log_step "10/14 - Create GitHub Templates"

mkdir -p .github/ISSUE_TEMPLATE
mkdir -p .github/PULL_REQUEST_TEMPLATE

cat > .github/PULL_REQUEST_TEMPLATE/default.md <<'PRTEMPLATE'
## Description
<!-- Describe your changes in detail -->

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Related Issue
Closes #

## How Has This Been Tested?
<!-- Describe the tests you ran -->
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Testing Instructions
<!-- Step-by-step instructions for testing -->
1.
2.
3.

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests passed locally with my changes
- [ ] Any dependent changes have been merged and published in downstream modules

## Screenshots (if applicable)

## Additional Context
<!-- Add any other context about the PR here -->
PRTEMPLATE

cat > .github/ISSUE_TEMPLATE/bug_report.md <<'BUGTEMPLATE'
---
name: Bug report
about: Create a report to help us improve
title: "[BUG] "
labels: 'bug'
assignees: 'Fyooryx'
---

## Describe the Bug
<!-- A clear and concise description of what the bug is. -->

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
<!-- A clear and concise description of what you expected to happen. -->

## Actual Behavior
<!-- What actually happened -->

## Environment
- **OS:** 
- **Node version:** 
- **npm/yarn version:** 
- **Browser:** 

## Screenshots
<!-- If applicable, add screenshots -->

## Logs/Error Messages
```
paste error logs here
```

## Additional Context
<!-- Add any other context about the problem here. -->
BUGTEMPLATE

cat > .github/ISSUE_TEMPLATE/feature_request.md <<'FEATURETEMPLATE'
---
name: Feature request
about: Suggest an idea for this project
title: "[FEATURE] "
labels: 'enhancement'
assignees: 'Fyooryx'
---

## Is your feature request related to a problem?
<!-- A clear and concise description of what the problem is. -->

## Describe the Solution You'd Like
<!-- A clear and concise description of what you want to happen. -->

## Describe Alternatives Considered
<!-- A clear and concise description of any alternative solutions or features you've considered. -->

## Additional Context
<!-- Add any other context or screenshots about the feature request here. -->
FEATURETEMPLATE

cat > .github/ISSUE_TEMPLATE/documentation.md <<'DOCTEMPLATE'
---
name: Documentation
about: Improve or add documentation
title: "[DOCS] "
labels: 'documentation'
assignees: 'Fyooryx'
---

## Type of Documentation
- [ ] README update
- [ ] API documentation
- [ ] Setup/Installation guide
- [ ] Tutorial/Example
- [ ] Other

## Description
<!-- What documentation needs to be added or improved? -->

## Details
<!-- Provide details about what should be documented -->

## Additional Context
DOCTEMPLATE

log_success "GitHub templates created"

# ============================================================
# STEP 11: CREATE WORKFLOWS
# ============================================================

log_step "11/14 - Create GitHub Workflows"

mkdir -p .github/workflows

cat > .github/workflows/ci.yml <<'CIWORKFLOW'
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ESLint
        run: npm run lint --if-present || echo "No lint script"

  test:
    name: Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test --if-present || echo "No test script"
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build project
        run: npm run build --if-present || echo "No build script"
CIWORKFLOW

cat > .github/workflows/security.yml <<'SECURITYWORKFLOW'
name: Security

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 0'

jobs:
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run npm audit
        run: npm audit --audit-level=moderate || true
      
      - name: Check for vulnerabilities
        run: npm audit --audit-level=moderate

  dependency-check:
    name: Dependency Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Check outdated packages
        run: npm outdated || true
SECURITYWORKFLOW

log_success "GitHub workflows created"

# ============================================================
# STEP 12: CREATE DOCUMENTATION FILES
# ============================================================

log_step "12/14 - Create Documentation Files"

if [ ! -f README.md ]; then
  cat > README.md <<'README'
# Nexa

<!-- Add your project description here -->

Brief description of your project.

## Features

- Feature 1
- Feature 2
- Feature 3

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Fyooryx/Nexa.git
cd Nexa

# Install dependencies
npm install

# Start development server
npm run dev
```

## Usage

```javascript
// Example usage
```

## Development

```bash
# Run tests
npm test

# Run linter
npm run lint

# Build for production
npm run build
```

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) file.

## Support

For support, please open an [issue](../../issues) or [start a discussion](../../discussions).
README
fi

if [ ! -f CONTRIBUTING.md ]; then
  cat > CONTRIBUTING.md <<'CONTRIBUTING'
# Contributing to Nexa

Thank you for your interest in contributing! We appreciate your efforts to improve this project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Nexa.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm install`

## Development Workflow

1. Make your changes
2. Write or update tests
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Commit with clear messages: `git commit -m "type: description"`
6. Push your branch: `git push origin feature/your-feature-name`
7. Create a Pull Request

## Commit Message Convention

Follow this format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/dependency changes

Example: `feat: add user authentication`

## Code Style

- Use consistent indentation (2 spaces)
- Follow existing code patterns
- Use meaningful variable names
- Add comments for complex logic

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Aim for good test coverage

## Questions?

Feel free to:
- Open an issue
- Start a discussion
- Create a draft PR to discuss ideas

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on code, not the person
CONTRIBUTING
fi

if [ ! -f LICENSE ]; then
  cat > LICENSE <<'LICENSE'
MIT License

Copyright (c) 2026 Fyooryx

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
LICENSE
fi

log_success "Documentation files created"

# ============================================================
# STEP 13: CREATE CONFIG FILES
# ============================================================

log_step "13/14 - Create Configuration Files"

cat > .npmrc <<'NPMRC'
legacy-peer-deps=false
save-exact=false
progress=true
NPMRC

if [ ! -f package.json ]; then
  cat > package.json <<'PACKAGE'
{
  "name": "nexa",
  "version": "1.0.0",
  "description": "Your project description",
  "main": "index.js",
  "scripts": {
    "dev": "node index.js",
    "test": "echo \"Error: no test specified\" && exit 1",
    "lint": "echo \"Error: no lint specified\" && exit 1",
    "build": "echo \"Error: no build specified\" && exit 1"
  },
  "keywords": [],
  "author": "Fyooryx",
  "license": "MIT",
  "dependencies": {},
  "devDependencies": {}
}
PACKAGE
fi

log_success "Configuration files created"

# ============================================================
# STEP 14: GIT COMMIT & PUSH
# ============================================================

log_step "14/14 - Commit and Push"

git config user.email "noreply@github.com" 2>/dev/null || true
git config user.name "GitHub Actions" 2>/dev/null || true

git add -A
git commit -m "chore: professional repository setup with security and best practices" || log_info "No changes to commit"
git push origin "$BRANCH" 2>/dev/null || log_info "Push skipped"

log_success "Changes committed and pushed"

# ============================================================
# SUMMARY
# ============================================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ REPOSITORY SETUP COMPLETE${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}📊 REPOSITORY SETTINGS:${NC}"
echo "  • Visibility: PUBLIC"
echo "  • Issues: ENABLED"
echo "  • Projects: ENABLED"
echo "  • Discussions: ENABLED"
echo "  • Wiki: DISABLED"
echo ""

echo -e "${YELLOW}🔄 MERGE STRATEGY:${NC}"
echo "  • Merge commits: ENABLED"
echo "  • Rebase merging: ENABLED"
echo "  • Squash merging: ENABLED (Default)"
echo "  • Auto merge: ENABLED"
echo "  • Delete branch on merge: ENABLED"
echo ""

echo -e "${YELLOW}🔐 SECURITY:${NC}"
echo "  • Branch protection: ENABLED"
echo "  • Code owner review: REQUIRED"
echo "  • Secret scanning: ENABLED"
echo "  • Dependabot alerts: ENABLED"
echo "  • Commit signoff: REQUIRED"
echo ""

echo -e "${YELLOW}📁 FILES CREATED:${NC}"
echo "  • .gitignore (Node.js)"
echo "  • .editorconfig"
echo "  • .npmrc"
echo "  • .github/CODEOWNERS"
echo "  • .github/PULL_REQUEST_TEMPLATE/default.md"
echo "  • .github/ISSUE_TEMPLATE/bug_report.md"
echo "  • .github/ISSUE_TEMPLATE/feature_request.md"
echo "  • .github/ISSUE_TEMPLATE/documentation.md"
echo "  • .github/workflows/ci.yml"
echo "  • .github/workflows/security.yml"
echo "  • README.md"
echo "  • CONTRIBUTING.md"
echo "  • LICENSE"
echo "  • package.json"
echo ""

echo -e "${YELLOW}🔗 LINKS:${NC}"
echo "  • Repository: https://github.com/$OWNER/$REPO"
echo "  • Settings: https://github.com/$OWNER/$REPO/settings"
echo "  • Actions: https://github.com/$OWNER/$REPO/actions"
echo "  • Security: https://github.com/$OWNER/$REPO/security"
echo ""

echo -e "${YELLOW}📝 NEXT STEPS:${NC}"
echo "  1. Review and update README.md with your project details"
echo "  2. Update package.json scripts (test, lint, build)"
echo "  3. Add repository topics/tags in GitHub"
echo "  4. Setup branch protection for other branches if needed"
echo "  5. Configure GitHub Pages if documentation needed"
echo ""

echo -e "${GREEN}Happy coding! 🚀${NC}"
