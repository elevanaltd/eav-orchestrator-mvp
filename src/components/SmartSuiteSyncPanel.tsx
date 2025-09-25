import { useState, useEffect } from 'react';
import { secureSmartSuite, SyncResult, SyncStatus } from '../lib/smartsuite-secure';

export function SmartSuiteSyncPanel() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string>('');

  // Load initial sync status
  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await secureSmartSuite.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const syncFromSmartSuite = async () => {
    setSyncing(true);
    setError('');
    setSyncResult(null);

    try {
      // 🔒 SECURE: All API calls go through Edge Functions
      // No API keys exposed to client, server-side authentication only
      const result = await secureSmartSuite.triggerSync();

      if (result) {
        setSyncResult(result);

        // Monitor sync progress with real-time updates
        const stopMonitoring = await secureSmartSuite.monitorSync((status) => {
          setSyncStatus(status);

          // Update UI when sync completes
          if (status.status === 'idle' || status.status === 'error') {
            setSyncing(false);
            if (status.lastError) {
              setError(status.lastError);
            }
          }
        });

        // Cleanup monitoring after component unmounts or sync completes
        setTimeout(stopMonitoring, 30000); // Auto-cleanup after 30 seconds
      }

    } catch (err) {
      console.error('Secure sync error:', err);
      setError(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
      setSyncing(false);
    }
  };

  const testSmartSuiteConnection = async () => {
    setSyncing(true);
    setError('');

    try {
      // 🔒 SECURE: Test Edge Function connectivity, not direct API access
      const isConnected = await secureSmartSuite.testConnection();

      if (isConnected) {
        const status = await secureSmartSuite.getSyncStatus();
        alert(`🔒 Secure connection test successful!\n\nEdge Function: ✅ Accessible\nSync Metadata: ✅ Readable\nLast Sync Count: ${status?.syncCount || 0}\n\nSecurity: Server-side only, no API keys exposed to client`);
      } else {
        throw new Error('Edge Function or sync_metadata table not accessible');
      }

    } catch (err) {
      console.error('Secure connection test error:', err);
      setError(`Connection test failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      right: '420px',
      top: '10px',
      width: '350px',
      background: 'white',
      border: '2px solid #0284c7',
      borderRadius: '8px',
      padding: '15px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 1000
    }}>
      <h3 style={{ marginTop: 0, color: '#0284c7' }}>
        🔒 SmartSuite Secure Sync
      </h3>

      {error && (
        <div style={{
          color: 'red',
          marginBottom: '10px',
          padding: '8px',
          background: '#fee',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <button
          onClick={testSmartSuiteConnection}
          disabled={syncing}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: syncing ? 'not-allowed' : 'pointer'
          }}
        >
          🔒 Test Secure Connection
        </button>

        <button
          onClick={syncFromSmartSuite}
          disabled={syncing}
          style={{
            padding: '8px 16px',
            background: syncing ? '#94a3b8' : '#0284c7',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {syncing ? '⏳ Syncing...' : '🔒 Secure Sync'}
        </button>
      </div>

      {syncStatus && (
        <div style={{
          fontSize: '12px',
          color: '#666',
          marginBottom: '10px',
          padding: '8px',
          background: '#f8f9fa',
          borderRadius: '4px'
        }}>
          <strong>Sync Status:</strong> {syncStatus.status === 'idle' ? '✅ Idle' :
                                        syncStatus.status === 'running' ? '🔄 Running' :
                                        '❌ Error'}
          <br/>
          {syncStatus.lastSyncCompleted && (
            <>Last completed: {new Date(syncStatus.lastSyncCompleted).toLocaleString()}<br/></>
          )}
          Total syncs: {syncStatus.syncCount}
        </div>
      )}

      {syncResult && (
        <div style={{
          padding: '10px',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '4px',
          fontSize: '13px'
        }}>
          <strong>Sync Results:</strong>
          <div style={{ marginTop: '5px' }}>
            ✅ Projects: {syncResult.projectsSynced}/{syncResult.projectsFound}
          </div>
          <div>
            ✅ Videos: {syncResult.videosSynced}/{syncResult.videosFound}
          </div>
          {syncResult.errors.length > 0 && (
            <div style={{ color: 'red', marginTop: '5px' }}>
              ⚠️ Errors: {syncResult.errors.join(', ')}
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '15px',
        paddingTop: '10px',
        borderTop: '1px solid #e5e7eb',
        fontSize: '11px',
        color: '#6b7280'
      }}>
        <strong>🔒 Security:</strong> Server-side only<br/>
        <strong>Architecture:</strong> Client → Edge Functions → SmartSuite<br/>
        <strong>Authentication:</strong> Service role (no client API keys)<br/>
        <strong>RLS:</strong> Enforced with distributed locking<br/>
        <div style={{ marginTop: '8px', padding: '6px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', fontStyle: 'italic' }}>
          ✅ <strong>Security Validated:</strong> No API keys exposed to browser.
          All SmartSuite access via secure Edge Functions only.
        </div>
      </div>
    </div>
  );
}