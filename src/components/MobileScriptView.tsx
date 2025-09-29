/**
 * MobileScriptView Component
 *
 * Graceful degradation component for mobile devices that displays
 * scripts in a read-only format with clear messaging about desktop editing.
 *
 * Features:
 * - Clean, mobile-optimized read-only script display
 * - Component number indicators (C1, C2, etc.)
 * - Clear messaging about desktop-only editing
 * - Loading and error states
 * - Script metadata display
 */

import React, { useState, useEffect } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { loadScriptForVideo, Script, ComponentData } from '../services/scriptService';

export const MobileScriptView: React.FC = () => {
  const { selectedVideo } = useNavigation();
  const { userProfile } = useAuth();

  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [components, setComponents] = useState<ComponentData[]>([]);

  // Load script when selected video changes
  useEffect(() => {
    let mounted = true;

    const loadScript = async () => {
      if (!selectedVideo) return;

      setIsLoading(true);
      setError(null);

      try {
        const script = await loadScriptForVideo(selectedVideo.id, userProfile?.role);

        if (!mounted) return;

        setCurrentScript(script);

        // Extract components from plain text
        if (script.plain_text) {
          const paragraphs = script.plain_text
            .split('\n\n')
            .filter(p => p.trim().length > 0);

          const extractedComponents: ComponentData[] = paragraphs.map((paragraph, index) => ({
            number: index + 1,
            content: paragraph.trim(),
            wordCount: paragraph.trim().split(/\s+/).filter(Boolean).length,
            hash: (paragraph.length + index).toString()
          }));

          setComponents(extractedComponents);
        } else {
          setComponents([]);
        }
      } catch (err) {
        if (!mounted) return;

        console.error('Failed to load script for mobile view:', err);
        setError('Failed to load script. Please try again.');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadScript();

    return () => {
      mounted = false;
    };
  }, [selectedVideo, userProfile?.role]);

  // Calculate total word count
  const totalWordCount = components.reduce((sum, comp) => sum + comp.wordCount, 0);


  return (
    <div className="mobile-script-view" data-testid="mobile-script-view">
      <style>{`
        .mobile-script-view {
          min-height: 100vh;
          background: #f8f9fa;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        }

        .mobile-header {
          background: white;
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .mobile-title {
          font-size: 20px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .mobile-subtitle {
          font-size: 14px;
          color: #6c757d;
          margin: 0;
        }

        .desktop-notice {
          background: #e3f2fd;
          border: 1px solid #bbdefb;
          border-radius: 8px;
          padding: 16px;
          margin: 20px;
          text-align: center;
        }

        .desktop-notice-title {
          font-size: 16px;
          font-weight: 600;
          color: #1976d2;
          margin: 0 0 8px 0;
        }

        .desktop-notice-text {
          font-size: 14px;
          color: #1565c0;
          margin: 0 0 12px 0;
          line-height: 1.5;
        }

        .desktop-notice-action {
          font-size: 13px;
          color: #1976d2;
          font-weight: 500;
        }

        .script-content {
          background: white;
          margin: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          overflow: hidden;
        }

        .script-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
          background: #f8f9fa;
        }

        .script-meta {
          font-size: 13px;
          color: #6c757d;
          margin: 0;
        }

        .script-body {
          padding: 20px;
        }

        .component-item {
          position: relative;
          margin-bottom: 20px;
          padding-left: 50px;
        }

        .component-label {
          position: absolute;
          left: 0;
          top: 2px;
          background: #6c757d;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .component-content {
          font-size: 16px;
          line-height: 1.6;
          color: #333;
        }

        .loading-state {
          text-align: center;
          padding: 60px 20px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e9ecef;
          border-top: 3px solid #6c757d;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-text {
          font-size: 16px;
          color: #6c757d;
          margin: 0;
        }

        .error-state {
          background: #fff5f5;
          border: 1px solid #feb2b2;
          border-radius: 8px;
          padding: 20px;
          margin: 20px;
          text-align: center;
        }

        .error-title {
          font-size: 16px;
          font-weight: 600;
          color: #e53e3e;
          margin: 0 0 8px 0;
        }

        .error-text {
          font-size: 14px;
          color: #c53030;
          margin: 0;
        }

        .no-video-state {
          text-align: center;
          padding: 60px 20px;
        }

        .no-video-title {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 12px 0;
        }

        .no-video-text {
          font-size: 14px;
          color: #6c757d;
          margin: 0;
        }

        .empty-script-state {
          text-align: center;
          padding: 40px 20px;
          color: #6c757d;
        }

        .empty-script-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .empty-script-text {
          font-size: 14px;
          margin: 0;
        }
      `}</style>

      {/* Header */}
      <div className="mobile-header">
        <h1 className="mobile-title">
          {selectedVideo ? `Script: ${selectedVideo.title}` : 'Script Viewer'}
        </h1>
        <p className="mobile-subtitle">Mobile View - Read Only</p>
      </div>

      {/* Desktop Editing Notice */}
      <div className="desktop-notice">
        <h2 className="desktop-notice-title">📱 Mobile View</h2>
        <p className="desktop-notice-text">
          Script editing requires desktop browser. View script content below.
        </p>
        <p className="desktop-notice-action">
          Switch to desktop for full editing experience
        </p>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="loading-state">
          <div className="loading-spinner" data-testid="loading-spinner"></div>
          <p className="loading-text">Loading script...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <h3 className="error-title">Error Loading Script</h3>
          <p className="error-text">Please try again or contact support if the issue persists.</p>
        </div>
      ) : !selectedVideo ? (
        <div className="no-video-state">
          <h3 className="no-video-title">No Video Selected</h3>
          <p className="no-video-text">Select a video to view its script content.</p>
        </div>
      ) : !currentScript || !currentScript.plain_text || components.length === 0 ? (
        <div className="empty-script-state">
          <h3 className="empty-script-title">No Script Content</h3>
          <p className="empty-script-text">This video doesn't have a script yet.</p>
        </div>
      ) : (
        <div className="script-content">
          <div className="script-header">
            <p className="script-meta">
              {components.length} component{components.length !== 1 ? 's' : ''} • {totalWordCount} total words
            </p>
          </div>
          <div className="script-body">
            {components.map((component) => (
              <div key={component.number} className="component-item">
                <div className="component-label">C{component.number}</div>
                <div className="component-content">
                  {component.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileScriptView;