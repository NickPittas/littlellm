# Component Mapping for UI Refactoring

## Current vs New Component Architecture

### Main Interface Components

#### ModernChatInterface.tsx
**Current**: Modern main interface with Magic UI components
**Features**:
- Magic Container with enhanced animations
- Blur Fade for content appearance
- Smooth resize animations
- Enhanced transparency effects
- Integrated sidebar and modern layout

#### BottomInputArea
**Current**: Modern input area with integrated controls
**Features**:
- Integrated provider/model selection
- Tool toggles and file upload
- Agent selection dropdown
- Send/stop button toggle

### Message System

#### Message Bubbles
**Current**: Basic Card components
**New**: Magic Card with gradient effects
- Mouse-following gradient on hover
- Smooth entrance animations with Blur Fade
- Better visual distinction between user/AI messages

#### Chat History
**Current**: Simple list rendering
**New**: Animated List with staggered animations
- Blur Fade for each message
- Smooth scroll animations
- Enhanced loading states

### Navigation & Panels

#### Sidebar/History Panel
**Current**: Basic slide animation
**New**: Enhanced animated panel
- Blur Fade for content
- Smooth slide transitions
- Better visual hierarchy

#### Settings Panel
**Current**: Basic modal/dialog
**New**: Animated modal with enhanced UX
- Blur Fade entrance
- Smooth tab transitions
- Better form animations

### Interactive Elements

#### Buttons
**Current**: Basic Shadcn buttons
**New**: Enhanced buttons with Magic UI effects
- Hover animations
- Loading states with Border Beam
- Better feedback

#### Dropdowns
**Current**: Basic Radix dropdowns
**New**: Enhanced dropdowns with animations
- Smooth open/close transitions
- Better visual hierarchy
- Animated content

#### File Upload
**Current**: Basic drag-drop
**New**: Enhanced drag-drop with animations
- Animated file previews
- Better visual feedback
- Smooth state transitions

## Implementation Priority

### Phase 1: Core Layout (Week 1)
1. VoilaInterface → Magic Container
2. Message bubbles → Magic Card
3. Bottom toolbar → Dock component

### Phase 2: Enhanced Interactions (Week 2)
1. Sidebar animations
2. Settings panel improvements
3. Button enhancements

### Phase 3: Advanced Features (Week 3)
1. File upload animations
2. Loading states
3. Micro-interactions

### Phase 4: Polish & Testing (Week 4)
1. Performance optimization
2. Accessibility improvements
3. Cross-platform testing

## Magic UI Component Usage

### AnimatedBeam
- **Use Case**: Show data flow between components
- **Implementation**: Provider connections, tool execution flow
- **Location**: Between toolbar icons and active states

### MagicCard
- **Use Case**: Message bubbles, settings panels, file previews
- **Implementation**: Replace current Card components
- **Features**: Mouse-following gradient, hover effects

### Dock
- **Use Case**: Bottom toolbar with provider selection and tools
- **Implementation**: Replace current toolbar layout
- **Features**: Icon magnification, smooth animations

### BlurFade
- **Use Case**: Content entrance animations
- **Implementation**: Messages, panels, modals
- **Features**: Smooth fade-in with blur effect

### BorderBeam
- **Use Case**: Highlight active elements
- **Implementation**: Active provider, loading states
- **Features**: Animated border highlighting

## Animation Timing

### Entrance Animations
- **Messages**: 0.4s Blur Fade with 0.1s stagger
- **Panels**: 0.3s slide with 0.2s Blur Fade content
- **Modals**: 0.2s scale with backdrop fade

### Hover Effects
- **Cards**: Instant gradient follow (0ms delay)
- **Buttons**: 150ms scale and color transition
- **Icons**: 200ms scale with spring physics

### Loading States
- **Border Beam**: 2s infinite loop
- **Pulse**: 1.5s infinite for placeholders
- **Spinner**: 1s infinite for active loading

## Responsive Behavior

### Desktop (Primary)
- Full Magic UI effects
- All animations enabled
- Maximum visual fidelity

### Reduced Motion
- Respect `prefers-reduced-motion`
- Disable complex animations
- Maintain functionality

### Performance Mode
- Simplified animations for lower-end devices
- Reduced particle effects
- Optimized rendering

## Testing Strategy

### Visual Testing
- Component isolation testing
- Animation timing verification
- Cross-browser compatibility

### Performance Testing
- Frame rate monitoring
- Memory usage tracking
- Battery impact assessment

### Accessibility Testing
- Keyboard navigation
- Screen reader compatibility
- Color contrast verification

## Migration Path

### Gradual Migration
1. Create new components alongside existing ones
2. Feature flag new UI components
3. A/B test with user feedback
4. Gradual rollout with fallback options

### Rollback Strategy
- Maintain existing components during transition
- Feature flags for easy rollback
- Performance monitoring for issues
- User feedback collection
