/**
 * SIMPLIFIED POC: Paragraph-Based Component System
 *
 * Each paragraph is automatically a component
 * Clean copy/paste with visual indicators only
 */

import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

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
  const [componentCount, setComponentCount] = useState(0);
  const [extractedComponents, setExtractedComponents] = useState<any[]>([]);

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
    content: `
      <h2>EAV Script Editor - Component Model</h2>
      <p>This is the first component of your script. Each paragraph automatically becomes a distinct video component that will flow through scenes, voice generation, and edit guidance.</p>
      <p>When you press Enter, you create a new component. Notice how each component maintains its identity - C2 will become Scene 2, Voice file 2, and Edit guidance 2.</p>
      <p>The prototype validates that this paragraph=component architecture works intuitively for content creators while maintaining stable component IDs for the production workflow.</p>
      <p>Simply type your script naturally. The system automatically extracts components from your paragraphs, maintaining the 1:1 relationship throughout the production pipeline.</p>
    `,
    onUpdate: ({ editor }) => {
      extractComponents(editor);
    },
    onCreate: ({ editor }) => {
      extractComponents(editor);
    }
  });

  const extractComponents = (editor: any) => {
    const components: any[] = [];
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

    setComponentCount(componentNum);
    setExtractedComponents(components);
  };

  const generateHash = (text: string): string => {
    return text.length.toString(36) + text.charCodeAt(0).toString(36);
  };

  const testCopy = () => {
    if (!editor) return;

    // Select all content
    editor.commands.selectAll();
    document.execCommand('copy');
    editor.commands.setTextSelection(0);

    alert('Content copied! Paste it anywhere to see clean text without component labels.');
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
          <h1 className="editor-title">Script Editor</h1>
          <p className="editor-subtitle">Each paragraph becomes a component (C1, C2, C3...) that flows through the production pipeline</p>
        </div>

        <div className="editor-content">
          <EditorContent editor={editor} />
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
      </div>
    </div>
  );
};

export default TipTapEditor;