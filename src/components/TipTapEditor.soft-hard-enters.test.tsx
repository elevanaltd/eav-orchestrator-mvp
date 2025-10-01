import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TipTapEditor } from './TipTapEditor';
import { NavigationProvider } from '../contexts/NavigationContext';
import { ScriptStatusProvider } from '../contexts/ScriptStatusContext';

// Mock the auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    currentUser: { id: 'user-123', email: 'test@example.com' },
    userProfile: { id: 'user-123', email: 'test@example.com', role: 'admin', display_name: 'Test User', created_at: '2024-01-01' },
    signIn: vi.fn(),
    signUp: vi.fn(),
    logout: vi.fn(),
    loading: false
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock the script service
vi.mock('../services/scriptService', () => ({
  loadScriptForVideo: vi.fn().mockResolvedValue({
    id: 'script-123',
    video_id: 'video-123',
    content: '<p>Test content with<br>soft enters</p>',
    components: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }),
  saveScript: vi.fn().mockResolvedValue({
    id: 'script-123',
    video_id: 'video-123',
    content: '<p>Updated content</p>',
    components: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  })
}));

// Mock TipTap editor
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn().mockReturnValue({
    commands: {
      setContent: vi.fn(),
      selectAll: vi.fn(),
      setTextSelection: vi.fn()
    },
    state: {
      doc: {
        forEach: vi.fn()
      }
    },
    getHTML: vi.fn().mockReturnValue('<p>Mock content</p>'),
    on: vi.fn(),
    off: vi.fn()
  }),
  EditorContent: vi.fn(() => <div data-testid="editor-content">Editor Content</div>)
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: vi.fn()
  }
}));

describe('Soft-to-Hard Enters Conversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('converts <br> tags to paragraph breaks while preserving components and comments', async () => {
    // ARRANGE - Initial state with soft enters
    // Simulates pasted content from Word/Google Docs with <br> tags
    // NOTE: This test will FAIL because the button doesn't exist yet (proper RED phase)

    render(
      <NavigationProvider>
        <ScriptStatusProvider>
          <TipTapEditor />
        </ScriptStatusProvider>
      </NavigationProvider>
    );

    // ACT - User clicks "Convert Soft Enters" button in script header
    // This will FAIL because button doesn't exist yet (proper RED phase)
    const convertButton = screen.getByRole('button', { name: /convert soft enters/i });
    convertButton.click();

    // ASSERT - Complete behavioral contract

    // 1. Structural Integrity - <br> → <p> conversion
    // Expected transformation:
    // FROM: <p>C1 Line 1<br>C1 Line 2</p><p>C2 Line 1</p>
    // TO:   <p>C1 Line 1</p><p>C1 Line 2</p><p>C2 Line 1</p>
    const editor = document.querySelector('.ProseMirror');
    expect(editor).toBeTruthy();

    // Verify no <br> tags remain in content
    const editorHtml = editor?.innerHTML || '';
    expect(editorHtml).not.toContain('<br');

    // Verify paragraph count increased (1 <br> → 2 <p> elements)
    const paragraphs = editor?.querySelectorAll('p') || [];
    expect(paragraphs.length).toBeGreaterThan(2); // Was 2, should be 3+ after conversion

    // 2. Component Extraction Integrity - Still produces C1, C2, C3
    // Server-side extraction should still identify components correctly
    // This verifies the paragraph=component model integrity
    const firstParagraph = paragraphs[0];
    const secondParagraph = paragraphs[1];
    expect(firstParagraph?.textContent).toContain('C1 Line 1');
    expect(secondParagraph?.textContent).toContain('C1 Line 2');

    // 3. Comment Position Integrity - Comment follows its content
    // Comments are positioned by character offset - verify they still map correctly
    // After conversion, comment on "C1 Line 2" should still reference correct position
    // NOTE: This assertion is placeholder - actual comment rendering logic may vary
    const commentMarkers = document.querySelectorAll('[data-comment-id]');
    expect(commentMarkers.length).toBeGreaterThan(0); // Comment marker should still exist
  });

  it('handles content with no soft enters without modification', () => {
    // ARRANGE - Content already properly formatted (no <br> tags)
    render(
      <NavigationProvider>
        <ScriptStatusProvider>
          <TipTapEditor />
        </ScriptStatusProvider>
      </NavigationProvider>
    );

    // ACT - User clicks convert button
    const convertButton = screen.getByRole('button', { name: /convert soft enters/i });
    convertButton.click();

    // ASSERT - Content unchanged (idempotent operation)
    const editor = document.querySelector('.ProseMirror');
    const paragraphs = editor?.querySelectorAll('p') || [];
    expect(paragraphs.length).toBe(2); // Should remain 2 paragraphs
    expect(paragraphs[0]?.textContent).toContain('C1 Line 1');
    expect(paragraphs[1]?.textContent).toContain('C2 Line 1');
  });

  it('handles multiple consecutive <br> tags correctly', () => {
    // ARRANGE - Complex case with multiple soft enters
    render(
      <NavigationProvider>
        <ScriptStatusProvider>
          <TipTapEditor />
        </ScriptStatusProvider>
      </NavigationProvider>
    );

    // ACT
    const convertButton = screen.getByRole('button', { name: /convert soft enters/i });
    convertButton.click();

    // ASSERT - Each line becomes separate paragraph
    const editor = document.querySelector('.ProseMirror');
    const editorHtml = editor?.innerHTML || '';
    expect(editorHtml).not.toContain('<br'); // All <br> tags removed

    const paragraphs = editor?.querySelectorAll('p') || [];
    expect(paragraphs.length).toBeGreaterThanOrEqual(3); // At least 3 paragraphs

    // Verify content preserved
    const allText = Array.from(paragraphs).map(p => p.textContent).join(' ');
    expect(allText).toContain('C1 Line 1');
    expect(allText).toContain('C1 Line 2');
    expect(allText).toContain('C1 Line 3');
  });
});
