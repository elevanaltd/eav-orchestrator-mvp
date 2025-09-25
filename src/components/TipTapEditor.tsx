/**
 * SIMPLIFIED POC: Paragraph-Based Component System with Navigation Integration
 *
 * Each paragraph is automatically a component
 * Integrates with NavigationContext to load/save scripts for selected videos
 * Clean copy/paste with visual indicators only
 */

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { useNavigation } from '../contexts/NavigationContext';
import { useScriptStatus } from '../contexts/ScriptStatusContext';
import { loadScriptForVideo, saveScript, ComponentData, Script } from '../services/scriptService';

// ============================================
// PARAGRAPH COMPONENT TRACKER
// ============================================

/**
 * Extension that tracks paragraphs as components
 * and adds visual indicators without affecting content
 */
const ParagraphComponentTracker = Extension.create({
  name: 'paragraphComponentTracker',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            let componentNumber = 0;

            // Iterate through the document
            state.doc.forEach((node, offset) => {
              // Each paragraph becomes a component
              if (node.type.name === 'paragraph' && node.content.size > 0) {
                componentNumber++;

                // Add a widget decoration for the component label
                const widget = Decoration.widget(offset, () => {
                  const label = document.createElement('div');
                  label.className = 'component-label';
                  label.setAttribute('data-component', `C${componentNumber}`);
                  label.textContent = `C${componentNumber}`;
                  label.style.cssText = `
                    position: absolute;
                    left: -50px;
                    background: #6B7280;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    user-select: none;
                    pointer-events: none;
                  `;
                  return label;
                }, {
                  side: -1,
                  marks: []
                });

                decorations.push(widget);
              }
            });

            return DecorationSet.create(state.doc, decorations);
          }
        }
      })
    ];
  }
});

// ============================================
// REACT COMPONENT
// ============================================

