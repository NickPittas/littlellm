# LittleLLM Development Guide

## Build Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build-no-lint` - Build without linting
- `npm run electron` - Run Electron app
- `npm run electron-dev` - Run Electron app in development mode
- `npm run dist` - Build distributable package
- `npm run dist:win` - Build Windows distributable
- `npm run dist:mac` - Build Mac distributable
- `npm run dist:linux` - Build Linux distributable

## Lint/Format Commands
- `npm run lint` - Run ESLint
- `npx prettier --write .` - Format code with Prettier

## Test Commands
- No specific test commands found in package.json. Tests may be run manually or via integration scripts.

## Code Style Guidelines

### Imports
- Use absolute imports with `@/*` for src directory (`@/components/ComponentName`)
- Group imports in order: Node.js built-ins, external packages, internal modules
- Use named imports when possible

### Formatting
- TypeScript with React/Next.js
- Tailwind CSS for styling
- Prettier for code formatting
- Single quotes for strings
- Semicolons required

### Types
- Strict TypeScript with `strict: true` in tsconfig
- Explicit typing preferred over inference
- Use interfaces for objects, types for unions/primitives

### Naming Conventions
- PascalCase for components and interfaces
- camelCase for variables and functions
- UPPER_SNAKE_CASE for constants

### Error Handling
- Use try/catch blocks for async operations
- Prefer specific error handling over generic catches
- Use proper error logging with context

### Component Structure
- Functional components with TypeScript interfaces
- Use React hooks (useState, useEffect, etc.)
- Component files should be .tsx extension
- Extract complex logic into services/hooks

### Services
- Services should be in the `src/services/` directory
- Use dependency injection where possible
- Separate business logic from UI components