import { useEffect, useState, useRef } from 'react';
import { settingsService } from '../services/settingsService';

// Global counter to track calls across re-renders
let globalCallCount = 0;
let globalCallLog: string[] = [];

export default function TestSettingsReload() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [notifyListenersCalls, setNotifyListenersCalls] = useState(globalCallCount);
  const [listenerCallLog, setListenerCallLog] = useState<string[]>(globalCallLog);
  const callCountRef = useRef(0);

  useEffect(() => {
    // Mock window.electronAPI for testing
    if (typeof window !== 'undefined' && !window.electronAPI) {
      (window as any).electronAPI = {
        getSettings: () => {
          console.log('🔧 Mock electronAPI.getSettings called');
          return Promise.resolve({
            chat: { provider: 'test', model: 'test-model' },
            ui: { theme: 'dark' },
            shortcuts: { toggleWindow: 'Ctrl+L' },
            general: { autoStartWithSystem: false }
          });
        },
        updateAppSettings: (settings: any) => {
          console.log('🔧 Mock electronAPI.updateAppSettings called with:', settings);
          return Promise.resolve(true);
        }
      };
    }

    // Track notifyListeners calls with a more robust approach
    // Get the actual settingsService instance
    const service = settingsService as any;
    const originalNotifyListeners = service.notifyListeners;

    if (originalNotifyListeners && !service._isHooked) {
      service.notifyListeners = function(...args: any[]) {
        globalCallCount++;
        callCountRef.current = globalCallCount;
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp}: notifyListeners called (call #${globalCallCount})`;
        globalCallLog.push(logEntry);
        console.log(`🔔 ${logEntry}`);

        setNotifyListenersCalls(globalCallCount);
        setListenerCallLog([...globalCallLog]);

        // Call the original method
        return originalNotifyListeners.apply(this, args);
      };

      // Mark as hooked to prevent double hooking
      service._isHooked = true;
      service._originalNotifyListeners = originalNotifyListeners;

      console.log('✅ Successfully hooked notifyListeners method');
    } else if (service._isHooked) {
      console.log('🔄 notifyListeners already hooked, updating state');
      setNotifyListenersCalls(globalCallCount);
      setListenerCallLog([...globalCallLog]);
    } else {
      console.error('❌ Failed to find notifyListeners method');
    }

    return () => {
      // Don't restore on cleanup to maintain hook across re-renders
      console.log('🔄 Component cleanup (keeping hook active)');
    };
  }, []);

  const resetCounter = () => {
    globalCallCount = 0;
    globalCallLog = [];
    callCountRef.current = 0;
    setNotifyListenersCalls(0);
    setListenerCallLog([]);
    console.log('🔄 Reset call counter and log');
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    const results: string[] = [];

    // Reset counter before running tests
    resetCounter();

    const addResult = (testName: string, passed: boolean, details: string) => {
      const result = `${passed ? '✅' : '❌'} ${testName}: ${details}`;
      results.push(result);
      setTestResults([...results]);
    };

    // Test 0: Verify the hook is working by manually calling notifyListeners
    console.log('🧪 Testing hook by manually calling notifyListeners...');
    const beforeHookTest = callCountRef.current;
    try {
      (settingsService as any).notifyListeners();
      const afterHookTest = callCountRef.current;
      addResult('Hook Test (manual notifyListeners)', afterHookTest > beforeHookTest,
        `Calls before: ${beforeHookTest}, after: ${afterHookTest}`);
    } catch (error) {
      addResult('Hook Test (manual notifyListeners)', false, `Error: ${error}`);
    }

    // Test 1: updateSettingsInMemory should NOT trigger reload
    const beforeTest1 = callCountRef.current;
    settingsService.updateSettingsInMemory({ ui: { theme: 'light' } });
    const afterTest1 = callCountRef.current;
    addResult('updateSettingsInMemory', beforeTest1 === afterTest1,
      `Calls before: ${beforeTest1}, after: ${afterTest1}`);

    // Test 2: updateChatSettingsInMemory should NOT trigger reload
    const beforeTest2 = callCountRef.current;
    settingsService.updateChatSettingsInMemory({ provider: 'test' });
    const afterTest2 = callCountRef.current;
    addResult('updateChatSettingsInMemory', beforeTest2 === afterTest2,
      `Calls before: ${beforeTest2}, after: ${afterTest2}`);

    // Test 3: forceCleanCorruptedData should NOT trigger reload
    const beforeTest3 = callCountRef.current;
    settingsService.forceCleanCorruptedData();
    const afterTest3 = callCountRef.current;
    addResult('forceCleanCorruptedData', beforeTest3 === afterTest3,
      `Calls before: ${beforeTest3}, after: ${afterTest3}`);

    // Test 4: getSettings should NOT trigger reload
    const beforeTest4 = callCountRef.current;
    const settings = settingsService.getSettings();
    const afterTest4 = callCountRef.current;
    addResult('getSettings', beforeTest4 === afterTest4 && settings !== undefined,
      `Calls before: ${beforeTest4}, after: ${afterTest4}`);

    // Test 5: forceUpdateSettings SHOULD trigger reload (manual reload button)
    const beforeTest5 = callCountRef.current;
    settingsService.forceUpdateSettings({
      chat: { provider: 'test', model: 'test-model' },
      ui: { theme: 'dark' },
      shortcuts: { toggleWindow: 'Ctrl+L' },
      general: { autoStartWithSystem: false }
    });
    const afterTest5 = callCountRef.current;
    addResult('forceUpdateSettings', afterTest5 > beforeTest5,
      `Calls before: ${beforeTest5}, after: ${afterTest5}`);

    // Test 6: updateSettings SHOULD trigger reload (save settings)
    const beforeTest6 = callCountRef.current;
    try {
      console.log('🧪 Running updateSettings test...');
      const result = await settingsService.updateSettings({ ui: { theme: 'light' } });
      console.log('🧪 updateSettings result:', result);
      const afterTest6 = callCountRef.current;
      addResult('updateSettings', afterTest6 > beforeTest6,
        `Calls before: ${beforeTest6}, after: ${afterTest6}, saveResult: ${result}`);
    } catch (error) {
      console.error('🧪 updateSettings error:', error);
      addResult('updateSettings', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 7: reloadForMCPChange SHOULD trigger reload
    const beforeTest7 = callCountRef.current;
    try {
      console.log('🧪 Running reloadForMCPChange test...');
      await settingsService.reloadForMCPChange();
      console.log('🧪 reloadForMCPChange completed');
      const afterTest7 = callCountRef.current;
      addResult('reloadForMCPChange', afterTest7 > beforeTest7,
        `Calls before: ${beforeTest7}, after: ${afterTest7}`);
    } catch (error) {
      console.error('🧪 reloadForMCPChange error:', error);
      addResult('reloadForMCPChange', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    setIsRunning(false);
  };

  const passedTests = testResults.filter(r => r.startsWith('✅')).length;
  const totalTests = testResults.length;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Settings Reload Behavior Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Total notifyListeners calls:</strong> {notifyListenersCalls}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={runTests}
            disabled={isRunning}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: isRunning ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRunning ? 'not-allowed' : 'pointer'
            }}
          >
            {isRunning ? 'Running Tests...' : 'Run Settings Reload Tests'}
          </button>
          <button
            onClick={resetCounter}
            disabled={isRunning}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: isRunning ? '#ccc' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRunning ? 'not-allowed' : 'pointer'
            }}
          >
            Reset Counter
          </button>
        </div>
      </div>

      {listenerCallLog.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3>notifyListeners Call Log:</h3>
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            padding: '10px',
            maxHeight: '200px',
            overflowY: 'auto',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {listenerCallLog.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {testResults.length > 0 && (
        <div>
          <h2>Test Results ({passedTests}/{totalTests} passed)</h2>
          <div style={{ 
            backgroundColor: passedTests === totalTests ? '#d4edda' : '#f8d7da',
            border: `1px solid ${passedTests === totalTests ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
            padding: '10px',
            marginBottom: '20px'
          }}>
            {passedTests === totalTests ? 
              '🎉 ALL TESTS PASSED! Settings reload behavior is correct.' :
              '❌ SOME TESTS FAILED! Settings reload behavior needs fixing.'
            }
          </div>
          
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {testResults.map((result, index) => (
              <li key={index} style={{ 
                padding: '8px',
                backgroundColor: result.startsWith('✅') ? '#d4edda' : '#f8d7da',
                border: `1px solid ${result.startsWith('✅') ? '#c3e6cb' : '#f5c6cb'}`,
                borderRadius: '4px',
                marginBottom: '4px'
              }}>
                {result}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: '40px', fontSize: '14px', color: '#666' }}>
        <h3>Expected Behavior:</h3>
        <p>Settings should ONLY reload under these conditions:</p>
        <ol>
          <li>Manual reload button (forceUpdateSettings) ✅</li>
          <li>MCP server enable/disable (reloadForMCPChange) ✅</li>
          <li>Save settings (updateSettings) ✅</li>
        </ol>
        <p>All other operations should NOT trigger reload.</p>
      </div>
    </div>
  );
}