export const TipTapEditor: React.FC = () => {
  const { selectedVideo } = useNavigation();
  const { updateScriptStatus, clearScriptStatus } = useScriptStatus();

  // Script management state
  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');

  // Component extraction state
  const [extractedComponents, setExtractedComponents] = useState<ComponentData[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: 'component-paragraph'
          }
        }
      }),
      ParagraphComponentTracker
    ],
    content: '',
    onUpdate: ({ editor }) => {
      extractComponents(editor);
      setSaveStatus('unsaved');
      // Context will be updated via useEffect when extractedComponents changes
    },
    onCreate: ({ editor }) => {
      extractComponents(editor);
    }
  });

  // Load script when selected video changes
  useEffect(() => {
    if (selectedVideo && editor) {
      loadScriptForSelectedVideo();
    } else if (!selectedVideo && editor) {
      // Clear editor when no video selected
      editor.commands.setContent('');
      setCurrentScript(null);
      setSaveStatus('saved');
    }
  }, [selectedVideo, editor]);

  const loadScriptForSelectedVideo = async () => {
    if (!selectedVideo || !editor) return;

    setIsLoading(true);
    try {
      const script = await loadScriptForVideo(selectedVideo.id);
      setCurrentScript(script);

      // Initialize editor content from Y.js state or plain text
      // TODO: When Y.js is integrated, deserialize from yjs_state
      if (script.plain_text) {
        // For now, use plain text wrapped in basic HTML
        const initialContent = `<p>${script.plain_text.replace(/\n\n/g, '</p><p>')}</p>`;
        editor.commands.setContent(initialContent);
      } else {
        // Default content for new scripts
        editor.commands.setContent('<h2>Script for Video</h2><p>Start writing your script here. Each paragraph becomes a component that flows through the production pipeline.</p>');
      }

      extractComponents(editor);
      setSaveStatus('saved');
      setLastSaved(new Date(script.updated_at));
    } catch (error) {
      console.error('Failed to load script:', error);
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save functionality with debouncing
  useEffect(() => {
    if (!currentScript || saveStatus !== 'unsaved' || !editor) return;

    const saveTimer = setTimeout(() => {
      handleSave();
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(saveTimer);
  }, [extractedComponents, currentScript, saveStatus]);

  // Sync context with local state
  useEffect(() => {
    if (currentScript) {
      updateScriptStatus({
        saveStatus,
        lastSaved,
        componentCount: extractedComponents.length
      });
    } else {
      clearScriptStatus();
    }
  }, [saveStatus, lastSaved, extractedComponents, currentScript, updateScriptStatus, clearScriptStatus]);

  const handleSave = async () => {
    if (!currentScript || !editor) return;

    setSaveStatus('saving');
    try {
      const plainText = editor.getText();
      // TODO: Properly serialize Y.js state when Y.js is integrated
      // For now, we'll pass null and let the backend handle it
      const yjsState = null; // Will be implemented when Y.js is integrated
      const updatedScript = await saveScript(currentScript.id, yjsState, plainText, extractedComponents);
      setCurrentScript(updatedScript);
      setLastSaved(new Date());
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to save script:', error);
      setSaveStatus('error');
    }
  };

  const extractComponents = (editor: any) => {
    const components: ComponentData[] = [];
    let componentNum = 0;

    editor.state.doc.forEach((node: any) => {
      if (node.type.name === 'paragraph' && node.content.size > 0) {
        componentNum++;
        components.push({
          number: componentNum,
          content: node.textContent,
          wordCount: node.textContent.split(/\s+/).filter(Boolean).length,
          hash: generateHash(node.textContent)
        });
      }
    });

    setExtractedComponents(components);
  };

  const generateHash = (text: string): string => {
    return text.length.toString(36) + text.charCodeAt(0).toString(36);
  };

  const formatSaveTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };


  return (
    <div className="editor-layout">
      <style>{`
        .editor-layout {
          display: flex;
          height: 100vh;
          background: #f5f5f5;
        }

        /* Main Editor - Takes up most space */
        .main-editor {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: white;
          margin: 20px;
          margin-right: 10px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .editor-header {
          padding: 20px 30px;
          border-bottom: 2px solid #e5e5e5;
          background: #fafafa;
        }

        .editor-title {
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0;
        }

        .editor-subtitle {
          font-size: 14px;
          color: #666;
          margin-top: 5px;
        }

        .save-status {
          font-weight: 500;
          color: #10B981;
        }

        .save-status:has-text('Saving') {
          color: #F59E0B;
        }

        .save-status:has-text('error') {
          color: #EF4444;
        }

        .save-status:has-text('Unsaved') {
          color: #F59E0B;
        }

        /* Editor Content Area */
        .editor-content {
          flex: 1;
          overflow-y: auto;
          padding: 40px;
          padding-left: 100px; /* Space for component labels */
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .ProseMirror {
          min-height: calc(100vh - 200px);
          outline: none;
          font-size: 17px;
          line-height: 1.8;
          color: #333;
        }

        .ProseMirror h2 {
          font-size: 26px;
          margin-bottom: 15px;
          color: #1a1a1a;
          font-weight: 600;
        }

        .ProseMirror p {
          margin-bottom: 18px;
          position: relative;
        }

        /* Component labels - positioned in margin */
        .component-label {
          position: absolute !important;
          left: -60px !important;
          top: 3px;
        }

        /* Placeholder states */
        .no-video-placeholder,
        .loading-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          text-align: center;
          color: #666;
          background: #f8f9fa;
          border-radius: 8px;
          margin: 20px 0;
        }

        .no-video-placeholder h3 {
          font-size: 24px;
          color: #333;
          margin-bottom: 15px;
          font-weight: 600;
        }

        .no-video-placeholder p,
        .loading-placeholder p {
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 10px;
          max-width: 500px;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e5e5;
          border-top: 3px solid #6B7280;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Right Sidebar - Narrow for testing */
        .right-sidebar {
          width: 320px;
          background: white;
          margin: 20px;
          margin-left: 10px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 15px 20px;
          border-bottom: 2px solid #e5e5e5;
          background: #fafafa;
        }

        .sidebar-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #333;
        }

        .testing-notice {
          background: #FEF3C7;
          color: #92400E;
          padding: 8px 12px;
          margin: 10px;
          border-radius: 6px;
          font-size: 12px;
          border-left: 3px solid #F59E0B;
        }

        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
        }

        /* Component list in sidebar */
        .component-item {
          padding: 10px;
          background: #f8f9fa;
          border-radius: 6px;
          margin-bottom: 8px;
          border-left: 3px solid #6B7280;
        }

        .component-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .component-number {
          font-weight: 600;
          color: #1a1a1a;
          font-size: 13px;
        }

        .component-stats {
          font-size: 11px;
          color: #999;
        }

        .component-content {
          font-size: 12px;
          color: #666;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.4;
        }
      `}</style>

      {/* Main Editor Area */}
      <div className="main-editor">
        <div className="editor-header">
          <h1 className="editor-title">
            {selectedVideo ? `Script: ${selectedVideo.title}` : 'Script Editor'}
          </h1>
          <p className="editor-subtitle">
            {selectedVideo
              ? `Each paragraph becomes a component (C1, C2, C3...) that flows through the production pipeline`
              : `Select a video from the navigation to start editing its script`
            }
            {lastSaved && (
              <span className="save-status">
                {saveStatus === 'saving' && ' • Saving...'}
                {saveStatus === 'saved' && ` • Saved ${formatSaveTime(lastSaved)}`}
                {saveStatus === 'unsaved' && ' • Unsaved changes'}
                {saveStatus === 'error' && ' • Save error'}
              </span>
            )}
          </p>
        </div>

        <div className="editor-content">
          {isLoading ? (
            <div className="loading-placeholder">
              <div className="loading-spinner"></div>
              <p>Loading script...</p>
            </div>
          ) : !selectedVideo ? (
            <div className="no-video-placeholder">
              <h3>Select a Video to Edit</h3>
              <p>Choose a video from the navigation panel to start editing its script.</p>
              <p>Each paragraph you write becomes a component that flows through the production pipeline.</p>
            </div>
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>
      </div>

      {/* Right Sidebar - For Testing */}
      <div className="right-sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Component Extraction (Testing)</h2>
        </div>

        <div className="testing-notice">
          <strong>⚠️ Testing Only:</strong> This panel shows extracted components for validation. In production, this will be replaced with comments panel.
        </div>

        <div className="sidebar-content">
          {extractedComponents.map((comp) => (
            <div key={comp.number} className="component-item">
              <div className="component-header">
                <span className="component-number">C{comp.number}</span>
                <span className="component-stats">{comp.wordCount} words</span>
              </div>
              <div className="component-content">
                {comp.content}
              </div>
            </div>
          ))}

          {extractedComponents.length === 0 && (
            <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
              Start typing to see components extracted here
            </div>
          )}
        </div>

        {/* Script status now displayed in header */}
      </div>
    </div>
  );
};

export default TipTapEditor;