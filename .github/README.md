# CI/CD Pipeline Documentation

This directory contains the GitHub Actions workflows for the LittleLLM project's CI/CD pipeline.

## 🚀 Workflows Overview

### 1. Main CI/CD Pipeline (`ci.yml`)
**Triggers:** Push to main/master/develop, Pull Requests
**Purpose:** Comprehensive testing, building, and quality assurance

**Jobs:**
- **Code Quality & Security**: ESLint, TypeScript checking, security audit
- **Testing**: Cross-platform testing (Ubuntu, Windows, macOS) with Node.js 18 & 20
- **Build Verification**: Electron app building for all platforms
- **Bundle Analysis**: Bundle size analysis and optimization recommendations
- **Dependency Check**: Outdated packages and license compliance
- **Performance Testing**: Build time and memory usage analysis

### 2. Security Audit (`security.yml`)
**Triggers:** Daily at 2 AM UTC, Push to main/master, Pull Requests, Manual
**Purpose:** Comprehensive security scanning and compliance

**Jobs:**
- **Dependency Security Audit**: npm audit with vulnerability assessment
- **License Compliance**: Check for problematic licenses (GPL, AGPL, etc.)
- **Code Security Scan**: ESLint security rules and hardcoded secrets detection
- **Electron Security Check**: Electron-specific security best practices
- **Security Summary**: Consolidated security report

### 3. Performance Monitoring (`performance.yml`)
**Triggers:** Push to main/master, Pull Requests, Weekly on Sundays, Manual
**Purpose:** Performance tracking and optimization insights

**Jobs:**
- **Build Performance**: Build time, installation time, memory usage
- **Runtime Performance**: Custom benchmarks and memory analysis
- **Bundle Analysis**: Bundle composition and size optimization
- **Performance Summary**: Consolidated performance report

### 4. Release Automation (`release.yml`)
**Triggers:** Git tags (v*.*.*), Manual with version input
**Purpose:** Automated release creation and artifact distribution

**Jobs:**
- **Validate Release**: Version format validation and tag checking
- **Run Tests**: Full test suite before release
- **Build Release Artifacts**: Cross-platform Electron builds
- **Create Release**: GitHub release with changelog and artifacts
- **Post-Release Tasks**: Version bump PR creation

### 5. NEEDFIXES Validation (`validate-needfixes.yml`)
**Triggers:** Changes to NEEDFIXES.md
**Purpose:** Validate documentation structure and links

## 📊 Quality Gates

### Security Gates
- **Critical vulnerabilities**: Build fails if any critical vulnerabilities found
- **High vulnerabilities**: Build fails if more than 5 high-severity vulnerabilities
- **License compliance**: Warns about GPL/AGPL licenses
- **Hardcoded secrets**: Scans for API keys, passwords, tokens

### Performance Gates
- **Bundle size**: Warns if JavaScript bundle exceeds 1MB
- **Build time**: Tracks build performance over time
- **Memory usage**: Monitors memory consumption during builds

### Quality Gates
- **Test coverage**: Uploads to Codecov for tracking
- **TypeScript**: Strict type checking required
- **ESLint**: Code quality and security rules
- **Cross-platform**: Tests on Ubuntu, Windows, macOS

## 🔧 Configuration

### Environment Variables
- `NODE_VERSION`: Node.js version (default: '18')
- `ELECTRON_CACHE`: Electron cache directory
- `ELECTRON_BUILDER_CACHE`: Electron Builder cache directory

### Required Secrets
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- `CODECOV_TOKEN`: (Optional) For code coverage reporting

### Artifact Retention
- **Build artifacts**: 7 days
- **Security reports**: 30 days
- **Performance reports**: 30 days (summary: 90 days)
- **Release artifacts**: 30 days

## 📈 Monitoring and Reporting

### Artifacts Generated
1. **Security Audit Results** (`npm-audit.json`, `license-*.txt`)
2. **Performance Reports** (`performance-report.md`, `bundle-analysis.log`)
3. **Build Artifacts** (Cross-platform Electron builds)
4. **Test Coverage** (Uploaded to Codecov)

### Notifications
- **Success**: All checks passed notification
- **Failure**: Detailed failure information with job status
- **Security Issues**: Critical security findings fail the build
- **Performance Degradation**: Warnings for performance regressions

## 🚀 Usage

### Running Tests Locally
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Type checking
npx tsc --noEmit
```

### Building Locally
```bash
# Build web application
npm run build

# Build Electron app
npm run electron:build

# Platform-specific builds
npm run electron:build:linux
npm run electron:build:windows
npm run electron:build:mac
```

### Security Scanning
```bash
# Security audit
npm audit

# License checking
npx license-checker --summary

# ESLint security scan
npx eslint . --ext .js,.jsx,.ts,.tsx
```

### Performance Testing
```bash
# Custom benchmarks
npm run benchmark

# Bundle analysis
npx webpack-bundle-analyzer dist/static/js/*.js
```

## 🔄 Release Process

### Automatic Release (Recommended)
1. Create and push a git tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. GitHub Actions automatically:
   - Validates the release
   - Runs full test suite
   - Builds cross-platform artifacts
   - Creates GitHub release with changelog
   - Uploads release artifacts

### Manual Release
1. Go to Actions → Release workflow
2. Click "Run workflow"
3. Enter version (e.g., v1.0.0)
4. Select if it's a pre-release
5. Run the workflow

### Pre-release Versions
Versions containing `alpha`, `beta`, `rc`, `dev`, or `pre` are automatically marked as pre-releases.

## 🛠️ Maintenance

### Updating Dependencies
The CI pipeline checks for outdated dependencies weekly. To update:
```bash
npm outdated
npm update
```

### Security Updates
Security audits run daily. To fix vulnerabilities:
```bash
npm audit fix
```

### Performance Optimization
Monitor performance reports for:
- Bundle size increases
- Build time regressions
- Memory usage spikes

## 📋 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Review TypeScript errors

2. **Security Failures**
   - Update vulnerable dependencies
   - Review and fix hardcoded secrets
   - Check license compliance

3. **Performance Issues**
   - Analyze bundle composition
   - Review large dependencies
   - Implement code splitting

4. **Release Failures**
   - Verify version format (v1.2.3)
   - Check if tag already exists
   - Ensure all tests pass

### Getting Help
- Check workflow logs in GitHub Actions
- Review artifact reports for detailed information
- Consult this documentation for configuration details

## 🔗 Related Documentation
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Electron Builder Documentation](https://www.electron.build/)
- [npm audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [ESLint Security Plugin](https://github.com/nodesecurity/eslint-plugin-security)
