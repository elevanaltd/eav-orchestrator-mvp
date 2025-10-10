/**
 * SIMPLIFIED POC: Paragraph-Based Component System with Navigation Integration
 *
 * Each paragraph is automatically a component
 * Integrates with NavigationContext to load/save scripts for selected videos
 * Clean copy/paste with visual indicators only
 *
 * Critical-Engineer: consulted for Architecture pattern selection (Hybrid Refactor)
 * Verdict: Extract permission logic into usePermissions hook, apply UX fixes to clean architecture
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import { CommentHighlightExtension } from './extensions/CommentHighlightExtension';
import { CommentPositionTracker } from './extensions/CommentPositionTracker';
import { HeaderPatternExtension } from './extensions/HeaderPatternExtension';
import { ParagraphComponentTracker } from '../features/editor/extensions/ParagraphComponentTracker';
import { CommentSidebar } from './comments/CommentSidebar';
import { useCommentPositionSync } from '../hooks/useCommentPositionSync';
import { supabase } from '../lib/supabase';
import { ToastContainer } from './ui/Toast';
import { useToast } from './ui/useToast';
import { ErrorBoundary } from './ErrorBoundary';
import { useScriptStatus } from '../contexts/ScriptStatusContext';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useCurrentScript } from '../core/state/useCurrentScript';
import { useScriptComments } from '../core/state/useScriptComments';
import { loadScriptForVideo, ComponentData, ScriptWorkflowStatus, generateContentHash } from '../services/scriptService';
import { Logger } from '../services/logger';
import { extractComponents as extractComponentsFromDoc, isComponentParagraph } from '../lib/componentExtraction';
import { sanitizeHTML, handlePlainTextPaste, convertPlainTextToHTML } from '../lib/editor/sanitizeUtils';

// Critical-Engineer: consulted for Security vulnerability assessment

export const TipTapEditor: React.FC = () => {
  // Hook-based state management via useCurrentScript
  const {
    currentScript,
    selectedVideo,
    save,
    updateStatus,
    saveStatus,
    setSaveStatus,
    lastSaved: hookLastSaved, // Keep for useMemo conversion to Date
    isLoading
  } = useCurrentScript();

  const { updateScriptStatus, clearScriptStatus } = useScriptStatus();
  const { userProfile } = useAuth();
  const permissions = usePermissions();
  const { toasts, showSuccess, showError } = useToast();

  // Convert lastSaved from string (hook) to Date (component usage)
  const lastSaved = useMemo(
    () => (hookLastSaved ? new Date(hookLastSaved) : null),
    [hookLastSaved]
  );

  // Component extraction state
  const [extractedComponents, setExtractedComponents] = useState<ComponentData[]>([]);

  // Track component mount state to prevent updates after unmount
  const isMountedRef = useRef(true);

  // Declare callback functions that don't depend on editor
  const extractComponents = useCallback((editor: Editor) => {
    // Only update state if component is still mounted
    if (!isMountedRef.current) return;

    const components = extractComponentsFromDoc(
      editor.state.doc,
      generateContentHash
    );

    setExtractedComponents(components);
  }, []);

  // Position sync hook for comment tracking (Scenario 3)
  const { debouncedUpdate } = useCommentPositionSync({
    onUpdate: async (highlights) => {
      // Sync updated positions to database
      Logger.info('Position update triggered', {
        commentCount: highlights.length,
        positions: highlights.map(h => ({
          id: h.commentId,
          from: h.startPosition,
          to: h.endPosition
        }))
      });

      for (const highlight of highlights) {
        try {
          const { error } = await supabase
            .from('comments')
            .update({
              start_position: highlight.startPosition,
              end_position: highlight.endPosition
            })
            .eq('id', highlight.commentId);

          if (error) {
            Logger.error('Failed to update comment position', {
              commentId: highlight.commentId,
              error: error.message
            });
          }
        } catch (error) {
          Logger.error('Exception updating comment position', {
            commentId: highlight.commentId,
            error: (error as Error).message
          });
        }
      }
    },
    debounceMs: 500
  });

  // Create editor first
  // Editor editability controlled by permissions (clients are read-only)
  const editor = useEditor({
    editable: permissions.canEditScript,
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: 'component-paragraph'
          }
        }
      }),
      ParagraphComponentTracker,
      HeaderPatternExtension,
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
      }),
      // Position tracker for dynamic comment position updates (Scenario 3)
      CommentPositionTracker.configure({
        onPositionUpdate: debouncedUpdate
      })
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // Check if mounted before updating state
      if (!isMountedRef.current) return;

      extractComponents(editor);

      // Set save status to 'unsaved' when content changes
      // Only called when user can actually edit/save scripts
      if (permissions.canEditScript) {
        setSaveStatus('unsaved');
      }
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
    // Critical-Engineer: consulted for Paste handler architecture and sanitization
    editorProps: {
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) {
          return false; // Let TipTap handle it
        }

        const htmlData = clipboardData.getData('text/html');
        const textData = clipboardData.getData('text/plain');

        // Only process if HTML data is present
        if (htmlData) {
          event.preventDefault(); // Take control of the paste event

          // 1. Size Check to prevent UI freeze
          const PASTE_SIZE_LIMIT_BYTES = 1 * 1024 * 1024; // 1MB limit
          if (htmlData.length > PASTE_SIZE_LIMIT_BYTES) {
            showError('Pasted content is too large. Please paste in smaller chunks.');
            view.dispatch(view.state.tr.insertText(textData.substring(0, 5000) + "..."));
            return true;
          }

          try {
            // 2. Sanitize the HTML
            const sanitizedHTML = sanitizeHTML(htmlData);

            // 3. Remove empty paragraphs and standalone line breaks
            // Google Docs includes <p>&nbsp;</p> paragraphs and standalone <br> elements for spacing
            // Critical-Engineer: consulted for paste handler whitespace normalization
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = sanitizedHTML;

            // Filter out paragraphs that only contain whitespace (including &nbsp;)
            const paragraphs = tempDiv.querySelectorAll('p');
            paragraphs.forEach((p) => {
              // Normalize whitespace: convert &nbsp; (\u00A0) to regular space, then trim
              const normalizedText = p.textContent?.replace(/\u00A0/g, ' ').trim() || '';
              if (normalizedText.length === 0) {
                p.remove(); // Remove empty paragraphs
              }
            });

            // Also remove standalone <br> elements that appear between paragraphs
            // Google Docs sometimes inserts these for spacing between sections
            const brs = tempDiv.querySelectorAll('br');
            brs.forEach((br) => {
              br.remove();
            });

            // 4. Use sanitized content if it's not empty after filtering
            if (tempDiv.innerHTML.trim()) {

              // Use ProseMirror's DOMParser to convert HTML to document nodes
              const { state } = view;
              const parser = ProseMirrorDOMParser.fromSchema(state.schema);

              // Parse the DOM content into ProseMirror slice
              const slice = parser.parseSlice(tempDiv, {
                preserveWhitespace: 'full'
              });

              // Insert the parsed content at the current selection
              view.dispatch(state.tr.replaceSelection(slice));
            } else if (textData) {
              // Fallback to plain text if sanitization results in nothing
              // Use centralized handler (4. Code deduplication fix)
              handlePlainTextPaste(view, textData, showError);
            }
          } catch (error) {
            Logger.error('Paste sanitization failed', { error });
            showError('Could not process pasted content.');
            // Safest fallback in case of error
            // Use same centralized handler (4. Code deduplication fix)
            if (textData) {
              handlePlainTextPaste(view, textData, showError);
            }
          }

          return true; // We've handled the event
        }

        // Let TipTap handle non-HTML pastes
        return false;
      }
    }
  });

  // Step 2.1.4: Extract ALL comment system logic to useScriptComments hook
  const {
    setCommentHighlights,
    selectedText,
    setSelectedText,
    showCommentPopup,
    setShowCommentPopup,
    popupPosition,
    setPopupPosition,
    createCommentData,
    setCreateCommentData,
    loadCommentHighlights,
  } = useScriptComments(editor);

  // REMOVED: loadCommentHighlights function (now in useScriptComments hook)
  // REMOVED: selectionUpdate useEffect (now in useScriptComments hook)
  // REMOVED: blur handler useEffect (now in useScriptComments hook)
  // REMOVED: Comment UI state (now in useScriptComments hook)

  // Now define callbacks that depend on editor

  const handleSave = useCallback(async () => {
    if (!currentScript || !editor) return;

    // Don't save readonly placeholder scripts
    if (currentScript.id.startsWith('readonly-')) {
      return;
    }

    // DEFENSE IN DEPTH: Additional permission check (should never trigger due to onUpdate guard)
    // Primary protection: onUpdate only sets 'unsaved' status for users with canEditScript
    // This guard ensures handleSave never executes for clients even if called directly
    if (!permissions.canEditScript) {
      return;
    }

    try {
      const plainText = editor.getText();
      // ISSUE: Y.js Collaborative Editing Integration
      // Priority: High | Scope: Phase 4 (Real-time Collaboration)
      // Requirements: Implement Y.js serialization for collaborative state sync
      // Dependencies: Y.js library, WebSocket infrastructure, conflict resolution
      const yjsState = null; // Placeholder until Y.js integration in Phase 4

      // Hook's save method manages saveStatus ('saving' → 'saved'/'error') via TanStack Query mutation
      await save(yjsState, plainText, extractedComponents);

      // After save completes, recover comment positions
      // This ensures highlights are updated after document changes are persisted
      if (isMountedRef.current) {
        Logger.info('Auto-save complete: Recovering comment positions', {
          scriptId: currentScript.id,
          trigger: 'save'
        });
        loadCommentHighlights(currentScript.id);
      }
    } catch (error) {
      if (isMountedRef.current) {
        Logger.error('Failed to save script', { error: (error as Error).message });
        // Hook automatically sets saveStatus('error') via TanStack Query onError
      }
    }
  }, [currentScript, editor, extractedComponents, loadCommentHighlights, permissions.canEditScript, save]);

  // Handle comment creation from sidebar
  const handleCommentCreated = useCallback(async () => {
    try {
      // Clear creation state to hide form
      setCreateCommentData(null);
      // Clear selection state now that comment is created
      setSelectedText(null);
      setPopupPosition(null);

      // Reload highlights from database to show newly created comment with correct ID
      if (currentScript) {
        await loadCommentHighlights(currentScript.id);
      }

      showSuccess('Comment created successfully!');

    } catch (error) {
      Logger.error('Failed to reload comment highlights', { error: (error as Error).message });
      showError('Failed to update comment highlights');
    }
  }, [currentScript, loadCommentHighlights, setCreateCommentData, setSelectedText, setPopupPosition, showSuccess, showError]);

  // Handle comment form cancellation
  const handleCommentCancelled = useCallback(() => {
    // Clear creation state to hide form
    setCreateCommentData(null);
    // Clear selection state
    setSelectedText(null);
    setPopupPosition(null);
  }, [setCreateCommentData, setSelectedText, setPopupPosition]);

  // Handle script status changes (GREEN phase implementation)
  const handleStatusChange = useCallback(async (newStatus: ScriptWorkflowStatus) => {
    if (!currentScript) return;

    try {
      // Hook handles optimistic UI updates and rollback internally via TanStack Query
      await updateStatus(newStatus);

      showSuccess(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      // Hook automatically rolls back on error via TanStack Query
      Logger.error('Failed to update script status', { error: (error as Error).message });
      showError('Failed to update status');
    }
  }, [currentScript, updateStatus, showSuccess, showError]);

  // Load script when selected video changes
  useEffect(() => {
    let mounted = true;

    const loadScript = async () => {
      if (!selectedVideo || !editor) return;

      // Note: isLoading managed by useCurrentScript hook via TanStack Query
      try {
        // Loading script for video
        const script = await loadScriptForVideo(selectedVideo.id, userProfile?.role);

        // Only update state if component is still mounted
        if (!mounted) return;

        // Note: currentScript managed by useCurrentScript hook via TanStack Query

        // Initialize editor content from Y.js state or plain text
        // Note: Editor editability is controlled by usePermissions hook at initialization
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
        // Note: saveStatus and lastSaved managed by useCurrentScript hook

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

        // Note: saveStatus('error') managed by useCurrentScript hook
      }
    };

    if (selectedVideo && editor) {
      loadScript();
    } else if (!selectedVideo && editor) {
      // Clear editor when no video selected
      editor.commands.setContent('');
      // Note: currentScript and saveStatus managed by useCurrentScript hook
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

  // Update editor editability when permissions change
  // Per Vercel Bot PR#56 review: Editor editability only set at initialization
  // Fix: Reactively update when permissions.canEditScript changes during session
  useEffect(() => {
    if (editor) {
      editor.setEditable(permissions.canEditScript);
    }
  }, [editor, permissions.canEditScript]);

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
          /* Priority 4: Sticky header - stays visible while content scrolls */
          position: sticky;
          top: 0;
          z-index: 10;
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
          display: inline;
          transition: all 0.2s ease;
        }

        .comment-highlight:hover {
          background-color: #FDE68A;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .comment-highlight::after {
          content: attr(data-comment-number);
          position: absolute;
          top: -8px;
          left: -20px;
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
          pointer-events: none;
          z-index: 10;
        }

        .comment-highlight.highlight-hover {
          background-color: #FBBF24;
          box-shadow: 0 0 0 2px #F59E0B;
        }

        /* Priority 3: Resolved comments - pale green background with grey numbers */
        .comment-highlight.comment-resolved {
          background-color: #DCFCE7; /* Resolved: pale green background */
        }

        .comment-highlight.comment-resolved::after {
          background: #9CA3AF; /* Resolved: grey number badge */
        }

        .comment-highlight.comment-resolved:hover {
          background-color: #BBF7D0; /* Slightly darker green on hover */
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
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
              {/* GREEN Phase: Workflow Status Selector - Admin/Employee Only */}
              {currentScript && permissions.canChangeWorkflowStatus && (
                <div style={{ marginTop: '12px' }}>
                  <label htmlFor="workflow-status" style={{ fontSize: '14px', fontWeight: '500', marginRight: '8px' }}>
                    Workflow Status:
                  </label>
                  <select
                    id="workflow-status"
                    value={currentScript.status || 'draft'}
                    onChange={(e) => handleStatusChange(e.target.value as ScriptWorkflowStatus)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="draft">Draft</option>
                    <option value="in_review">In Review</option>
                    <option value="rework">Rework</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              )}
            </div>
          </div>
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
      {/* FIX (ADR-005 ADDENDUM 2): Removed documentContent prop from CommentSidebar */}
      {currentScript && editor && (
        <ErrorBoundary>
          <CommentSidebar
            scriptId={currentScript.id}
            createComment={createCommentData}
            onCommentCreated={handleCommentCreated}
            onCommentCancelled={handleCommentCancelled}
            onCommentDeleted={(commentId) => {
              // Remove highlight from local state
              setCommentHighlights(prev =>
                prev.filter(h => h.commentId !== commentId)
              );

              // Remove highlight from editor using existing command
              if (editor) {
                editor.commands.removeCommentHighlight(commentId);
              }

              Logger.info('Comment highlight removed', { commentId });
            }}
          />
        </ErrorBoundary>
      )}

      {/* Comment Selection Popup - Phase 2.2 */}
      {showCommentPopup && selectedText && currentScript && !currentScript.id.startsWith('readonly-') && (
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
            onMouseDown={(e) => {
              // Prevent popup click from clearing editor selection
              e.preventDefault();
            }}
            onClick={() => {
              if (selectedText) {
                // Set up comment creation in sidebar
                setCreateCommentData({
                  startPosition: selectedText.from,
                  endPosition: selectedText.to,
                  selectedText: selectedText.text,
                });
                // Hide popup but keep selection data available for visual reference
                setShowCommentPopup(false);
                // Don't clear selectedText yet - keep it for visual feedback
                // It will be cleared when comment is created or form is cancelled
              }
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