# Releasing Neonflare Packages

This document outlines the steps to release packages in the Neonflare monorepo.

## Prerequisites

- Node.js 20+ and pnpm installed
- npm account with publish permissions
- GitHub repository access
- `NPM_TOKEN` secret configured in GitHub repository settings (Settings > Secrets and variables > Actions)

## Release Process

### Option 1: CLI Release (Recommended for Local Development)

1. **Ensure code is ready**:
   ```bash
   pnpm test
   pnpm lint
   pnpm build
   ```

2. **Bump version and release**:
   - For patch release (e.g., 0.1.0 → 0.1.1):
     ```bash
     pnpm run release:patch
     ```
   - For minor release (e.g., 0.1.0 → 0.2.0):
     ```bash
     pnpm run release:minor
     ```
   - For major release (e.g., 0.1.0 → 1.0.0):
     ```bash
     pnpm run release:major
     ```

   This will:
   - Update `packages/mcp/package.json` version
   - Create a git commit
   - Create a git tag (e.g., `v0.1.1`)
   - Push the commit and tag to GitHub

3. **Monitor the release**:
   - The tag push triggers the GitHub Actions publish workflow
   - Check the Actions tab for the "Publish to npm" workflow status
   - The package will be published to npm once the workflow completes

### Option 2: Manual CLI Steps

If you prefer manual control:

1. **Bump version**:
   ```bash
   cd packages/mcp
   npm version patch  # or minor/major
   ```

2. **Push changes**:
   ```bash
   git push origin main
   git push origin --tags
   ```

3. **Monitor GitHub Actions** as above.

### Option 3: GitHub Actions Only

For CI/CD only releases:

1. **Ensure code is merged to main branch**

2. **Trigger release via GitHub**:
   - Go to repository Actions tab
   - The "Publish to npm" workflow runs automatically on version tags
   - No manual trigger needed

## Versioning

- Follow [Semantic Versioning](https://semver.org/)
- Patch: Bug fixes
- Minor: New features (backward compatible)
- Major: Breaking changes

## Troubleshooting

### Workflow Fails
- Check the Actions logs for errors
- Ensure `NPM_TOKEN` is set correctly
- Verify package.json version matches the tag

### Permission Issues
- Ensure you're logged into npm: `npm login`
- Check npm account has publish rights for `@neonflare` scope

### Tag Issues
- Tags must follow `v*` pattern (e.g., `v1.0.0`)
- Ensure no duplicate tags exist

### Monorepo Considerations
Currently configured for single package (`@neonflare/mcp`). For multiple packages:
- Shared versioning: Update all package.json files
- Independent versioning: Modify scripts/workflows per package

## Post-Release

- Verify package on [npmjs.com](https://www.npmjs.com)
- Update documentation if needed
- Announce release if applicable