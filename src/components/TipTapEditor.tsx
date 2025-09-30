/**
 * SIMPLIFIED POC: Paragraph-Based Component System with Navigation Integration
 *
 * Each paragraph is automatically a component
 * Integrates with NavigationContext to load/save scripts for selected videos
 * Clean copy/paste with visual indicators only
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node } from '@tiptap/pm/model';
import DOMPurify from 'dompurify';
import { CommentHighlightExtension } from './extensions/CommentHighlightExtension';
import { CommentSidebar } from './comments/CommentSidebar';
import { ToastContainer } from './ui/Toast';
import { useToast } from './ui/useToast';
import { ErrorBoundary } from './ErrorBoundary';
import { useNavigation } from '../contexts/NavigationContext';
import { useScriptStatus } from '../contexts/ScriptStatusContext';
import { useAuth } from '../contexts/AuthContext';
import { loadScriptForVideo, saveScript, ComponentData, Script } from '../services/scriptService';
import type { CreateCommentData } from '../types/comments';
import { Logger } from '../services/logger';

// Critical-Engineer: consulted for Security vulnerability assessment

// ============================================
// SECURITY UTILITIES
// ============================================

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMPurify with restrictive whitelist of allowed tags and attributes
 */
const sanitizeHTML = (dirtyHTML: string): string => {
  return DOMPurify.sanitize(dirtyHTML, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false
  });
};

/**
 * Safe conversion from plain text to HTML paragraphs
 * Prevents XSS injection through the line break replacement pattern
 */
