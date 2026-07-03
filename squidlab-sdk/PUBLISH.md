# Publishing SquidLab SDK to NPM

## Prerequisites

1. **NPM Account**: Create an account at https://www.npmjs.com/signup
2. **NPM Login**: Login to npm via CLI
   ```bash
   npm login
   ```

## Build Process

### 1. Install Dependencies

```bash
cd /workspaces/cloudbliss-storage/squidlab-sdk
npm install
```

### 2. Build the Package

```bash
npm run build
```

This will:
- Compile TypeScript to JavaScript
- Generate type definitions (.d.ts files)
- Create UMD, CommonJS, and ESM bundles
- Extract and minify CSS

### 3. Test Locally

Test the package locally before publishing:

```bash
npm link
cd ../test-extension
npm link squidlab-sdk
```

### 4. Update Version

Follow semantic versioning (semver):

```bash
# Patch release (bug fixes): 1.0.0 -> 1.0.1
npm version patch

# Minor release (new features): 1.0.0 -> 1.1.0
npm version minor

# Major release (breaking changes): 1.0.0 -> 2.0.0
npm version major
```

### 5. Publish to NPM

```bash
npm publish
```

For first-time publish with scoped package:

```bash
npm publish --access public
```

## Post-Publish

### 1. Verify on NPM

Visit: https://www.npmjs.com/package/squidlab-sdk

### 2. Test Installation

```bash
npm install squidlab-sdk
```

### 3. Update Documentation

- Update version in README.md
- Add changelog entry
- Update examples

## Continuous Deployment

### GitHub Actions Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### NPM Token

1. Generate token: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Add to GitHub Secrets: `NPM_TOKEN`

## CLI Tool Testing

### Test CLI Commands

```bash
# Create extension
squidlab-sdk create my-test-extension

# Validate manifest
squidlab-sdk validate manifest.json

# Convert to .sqe
squidlab-sdk convert .

# Dev server
squidlab-sdk dev

# Build
squidlab-sdk build

# Publish
squidlab-sdk publish --api-key YOUR_KEY
```

## Troubleshooting

### Common Issues

1. **Build fails**: Check TypeScript errors
   ```bash
   npm run build -- --verbose
   ```

2. **CLI not working**: Verify bin path in package.json
   ```bash
   chmod +x bin/cli.js
   ```

3. **Publish fails**: Check authentication
   ```bash
   npm whoami
   ```

4. **Package too large**: Check .npmignore
   ```
   src/
   examples/
   tests/
   *.test.js
   ```

## Package Structure

```
squidlab-sdk/
├── bin/
│   └── cli.js              # CLI entry point
├── dist/
│   ├── index.js            # CommonJS bundle
│   ├── index.esm.js        # ESM bundle
│   ├── index.umd.js        # UMD bundle (browser)
│   ├── index.d.ts          # TypeScript definitions
│   └── styles.css          # Compiled styles
├── src/
│   ├── index.ts            # Main entry
│   ├── core/               # Core SDK classes
│   ├── components/         # UI components
│   ├── utils/              # Utilities
│   └── styles/             # CSS styles
├── examples/               # Example extensions
├── templates/              # Project templates
├── package.json
├── tsconfig.json
├── rollup.config.js
└── README.md
```

## Version Management

### Pre-release Versions

```bash
# Alpha: 1.0.0-alpha.0
npm version prerelease --preid=alpha

# Beta: 1.0.0-beta.0
npm version prerelease --preid=beta

# Release candidate: 1.0.0-rc.0
npm version prerelease --preid=rc
```

### Publishing Pre-releases

```bash
npm publish --tag beta
npm publish --tag next
```

## CDN Distribution

After publishing, package is available on:

- **unpkg**: `https://unpkg.com/squidlab-sdk@latest/dist/index.umd.js`
- **jsDelivr**: `https://cdn.jsdelivr.net/npm/squidlab-sdk@latest/dist/index.umd.js`

## Monitoring

### Package Stats

- Downloads: https://npm-stat.com/charts.html?package=squidlab-sdk
- Bundle size: https://bundlephobia.com/package/squidlab-sdk

### Dependency Updates

```bash
npm outdated
npm update
```

## Maintenance

### Regular Tasks

1. Update dependencies monthly
2. Review and merge security updates
3. Respond to GitHub issues
4. Update documentation
5. Add new examples

### Security

1. Enable 2FA on npm account
2. Use `npm audit` to check vulnerabilities
3. Review dependencies before publishing

```bash
npm audit
npm audit fix
```

## Support

- **Documentation**: https://docs.squidcloud.com/sdk
- **Issues**: https://github.com/squidcloud/squidlab-sdk/issues
- **Discord**: https://discord.gg/squidcloud
- **Email**: support@squidcloud.com
