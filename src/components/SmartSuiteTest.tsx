import { useState } from 'react';
import { smartSuiteAPI } from '../lib/smartsuite-api';

export const SmartSuiteTest = () => {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  const testConnection = async () => {
    setLoading(true);
    setStatus('Testing connection...');

    try {
      // Test basic connection
      const result = await smartSuiteAPI.testConnection();

      if (result.success) {
        setStatus(`✅ ${result.message}`);

        // Try fetching projects
        setStatus(prev => prev + '\n📋 Fetching projects...');
        const projectData = await smartSuiteAPI.fetchProjects();

        if (projectData.length > 0) {
          setProjects(projectData);
          setStatus(prev => prev + `\n✅ Found ${projectData.length} projects`);
          console.log('Projects:', projectData);
        } else {
          setStatus(prev => prev + '\n⚠️ No projects found');
        }
      } else {
        setStatus(`❌ ${result.message}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('SmartSuite test error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      margin: '20px'
    }}>
      <h3>SmartSuite Integration Test</h3>

      <button
        onClick={testConnection}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: loading ? '#ccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Testing...' : 'Test SmartSuite Connection'}
      </button>

      {status && (
        <div style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: 'white',
          borderRadius: '4px',
          whiteSpace: 'pre-line',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          {status}
        </div>
      )}

      {projects.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4>First 5 Projects:</h4>
          <ul>
            {projects.slice(0, 5).map(project => (
              <li key={project.id}>
                {project.title || project.eav_code || project.id}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};