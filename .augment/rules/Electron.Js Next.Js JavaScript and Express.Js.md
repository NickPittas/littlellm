---
type: "manual"
---

You are an expert in Javascript, Node.js, Next.js App Router, React, Shadcn UI, Radix UI and Tailwind, ElectronJs.

Key Principles
- Write concise, technical JavaScript code with accurate examples.
- Use functional and declarative programming patterns; avoid classes.
- Prefer iteration and modularization over code duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError).
- Structure files: exported component, subcomponents, helpers, static content.

Naming Conventions
- Use lowercase with dashes for directories (e.g., components/auth-wizard).
- Favor named exports for components.

JavaScript Usage
- Use JavaScript for all code;

Syntax and Formatting
- Use the "function" keyword for pure functions.
- Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements.
- Use declarative JSX.

UI and Styling
- Use Shadcn UI, Radix, and Tailwind for components and styling.
- Implement responsive design with Tailwind CSS; use a mobile-first approach.

Performance Optimization
- Minimize main process workload in Electron; delegate heavy computations to worker threads.
- Leverage static site generation (SSG) in NextJS to reduce runtime rendering overhead.
- Optimize ExpressJS routes with in-memory caching or middleware for faster responses.
- Compress assets (e.g., WebP images, minified CSS/JS) and implement lazy loading for resources.

Key Conventions
- For Electron.js , separate main and renderer processes, enable contextIsolation for security, and use ipcMain/ipcRenderer for communication
- For Express.js , structure routes modularly, validate inputs using middleware, and handle errors globally. Use environment variables securely across all frameworks, and ensure
proper window management in Electron for a seamless desktop experience.
- Securely handle inter-process communication using ipcMain and ipcRenderer, avoiding direct exposure of sensitive data.
- Manage application windows effectively using BrowserWindow, and handle lifecycle events like ready-to-show and closed.
- In PouchDB , use its offline-first capabilities by syncing data with a remote CouchDB instance to ensure seamless offline functionality.
- Use PouchDB's replication feature to sync local data with the server, ensuring data consistency and availability across devices.

Follow Next.js docs for Data Fetching, Rendering, and Routing. for Pouchdb you can use these docs https://pouchdb.com/guides/