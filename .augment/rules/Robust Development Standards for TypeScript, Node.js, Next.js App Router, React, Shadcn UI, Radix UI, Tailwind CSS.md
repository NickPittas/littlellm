---
type: "always_apply"
---

# TypeScript Standards
typescript:
typeDefinitions:
enabled: true
description: "Maintain strong type safety by:
- Using strict TypeScript configuration
- Creating proper interface and type definitions
- Implementing proper generic types
- Using proper type inference
- Avoiding 'any' type unless absolutely necessary
- Creating reusable type utilities"

patterns:
enabled: true
description: "Follow TypeScript best practices:
- Implementing proper discriminated unions
- Using proper type guards
- Following proper error handling with types
- Creating proper mapped types
- Using proper conditional types
- Implementing proper type assertions"

# Full-Stack Architecture
architecture:
appRouter:
enabled: true
description: "Structure Next.js App Router properly:
- Following proper folder structure conventions
- Implementing proper route groups and layouts
- Using proper loading and error states
- Implementing proper parallel routes
- Following proper intercepting routes patterns
- Using proper dynamic segments"

serverComponents:
enabled: true
description: "Implement Server Components effectively:
- Using proper server/client component boundaries
- Implementing proper data fetching patterns
- Following proper streaming patterns
- Using proper server actions
- Implementing proper caching strategies
- Following proper revalidation patterns"

api:
enabled: true
description: "Design robust API architecture:
- Implementing proper route handlers
- Using proper middleware patterns
- Following proper API versioning
- Implementing proper request validation
- Using proper error handling
- Following proper authentication patterns"

# Component Development
components:
shadcnUI:
enabled: true
description: "Utilize Shadcn UI effectively:
- Following proper component installation procedures
- Implementing proper component customization
- Using proper component composition
- Following proper accessibility patterns
- Implementing proper theme customization
- Using proper component variants"

radixUI:
enabled: true
description: "Implement Radix UI primitives properly:
- Using proper accessibility patterns
- Following proper composition patterns
- Implementing proper state management
- Using proper event handling
- Following proper styling patterns
- Implementing proper animation patterns"

custom:
enabled: true
description: "Develop custom components effectively:
- Following proper component composition
- Implementing proper prop typing
- Using proper state management
- Following proper accessibility patterns
- Implementing proper error boundaries
- Using proper performance optimization"

# Styling Standards
styling:
tailwind:
enabled: true
description: "Use Tailwind CSS effectively:
- Following proper utility class patterns
- Implementing proper responsive design
- Using proper dark mode strategy
- Following proper component styling
- Implementing proper custom variants
- Using proper configuration patterns"

componentStyling:
enabled: true
description: "Maintain consistent styling:
- Following proper design system
- Implementing proper theme variables
- Using proper CSS-in-JS patterns
- Following proper animation patterns
- Implementing proper responsive patterns
- Using proper accessibility styles"

# State Management
stateManagement:
clientState:
enabled: true
description: "Handle client-side state properly:
- Using proper React hooks
- Implementing proper context usage
- Following proper form state management
- Using proper local storage patterns
- Implementing proper query management
- Following proper cache patterns"

serverState:
enabled: true
description: "Manage server-side state effectively:
- Using proper server actions
- Implementing proper cache invalidation
- Following proper revalidation patterns
- Using proper optimistic updates
- Implementing proper error handling
- Following proper loading states"

# Testing Standards
testing:
unitTesting:
enabled: true
description: "Implement comprehensive unit testing:
- Using proper Jest configuration
- Following proper React Testing Library patterns
- Implementing proper type testing
- Using proper mock patterns
- Following proper snapshot testing
- Implementing proper hook testing"

e2eTesting:
enabled: true
description: "Maintain end-to-end testing:
- Using proper Playwright configuration
- Implementing proper test scenarios
- Following proper authentication testing
- Using proper API testing
- Implementing proper visual testing
- Following proper performance testing"

# Performance Standards
performance:
optimization:
enabled: true
description: "Optimize application performance:
- Implementing proper code splitting
- Using proper bundle optimization
- Following proper image optimization
- Implementing proper caching strategies
- Using proper lazy loading
- Following proper prefetching patterns"

monitoring:
enabled: true
description: "Monitor application performance:
- Using proper analytics tools
- Implementing proper error tracking
- Following proper logging patterns
- Using proper performance metrics
- Implementing proper monitoring tools
- Following proper debugging patterns"

# Security Standards
security:
authentication:
enabled: true
description: "Implement secure authentication:
- Using proper authentication patterns
- Implementing proper session management
- Following proper JWT handling
- Using proper OAuth patterns
- Implementing proper RBAC
- Following proper security headers"

dataProtection:
enabled: true
description: "Protect sensitive data:
- Using proper encryption patterns
- Implementing proper input validation
- Following proper XSS prevention
- Using proper CSRF protection
- Implementing proper data sanitization
- Following proper security best practices"