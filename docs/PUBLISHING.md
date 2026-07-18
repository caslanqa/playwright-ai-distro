# Publishing to npm

This document explains how to publish the `@caslanqa/create-playwright-ai` package to npm and how end
users install it. (This is the **scaffolder** package that distributes the framework; end users consume
it via `npm init`.)

## 🚀 Automated Publishing with GitHub Actions (Recommended)

### 1. Create an npm Token

1. [npmjs.com](https://www.npmjs.com) → Avatar → Access Tokens
2. "Generate New Token" → "Classic Token" → "Automation"
3. Copy the token

### 2. Add the GitHub Secret

1. GitHub repo → Settings → Secrets and variables → Actions → "New repository secret"
2. Name: `NPM_TOKEN`, Value: your npm token → "Add secret"

### 3. Publish (Manual Trigger)

1. GitHub repo → Actions → **"Publish to npm"** → "Run workflow"
2. Choose the options:
   - **version_type**: `patch` / `minor` / `major`
   - **dry_run**: `true` to test, `false` for a real publish
   - **tag**: `latest` / `beta` / `next`
3. Click "Run workflow"

```text
patch: 1.2.0 → 1.2.1 (bug fix)
minor: 1.2.0 → 1.3.0 (new feature)
major: 1.2.0 → 2.0.0 (breaking change)
```

What `.github/workflows/publish.yml` does: lint + type-check → version bump → update CHANGELOG →
git commit + tag → `npm publish --access public` → GitHub Release.

> **Note:** The workflow pushes the version-bump commit back to the branch it was dispatched from
> (`github.ref_name`), not a hardcoded `main` — so it works whether you run it from `main` or a
> feature branch.

---

## 📦 Manual Publishing (Alternative)

```bash
npm login                 # sign in with your npmjs account
npm run lint              # checks
npm run type-check
npm pack --dry-run        # review the tarball contents
npm version patch         # or minor / major
npm publish --access public   # scoped package → --access public is required
```

> **Note:** Before publishing, verify that the `npm pack --dry-run` output does NOT include **local**
> files like `env/environments.json` or `testData/users.json` — only the `*.example.json` files should
> be shipped (the `files` field in `package.json` enforces this).

---

## 🖥️ End-User Installation

Once published, a ready-to-run project is one command away on any machine:

```bash
# npm automatically resolves the scoped "create" package to @caslanqa/create-playwright-ai
npm init @caslanqa/playwright-ai@latest my-project

cd my-project
npm test                       # ready to run
npx playwright install         # browsers for UI tests (not needed for API/AI-judge)
```

Equivalent forms:

```bash
npm  create @caslanqa/playwright-ai@latest my-project
npx  @caslanqa/create-playwright-ai my-project
yarn create @caslanqa/playwright-ai my-project
pnpm create @caslanqa/playwright-ai my-project
```

Flags: `--no-install`, `--no-browsers`, `--no-gha`, `-y/--yes`.

---

## 🔢 Version Management

```bash
npm view @caslanqa/create-playwright-ai version     # published version
npm view @caslanqa/create-playwright-ai versions    # all versions

# Beta
npm version prerelease --preid=beta
npm publish --tag beta --access public
npx @caslanqa/create-playwright-ai@beta my-project
```

---

## ❓ Troubleshooting

- **"You must be logged in"** → `npm login` (check with `npm whoami`).
- **"Permission denied" / scoped package** → `npm publish --access public`.
- **Wrong files being published** → check the `files` field in `package.json` and the
  `npm pack --dry-run` output.
