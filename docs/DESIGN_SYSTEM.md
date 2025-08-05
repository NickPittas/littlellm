# LittleLLM UI Refactoring - Design System

## Overview
This document defines the design system for the LittleLLM UI refactoring project using Magic UI components. The goal is to create a modern, animated, and cohesive user interface that maintains the existing functionality while providing a superior user experience.

## Technology Stack
- **UI Library**: Magic UI (150+ animated components)
- **Animation**: Framer Motion
- **Styling**: Tailwind CSS
- **Base Components**: Shadcn/ui (existing)
- **Framework**: Next.js 14 + React 18 + TypeScript

## Color Scheme
The design system maintains the existing dark theme with transparency support:

### Primary Colors
- **Background**: `hsl(var(--background))` - Main app background
- **Foreground**: `hsl(var(--foreground))` - Primary text color (white)
- **Card**: `hsl(var(--card))` - Card backgrounds with transparency
- **Border**: `hsl(var(--border))` - Subtle borders

### Accent Colors
- **Primary**: `hsl(var(--primary))` - Main brand color
- **Secondary**: `hsl(var(--secondary))` - Secondary actions
- **Muted**: `hsl(var(--muted))` - Disabled/inactive states
- **Accent**: `hsl(var(--accent))` - Highlights and hover states

### Magic UI Specific Colors
- **Gradient Start**: `#ffaa40` (Orange) - For animated beams and highlights
- **Gradient Stop**: `#9c40ff` (Purple) - For animated beams and highlights
- **Magic Card Gradient**: `#262626` - For hover effects on cards

## Typography
Maintaining the existing Inter font family with improved hierarchy:

### Font Sizes
- **Heading 1**: `text-2xl` (24px) - Main titles
- **Heading 2**: `text-xl` (20px) - Section headers
- **Heading 3**: `text-lg` (18px) - Subsection headers
- **Body**: `text-base` (16px) - Regular text
- **Small**: `text-sm` (14px) - Secondary text
- **Tiny**: `text-xs` (12px) - Captions and labels

### Font Weights
- **Bold**: `font-bold` (700) - Important headings
- **Semibold**: `font-semibold` (600) - Section headers
- **Medium**: `font-medium` (500) - Emphasized text
- **Normal**: `font-normal` (400) - Regular text

## Spacing & Layout
Following Tailwind's spacing scale with consistent patterns:

### Spacing Scale
- **xs**: `2px` (0.5) - Minimal spacing
- **sm**: `4px` (1) - Small spacing
- **md**: `8px` (2) - Medium spacing
- **lg**: `16px` (4) - Large spacing
- **xl**: `24px` (6) - Extra large spacing
- **2xl**: `32px` (8) - Section spacing

### Border Radius
- **Small**: `4px` - Small elements
- **Medium**: `8px` - Cards and buttons
- **Large**: `12px` - Panels and modals
- **Extra Large**: `16px` - Main containers

## Animation Patterns

### Entrance Animations
- **Blur Fade**: For content appearing (0.4s duration)
- **Slide In**: For panels and sidebars (0.3s duration)
- **Scale In**: For modals and popups (0.2s duration)

### Hover Effects
- **Magic Card**: Gradient following mouse cursor
- **Dock Icons**: Scale up on hover (1.5x magnification)
- **Buttons**: Subtle scale (1.05x) and color transition

### Loading States
- **Border Beam**: Animated border for active elements
- **Pulse**: For loading placeholders
- **Spin**: For loading indicators

### Transition Timing
- **Fast**: 150ms - Immediate feedback
- **Normal**: 300ms - Standard transitions
- **Slow**: 500ms - Complex animations

## Component Hierarchy

### Layout Components
1. **Main Container**: ModernChatInterface with Magic UI enhancements
2. **Sidebar**: LeftSidebar with animated slide-in panel with history and navigation
3. **Chat Area**: MainChatArea with Magic Card containers for messages
4. **Bottom Input**: BottomInputArea with integrated controls and animations

### Interactive Components
1. **Buttons**: Enhanced with hover animations
2. **Dropdowns**: Smooth slide animations
3. **Modals**: Blur fade entrance with backdrop
4. **Forms**: Animated focus states and validation

### Content Components
1. **Message Bubbles**: Magic Card with gradient effects
2. **File Previews**: Animated cards with hover states
3. **Settings Panels**: Tabbed interface with smooth transitions
4. **Prompts Library**: Grid of animated cards

## Accessibility
- Maintain existing keyboard navigation
- Respect `prefers-reduced-motion` for animations
- Ensure proper contrast ratios
- Provide focus indicators for all interactive elements

## Performance Guidelines
- Use `transform` and `opacity` for animations (GPU accelerated)
- Implement lazy loading for heavy components
- Optimize animation frame rates (60fps target)
- Use `will-change` sparingly and remove after animations

## Implementation Strategy
1. **Phase 1**: Core layout with Magic UI components
2. **Phase 2**: Enhanced interactions and animations
3. **Phase 3**: Polish and performance optimization
4. **Phase 4**: Testing and accessibility improvements

## Component Mapping
- **ModernChatInterface** → Magic Container + Animated Layout
- **Message Bubbles** → Magic Card with hover effects
- **BottomInputArea** → Integrated input with animated controls
- **LeftSidebar** → Animated panel with Blur Fade content
- **Settings** → SettingsModal with tabbed interface and smooth transitions
- **File Upload** → Enhanced drag-drop with animations
