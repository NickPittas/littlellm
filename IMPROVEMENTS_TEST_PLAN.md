# LittleLLM UI/UX Improvements Test Plan

## Overview
This document outlines the testing plan for the four major UI/UX improvements implemented:

1. **Enhanced Window Dragging**
2. **Customized Popup Window Title Bars**
3. **Immediate MCP Server Changes**
4. **Prompt Editing Feature**

## Test Environment Setup

### Prerequisites
- LittleLLM application running in development mode
- Access to settings overlay
- At least one MCP server configured (for MCP testing)
- Both built-in and custom prompts available

## 1. Enhanced Window Dragging Tests

### Test 1.1: Basic Window Dragging
**Objective**: Verify the entire window is draggable from any non-interactive area
**Steps**:
1. Launch LittleLLM application
2. Click and drag from empty areas (background, non-interactive spaces)
3. Verify window moves smoothly
4. Test dragging from different areas of the window

**Expected Results**:
- Window should be draggable from any area that doesn't contain interactive elements
- Dragging should be smooth and responsive
- Window should not move when clicking on buttons, input fields, or other interactive elements

### Test 1.2: Interactive Elements Preservation
**Objective**: Ensure all interactive elements remain functional
**Steps**:
1. Test all buttons in the main interface
2. Test text input in the message field
3. Test dropdown menus and selectors
4. Test file attachment functionality
5. Test screenshot capture
6. Test all toolbar buttons

**Expected Results**:
- All interactive elements should work normally
- No dragging should occur when interacting with buttons, inputs, dropdowns
- Form functionality should be preserved

### Test 1.3: Visual Feedback
**Objective**: Verify proper visual feedback during dragging
**Steps**:
1. Start dragging the window
2. Observe cursor changes
3. Check for any visual indicators

**Expected Results**:
- Cursor should change to "grabbing" during drag operations
- No unwanted text selection should occur during dragging

## 2. Popup Window Title Bar Customization Tests

### Test 2.1: Settings Window Styling
**Objective**: Verify settings window has consistent styling
**Steps**:
1. Open settings window (Ctrl+Shift+L or via toolbar)
2. Examine title bar styling
3. Check for menu bar visibility
4. Verify window theme consistency

**Expected Results**:
- Title bar should use custom styling (hiddenInset)
- Menu bar should be hidden
- Background color should match dark theme (#1a1a1a)
- Title should show "LittleLLM - Settings"
- Custom header with primary accent color should be visible

### Test 2.2: Action Menu Window Styling
**Objective**: Verify action menu window has consistent styling
**Steps**:
1. Open action menu (Ctrl+Shift+Space)
2. Examine title bar styling
3. Check for menu bar visibility
4. Verify window theme consistency

**Expected Results**:
- Title bar should use custom styling (hiddenInset)
- Menu bar should be hidden
- Background color should match dark theme (#1a1a1a)
- Title should show "LittleLLM - Quick Actions"
- Custom header with primary accent color should be visible

## 3. Immediate MCP Server Changes Tests

### Test 3.1: Server Connection Speed
**Objective**: Verify MCP servers connect immediately without delays
**Steps**:
1. Open settings and navigate to MCP tab
2. Add a new MCP server with enabled=true
3. Measure time from save to connection
4. Check console logs for connection timing

**Expected Results**:
- Server should connect immediately after saving
- No artificial 2-second delay should be present
- Connection status should update in real-time

### Test 3.2: Server Enable/Disable
**Objective**: Test immediate enable/disable functionality
**Steps**:
1. Have an MCP server configured
2. Toggle the enabled state
3. Observe connection changes
4. Check available tools/prompts update

**Expected Results**:
- Enabling should connect server immediately
- Disabling should disconnect server immediately
- UI should reflect changes without page refresh

### Test 3.3: Server Configuration Changes
**Objective**: Test immediate application of configuration changes
**Steps**:
1. Modify MCP server environment variables
2. Save changes
3. Verify server restarts with new configuration

**Expected Results**:
- Server should restart automatically with new config
- Changes should be applied immediately
- No manual restart should be required

## 4. Prompt Editing Feature Tests

### Test 4.1: Edit Custom Prompts
**Objective**: Verify editing of existing custom prompts
**Steps**:
1. Open settings and navigate to Prompts tab
2. Find a custom prompt
3. Click the Edit button
4. Modify the prompt content
5. Save changes

**Expected Results**:
- Edit dialog should open with current prompt data
- Changes should be saved to the existing custom prompt
- Updated prompt should appear in the list

### Test 4.2: Edit Built-in Prompts
**Objective**: Verify editing built-in prompts creates custom copies
**Steps**:
1. Open settings and navigate to Prompts tab
2. Find a built-in prompt
3. Click the Edit button
4. Modify the prompt content
5. Save changes

**Expected Results**:
- Edit dialog should open with "(Custom)" appended to name
- Info message should explain custom copy creation
- New custom prompt should be created
- Original built-in prompt should remain unchanged

### Test 4.3: Edit Button Visibility
**Objective**: Verify Edit button is visible for all prompts
**Steps**:
1. Check all prompts in the list
2. Verify Edit button presence
3. Check tooltips for different prompt types

**Expected Results**:
- Edit button should be visible for all prompts
- Tooltip should indicate behavior for built-in vs custom prompts
- Delete button should only be visible for custom prompts

## Integration Tests

### Test 5.1: Combined Functionality
**Objective**: Test all improvements working together
**Steps**:
1. Use enhanced dragging to move main window
2. Open settings with custom title bar
3. Edit a prompt while MCP servers are running
4. Verify all features work simultaneously

**Expected Results**:
- All features should work independently and together
- No conflicts or interference between improvements
- Performance should remain smooth

## Performance Tests

### Test 6.1: Memory Usage
**Objective**: Verify improvements don't cause memory leaks
**Steps**:
1. Monitor memory usage before improvements
2. Use all new features extensively
3. Monitor memory usage after extended use

**Expected Results**:
- No significant memory increase
- No memory leaks from event listeners
- Stable performance over time

### Test 6.2: Responsiveness
**Objective**: Ensure UI remains responsive
**Steps**:
1. Test dragging performance
2. Test popup window opening speed
3. Test MCP server connection speed
4. Test prompt editing responsiveness

**Expected Results**:
- All interactions should feel immediate
- No lag or stuttering during operations
- Smooth animations and transitions

## Regression Tests

### Test 7.1: Existing Functionality
**Objective**: Verify no existing features were broken
**Steps**:
1. Test chat functionality
2. Test file attachments
3. Test screenshot capture
4. Test provider/model selection
5. Test conversation history
6. Test all toolbar functions

**Expected Results**:
- All existing functionality should work as before
- No regressions in core features
- All user workflows should remain intact

## Test Results Documentation

For each test, document:
- ✅ Pass / ❌ Fail status
- Actual behavior observed
- Any issues or unexpected behavior
- Screenshots or recordings if applicable
- Performance metrics where relevant

## Known Issues and Limitations

Document any known issues discovered during testing:
- Browser compatibility notes
- Platform-specific behaviors
- Performance considerations
- User experience edge cases
