# GitHub Repository Setup Instructions

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Fill in the repository details:
   - **Repository name**: `littlellm-ai-assistant`
   - **Description**: `A lightweight AI chat application with multi-provider support built with Next.js and Electron`
   - **Visibility**: Public (or Private if you prefer)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

## Step 2: Push Your Local Repository

After creating the repository on GitHub, run these commands in your terminal:

```bash
# Add the GitHub repository as remote origin
git remote add origin https://github.com/NickPittas/littlellm-ai-assistant.git

# Rename the default branch to main (if needed)
git branch -M main

# Push your code to GitHub
git push -u origin main
```

## Step 3: Verify Upload

1. Go to your repository: https://github.com/NickPittas/littlellm-ai-assistant
2. Verify that all files are uploaded except:
   - `dist/` folder (excluded by .gitignore)
   - `*.exe` files (excluded by .gitignore)
   - `node_modules/` (excluded by .gitignore)
   - Other build artifacts

## What's Included in the Repository

✅ **Source Code**
- Next.js React application (`src/`)
- Electron main and preload scripts (`electron/`)
- UI components and services
- Configuration files

✅ **Assets**
- Icon files (SVG, PNG, ICO)
- Multi-size icons for Windows compatibility

✅ **Scripts**
- Build scripts (`scripts/`)
- Icon generation utilities
- Path fixing scripts

✅ **Configuration**
- Package.json with all dependencies
- Electron-builder configuration
- TypeScript configuration
- Tailwind CSS configuration

❌ **Excluded (by .gitignore)**
- Build outputs (`dist/`, `out/`, `.next/`)
- Executables (`*.exe`, `*.dmg`, `*.AppImage`)
- Dependencies (`node_modules/`)
- Cache files and temporary files

## Repository Features

- **Comprehensive .gitignore**: Excludes all build artifacts and executables
- **Detailed README**: With setup instructions and feature documentation
- **Icon Fix Documentation**: Details about the Windows taskbar icon fix
- **Development Instructions**: How to build and run the app locally

## Next Steps

1. Create the repository on GitHub
2. Push your code using the commands above
3. Add any additional documentation or issues
4. Consider adding GitHub Actions for automated builds (optional)

## File Size Savings

By excluding build artifacts and executables, the repository size is kept minimal:
- Source code: ~2-3 MB
- Without exclusions: ~50-100 MB (with node_modules and dist files)

This makes cloning and contributing much faster for other developers!
