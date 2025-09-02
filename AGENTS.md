# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js app router pages, layout, styles.
- `src/components`: Reusable React components (PascalCase files, `.tsx`).
- `src/services`: Domain services (providers, storage, parsing). Electron-only modules are excluded from web via webpack null-loader.
- `electron/`: Electron main and preload TypeScript.
- `public/` assets; `assets/` raw icons/images; `docs/` architecture and testing notes; `dist/`, `out/` build outputs.

## Build, Test, and Development Commands
- `npm run dev`: Start Next.js dev server.
- `npm run electron-dev`: Run Next.js + Electron together for desktop dev.
- `npm run build`: Next.js production build, then path fixes and asset copy.
- `npm run build-electron`: Compile Electron `main` and `preload` TS.
- `npm run dist`: App build + Electron compile + package (no publish). Variants: `dist:win`, `dist:mac`, `dist:linux`.
- `npm run lint`: Lint with ESLint/Next config.
- `npm run benchmark`: Performance benchmark utilities.

## Coding Style & Naming Conventions
- Language: TypeScript, React 18, Next.js 14.
- Formatting: Prettier (2 spaces, single quotes, semicolons, width 100). Run via editor integration; CI uses `next lint`.
- ESLint: no unused imports/vars, prefer `const`, no `debugger`, limited `console` (warn). SonarJS rules enforce complexity and duplication limits.
- Files: Components `PascalCase.tsx`, hooks `useX.ts`, utilities `camelCase.ts` in `src/utils`, providers in `src/services/providers`.

## Testing Guidelines
- No unit-test runner is configured. Use `npm run lint` and manual flows.
- Validate app: `npm run dev` (web) or `npm run electron-dev` (desktop). See `docs/test-windows-internal-commands.md` for manual cases.
- If adding tests, colocate under `src/**/__tests__` and propose tooling (Vitest or Jest) in PR.

## Commit & Pull Request Guidelines
- Prefer Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`. Scopes welcome (e.g., `docs(readme): ...`).
- PRs: clear description, link issues, list user-visible changes; include screenshots/gifs for UI and platform (Win/Mac/Linux) notes for Electron.
- Before opening: run `npm run lint` and build (`npm run build` or `npm run dist` for packaging changes).

## Security & Configuration Tips
- Do not hardcode API keys. Use in-app secure storage (`secureApiKeyService`) and provider settings.
- Browser build excludes native modules; Electron-only code must guard against web imports (see `next.config.js`).