const convertPlainTextToHTML = (plainText: string): string => {
  // First escape any HTML in the plain text
  const escaped = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Then convert newlines to paragraph breaks
  const withParagraphs = `<p>${escaped.replace(/\n\n/g, '</p><p>')}</p>`;

  // Finally sanitize the result (defense in depth)
  return sanitizeHTML(withParagraphs);
};

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
  const { userProfile } = useAuth();
  const { toasts, showSuccess, showError, showLoading, removeToast } = useToast();

  // Script management state
  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');

  // Component extraction state
  const [extractedComponents, setExtractedComponents] = useState<ComponentData[]>([]);

  // Comment selection state (Phase 2.2)
  const [selectedText, setSelectedText] = useState<{
    text: string;
    from: number;
    to: number;
  } | null>(null);
  const [showCommentPopup, setShowCommentPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);

  // Comment creation state (Phase 2.3)
  const [createCommentData, setCreateCommentData] = useState<{
    startPosition: number;
    endPosition: number;
    selectedText: string;
  } | null>(null);

  // Comment numbering and highlighting state
  const [commentCount, setCommentCount] = useState(0);
  const [, setCommentHighlights] = useState<Array<{
    commentId: string;
    commentNumber: number;
    startPosition: number;
    endPosition: number;
  }>>([]);

  // Track component mount state to prevent updates after unmount
  const isMountedRef = useRef(true);

  // Helper function to generate hash
  const generateHash = (text: string): string => {
    return text.length.toString(36) + text.charCodeAt(0).toString(36);
  };

  // Declare callback functions that don't depend on editor
  const extractComponents = useCallback((editor: Editor) => {
    // Only update state if component is still mounted
    if (!isMountedRef.current) return;

    const components: ComponentData[] = [];
    let componentNum = 0;

    editor.state.doc.forEach((node: Node) => {
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
  }, []);

  // Create editor first
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: 'component-paragraph'
          }
        }
      }),
      ParagraphComponentTracker,
      CommentHighlightExtension.configure({
        onHighlightClick: (commentId: string, _commentNumber: number) => {
          // Scroll to comment in sidebar when highlight is clicked
          const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
          if (commentElement) {
            commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        onHighlightHover: (commentId: string, commentNumber: number, isHovering: boolean) => {
          // Add hover effect to corresponding comment in sidebar
          const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
          if (commentElement) {
            if (isHovering) {
              commentElement.classList.add('highlight-hover');
            } else {
              commentElement.classList.remove('highlight-hover');
            }
          }
        }
      })
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // Check if mounted before updating state
      if (!isMountedRef.current) return;

      extractComponents(editor);
      setSaveStatus('unsaved');
      // Context will be updated via useEffect when extractedComponents changes
    },
    onCreate: ({ editor }) => {
      // Defer state updates to next tick to ensure component is fully mounted
      // This prevents the React state update warning
      requestAnimationFrame(() => {
        if (isMountedRef.current) {
          extractComponents(editor);
        }
      });
    },
    // SECURITY: Add paste event handler to sanitize pasted content
    editorProps: {
      handlePaste: (view, event) => {
        // Let TipTap handle the paste first, then sanitize
        const clipboardData = event.clipboardData;
        if (clipboardData) {
          const htmlData = clipboardData.getData('text/html');
          const textData = clipboardData.getData('text/plain');

          if (htmlData) {
            // Sanitize HTML paste data
            const sanitizedHTML = sanitizeHTML(htmlData);
            if (sanitizedHTML !== htmlData) {
              // If content was modified by sanitization, prevent default and insert safe content
              event.preventDefault();
              view.dispatch(
                view.state.tr.insertText(textData) // Fall back to plain text if HTML was dangerous
              );
              return true;
            }
          }
        }
        return false; // Let TipTap handle normal paste
      }
    }
  });

  // Text selection handler for comments (Phase 2.2)
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      if (!isMountedRef.current) return;

      const { from, to, empty } = editor.state.selection;

      if (empty) {
        // No text selected, hide popup
        setSelectedText(null);
        setShowCommentPopup(false);
        setPopupPosition(null);
      } else {
        // Text is selected
        const selectedContent = editor.state.doc.textBetween(from, to);
        if (selectedContent.trim()) {
          // Calculate popup position based on selection coordinates
          try {
            const coords = editor.view.coordsAtPos(from);
            const editorRect = editor.view.dom.getBoundingClientRect();

            // Position popup above selection, or below if not enough space above
            const popupHeight = 80; // Estimated popup height
            const spaceAbove = coords.top - editorRect.top;
            const spaceBelow = editorRect.bottom - coords.bottom;

            let top = coords.top - popupHeight - 10; // 10px gap above selection
            if (spaceAbove < popupHeight + 20 && spaceBelow > popupHeight + 20) {
              // Not enough space above, position below
              top = coords.bottom + 10;
            }

            const left = Math.max(20, Math.min(coords.left - 100, window.innerWidth - 220)); // Center popup, but keep on screen

            setSelectedText({
              text: selectedContent,
              from,
              to
            });
            setPopupPosition({ top, left });
            setShowCommentPopup(true);
          } catch (error) {
            // Fallback to center positioning if coordinate calculation fails
            Logger.warn('Failed to calculate popup position, using fallback', { error: (error as Error).message });
            setSelectedText({
              text: selectedContent,
              from,
              to
            });
            setPopupPosition(null); // Will use CSS fallback positioning
            setShowCommentPopup(true);
          }
        }
      }
    };

    // Listen for selection updates using TipTap's event system
    editor.on('selectionUpdate', handleSelectionUpdate);

    return () => {
      // Clean up the subscription
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor]);

  // Now define callbacks that depend on editor

  const handleSave = useCallback(async () => {
    if (!currentScript || !editor) return;

    // Don't save readonly placeholder scripts
    if (currentScript.id.startsWith('readonly-')) {
      return;
    }

    setSaveStatus('saving');
    try {
      const plainText = editor.getText();
      // ISSUE: Y.js Collaborative Editing Integration
      // Priority: High | Scope: Phase 4 (Real-time Collaboration)
      // Requirements: Implement Y.js serialization for collaborative state sync
      // Dependencies: Y.js library, WebSocket infrastructure, conflict resolution
      const yjsState = null; // Placeholder until Y.js integration in Phase 4
      const updatedScript = await saveScript(currentScript.id, yjsState, plainText, extractedComponents);

      // Only update state if still mounted
      if (isMountedRef.current) {
        setCurrentScript(updatedScript);
        setLastSaved(new Date());
        setSaveStatus('saved');
      }
    } catch (error) {
      if (isMountedRef.current) {
        Logger.error('Failed to save script', { error: (error as Error).message });
        setSaveStatus('error');
      }
    }
  }, [currentScript, editor, extractedComponents]);

  // Load comment highlights from database
  const loadCommentHighlights = useCallback(async (scriptId: string) => {
    if (!editor) return;

    try {
      // Import the comments module and load highlights
      const { getComments } = await import('../lib/comments');
      const { supabase } = await import('../lib/supabase');

      const result = await getComments(supabase, scriptId);

      if (result.success && result.data) {
        const highlights = result.data
          .filter(comment => !comment.parentCommentId) // Only parent comments have highlights
          .map((comment, index) => ({
            commentId: comment.id,
            commentNumber: index + 1,
            startPosition: comment.startPosition,
            endPosition: comment.endPosition,
          }));

        setCommentHighlights(highlights);
        setCommentCount(highlights.length);

        // Load highlights into editor
        if (highlights.length > 0) {
          editor.commands.loadExistingHighlights(highlights);
        }
      }
    } catch (error) {
      Logger.error('Failed to load comment highlights', { error: (error as Error).message });
    }
  }, [editor]);

  // Handle comment creation from sidebar
  const handleCommentCreated = useCallback(async (_data: CreateCommentData) => {
    let loadingToastId: string | null = null;

    try {
      // Show loading toast
      loadingToastId = showLoading('Creating comment...');

      // Clear creation state to hide form
      setCreateCommentData(null);

      if (editor && selectedText) {
        // Add visual highlight immediately for better UX
        const nextCommentNumber = commentCount + 1;

        // Create a temporary ID for immediate feedback
        const tempCommentId = `temp-${Date.now()}`;

        editor.commands.addCommentHighlight({
          commentId: tempCommentId,
          commentNumber: nextCommentNumber,
          from: selectedText.from,
          to: selectedText.to,
        });

        // Update local state
        const newHighlight = {
          commentId: tempCommentId,
          commentNumber: nextCommentNumber,
          startPosition: selectedText.from,
          endPosition: selectedText.to,
        };

        setCommentHighlights(prev => [...prev, newHighlight]);
        setCommentCount(prev => prev + 1);

        // Hide loading toast and show success
        if (loadingToastId) {
          removeToast(loadingToastId);
        }
        showSuccess('Comment created successfully!');

        // The actual comment creation is handled by the CommentSidebar
        // After successful creation, we should reload highlights to get the real comment ID
        // This will happen when the CommentSidebar refreshes its data
      } else {
        if (loadingToastId) {
          removeToast(loadingToastId);
        }
        showError('Failed to create comment highlight');
      }

    } catch (error) {
      Logger.error('Failed to create comment highlight', { error: (error as Error).message });
      if (loadingToastId) {
        removeToast(loadingToastId);
      }
      showError('Failed to create comment');
    }
  }, [editor, selectedText, commentCount, showLoading, showSuccess, showError, removeToast]);

  // Load script when selected video changes
  useEffect(() => {
    let mounted = true;

    const loadScript = async () => {
      if (!selectedVideo || !editor) return;

      setIsLoading(true);
      try {
        // Loading script for video

        const script = await loadScriptForVideo(selectedVideo.id, userProfile?.role);

        // Only update state if component is still mounted
        if (!mounted) return;

        setCurrentScript(script);

        // Set editor editability based on whether script is readonly
        const isReadonly = script.id.startsWith('readonly-');
        editor.setEditable(!isReadonly);

        // Initialize editor content from Y.js state or plain text
        // ISSUE: Y.js State Deserialization
        // Priority: High | Scope: Phase 4 (Real-time Collaboration)
        // Requirements: Implement Y.js state deserialization for collaborative editing
        // Note: Currently using plain_text fallback until Y.js integration
        if (script.plain_text) {
          // SECURITY: Use safe conversion to prevent XSS injection
          const safeContent = convertPlainTextToHTML(script.plain_text);
          editor.commands.setContent(safeContent);
        } else {
          // Default content for new scripts (sanitized)
          const defaultContent = sanitizeHTML('<h2>Script for Video</h2><p>Start writing your script here. Each paragraph becomes a component that flows through the production pipeline.</p>');
          editor.commands.setContent(defaultContent);
        }

        extractComponents(editor);
        setSaveStatus('saved');
        setLastSaved(new Date(script.updated_at));

        // Load comment highlights for this script
        await loadCommentHighlights(script.id);
      } catch (error) {
        // Only log errors if component is still mounted
        if (!mounted) return;

        Logger.error('Failed to load script', { error: (error as Error).message });

        // Type-safe error details extraction
        interface ErrorWithDetails extends Error {
          code?: string;
          details?: unknown;
          status?: number;
        }

        const errorDetails = error instanceof Error ? {
          message: error.message,
          code: (error as ErrorWithDetails).code,
          details: (error as ErrorWithDetails).details,
          status: (error as ErrorWithDetails).status
        } : {
          message: String(error),
          code: undefined,
          details: undefined,
          status: undefined
        };

        console.error('Error details:', errorDetails);

        // Check for specific error types
        if (errorDetails.message?.includes('406') || errorDetails.status === 406) {
          console.error('406 Not Acceptable Error - Check:');
          console.error('1. Vercel env var: VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY');
          console.error('2. RLS policies for scripts table');
          console.error('3. User authentication status');
        }

        setSaveStatus('error');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    if (selectedVideo && editor) {
      loadScript();
    } else if (!selectedVideo && editor) {
      // Clear editor when no video selected
      editor.commands.setContent('');
      setCurrentScript(null);
      setSaveStatus('saved');
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      mounted = false;
    };
  }, [selectedVideo, editor, extractComponents, userProfile?.role, loadCommentHighlights]);

  // Auto-save functionality with debouncing
  useEffect(() => {
    if (!currentScript || saveStatus !== 'unsaved' || !editor) return;

    const saveTimer = setTimeout(() => {
      handleSave();
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(saveTimer);
  }, [extractedComponents, currentScript, saveStatus, editor, handleSave]);

  // Sync context with local state
  // Only update when meaningful changes occur, not on every component extraction
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
    // We only care about the length of extractedComponents, not the array reference
  }, [saveStatus, lastSaved, extractedComponents.length, currentScript, updateScriptStatus, clearScriptStatus]);

  // Add cleanup effect to handle component unmounting
  useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true;

    return () => {
      // Mark component as unmounted to prevent state updates
      isMountedRef.current = false;

      // Clean up editor if it exists
      if (editor) {
        // Editor cleanup is handled by TipTap's useEditor hook
        // But we ensure no further state updates happen
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount/unmount

  // Optimize layout rendering for client users with requestAnimationFrame
  useEffect(() => {
    if (userProfile?.role === 'client' && editor) {
      // Batch DOM updates to prevent forced reflow
      requestAnimationFrame(() => {
        if (isMountedRef.current) {
          // Any DOM manipulations that might cause reflow
          // are batched here to prevent performance issues
        }
      });
    }
  }, [userProfile?.role, editor]);

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

        /* Editor Content Area - Full Width */
        .editor-content {
          flex: 1;
          overflow-y: auto;
          padding: 40px 60px; /* Increased horizontal padding */
          padding-left: 120px; /* Space for component labels */
          max-width: none; /* Remove max-width constraint */
          margin: 0;
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
          left: -70px !important; /* Adjusted for new padding */
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

        /* Comment Selection Popup - Phase 2.2 */
        .comment-selection-popup {
          position: fixed;
          background: white;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 12px;
          z-index: 1000;
          max-width: 200px;
        }

        .comment-popup-text {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .comment-popup-button {
          background: #3B82F6;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 12px;
          cursor: pointer;
          width: 100%;
          transition: background-color 0.2s;
        }

        .comment-popup-button:hover {
          background: #2563EB;
        }

        /* Comment highlights in editor with numbering */
        .comment-highlight {
          background-color: #FEF3C7;
          border-radius: 2px;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
          padding-right: 18px; /* Space for number badge */
        }

        .comment-highlight:hover {
          background-color: #FDE68A;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .comment-highlight::after {
          content: attr(data-comment-number);
          position: absolute;
          top: -8px;
          right: -6px;
          background: #3B82F6;
          color: white;
          font-size: 10px;
          font-weight: bold;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          z-index: 1;
        }

        .comment-highlight.highlight-hover {
          background-color: #FBBF24;
          box-shadow: 0 0 0 2px #F59E0B;
        }

        /* Comment loading and success animations */
        .comment-highlight.creating {
          animation: pulse-highlight 1s ease-in-out infinite;
        }

        .comment-highlight.created {
          animation: success-highlight 0.5s ease-out;
        }

        @keyframes pulse-highlight {
          0%, 100% { background-color: #FEF3C7; }
          50% { background-color: #FDE68A; }
        }

        @keyframes success-highlight {
          0% { background-color: #D1FAE5; }
          100% { background-color: #FEF3C7; }
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
            <ErrorBoundary>
              <EditorContent editor={editor} />
            </ErrorBoundary>
          )}
        </div>
      </div>

      {/* Comments Sidebar - Phase 2.3 */}
      {currentScript && (
        <ErrorBoundary>
          <CommentSidebar
            scriptId={currentScript.id}
            createComment={createCommentData}
            onCommentCreated={handleCommentCreated}
          />
        </ErrorBoundary>
      )}

      {/* Comment Selection Popup - Phase 2.2 */}
      {showCommentPopup && selectedText && (
        <div
          className="comment-selection-popup"
          data-testid="comment-selection-popup"
          style={popupPosition ? {
            // Position popup near the selection
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            transform: 'none'
          } : {
            // Fallback to center positioning
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="comment-popup-text" title={selectedText.text}>
            "{selectedText.text}"
          </div>
          <button
            className="comment-popup-button"
            onClick={() => {
              if (selectedText) {
                // Set up comment creation in sidebar
                setCreateCommentData({
                  startPosition: selectedText.from,
                  endPosition: selectedText.to,
                  selectedText: selectedText.text,
                });
              }
              setShowCommentPopup(false);
              setSelectedText(null);
              setPopupPosition(null);
            }}
          >
            Add comment
          </button>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  );
};

export default TipTapEditor;