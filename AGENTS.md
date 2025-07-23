## LittleLLM Agent Instructions

This document provides essential commands and guidelines for agentic coding in the LittleLLM repository.

### Build, Lint, and Test

- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Test:** `npm run test`
- **Test a single file:** `vitest run <path_to_test_file>`

### Code Style

- **Formatting:** Use Prettier for code formatting.
- **Imports:** Organize imports logically. Use named imports where possible.
- **Types:** Use TypeScript for static typing. Define clear interfaces for data structures.
- **Naming:** Follow camelCase for variables and functions. Use PascalCase for classes and components.
- **Error Handling:** Implement robust error handling, especially for async operations and API calls.
- **Components:** Create modular, reusable React components.
- **State Management:** Use React context for global state.
- **Styling:** Use Tailwind CSS for styling.
- **Services:** Encapsulate business logic in services.
- **Dependencies:** Keep dependencies up to date.
