# MCP Environment Variables Fix

## Issue Description

**Critical Issue**: When editing MCP servers in the modern UI (SettingsModal.tsx), the Environment Variables section was completely missing from both the "Add Server" form and the inline "Edit Server" form.

This meant users could not:
- View existing environment variables when editing MCP servers
- Add new environment variables during editing
- Modify existing environment variables
- Remove environment variables

## Root Cause

The issue was in `src/components/modern-ui/SettingsModal.tsx`:

1. **Missing Helper Functions**: The environment variable management functions (`addEnvVariable`, `removeEnvVariable`, `updateEnvVariable`) were not implemented
2. **Missing UI Components**: The Environment Variables section was completely absent from both forms
3. **Inconsistency**: The old UI (`SettingsOverlay.tsx`) had the functionality, but the modern UI was missing it

## Files Affected

- `src/components/modern-ui/SettingsModal.tsx` - Main fix location

## Changes Made

### 1. Added Environment Variable Helper Functions

```typescript
const addEnvVariable = () => {
  const key = `ENV_VAR_${Object.keys(newMcpServer.env).length + 1}`;
  setNewMcpServer(prev => ({
    ...prev,
    env: { ...prev.env, [key]: '' }
  }));
};

const removeEnvVariable = (key: string) => {
  setNewMcpServer(prev => {
    const newEnv = { ...prev.env };
    delete newEnv[key];
    return { ...prev, env: newEnv };
  });
};

const updateEnvVariable = (oldKey: string, newKey: string, value: string) => {
  setNewMcpServer(prev => {
    const newEnv = { ...prev.env };
    if (oldKey !== newKey) {
      delete newEnv[oldKey];
    }
    newEnv[newKey] = value;
    return { ...prev, env: newEnv };
  });
};
```

### 2. Added Environment Variables Section to "Add Server" Form

Added complete UI section with:
- Header with "Add Variable" button
- Dynamic list of key-value input pairs
- Remove button for each variable
- Empty state message

### 3. Added Environment Variables Section to "Edit Server" Form

Added identical UI section to the inline edit form that appears when editing existing MCP servers.

## UI Components Added

```jsx
{/* Environment Variables Section */}
<div className="space-y-1">
  <div className="flex items-center justify-between">
    <Label className="text-xs">Environment Variables</Label>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={addEnvVariable}
      className="h-6 text-xs flex items-center gap-1"
    >
      <Plus className="h-3 w-3" />
      Add Variable
    </Button>
  </div>
  {Object.entries(newMcpServer.env).map(([key, value]) => (
    <div key={key} className="flex gap-1">
      <Input
        value={key}
        placeholder="Variable name"
        className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
        onChange={(e) => updateEnvVariable(key, e.target.value, value)}
      />
      <Input
        value={value}
        placeholder="Variable value"
        className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
        onChange={(e) => updateEnvVariable(key, key, e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => removeEnvVariable(key)}
        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  ))}
  {Object.keys(newMcpServer.env).length === 0 && (
    <p className="text-xs text-muted-foreground">No environment variables configured</p>
  )}
</div>
```

## Testing

To test the fix:

1. **Open LittleLLM Settings** (modern UI)
2. **Navigate to MCP tab**
3. **Add a new MCP server** - verify Environment Variables section is present
4. **Edit an existing MCP server** - verify Environment Variables section shows existing variables and allows editing
5. **Add/Remove/Modify environment variables** - verify all operations work correctly

## Impact

✅ **Fixed**: Users can now fully manage environment variables when adding or editing MCP servers
✅ **Consistent**: Modern UI now matches the functionality of the old UI
✅ **Complete**: All CRUD operations (Create, Read, Update, Delete) work for environment variables
✅ **User Experience**: No more missing critical configuration options

## Related Issues

This fix ensures that MCP servers can be properly configured with all necessary environment variables, which is critical for:
- API keys and authentication
- Custom configuration paths
- Runtime environment settings
- Integration with external services

## Status

🟢 **RESOLVED** - Environment variables are now fully supported in MCP server editing forms.
