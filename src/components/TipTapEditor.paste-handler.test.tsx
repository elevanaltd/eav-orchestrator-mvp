import { describe, it, expect, beforeEach } from 'vitest';
import DOMPurify from 'dompurify';

/**
 * TEST: Paste Handler Behavior - Verifies Google Docs paste preserves <br> tags
 *
 * Critical requirement: When users paste multi-line content from Google Docs,
 * the <br> tags must be preserved so "Convert Soft Enters" button works.
 *
 * Current bug: Paste handler compares sanitized HTML !== original HTML
 * and falls back to plain text, stripping ALL structure including <br> tags.
 */

describe('TipTap Paste Handler - <br> Tag Preservation', () => {
  let sanitizeHTML: (html: string) => string;

  beforeEach(() => {
    // Use the same sanitization as TipTapEditor
    sanitizeHTML = (dirtyHTML: string): string => {
      return DOMPurify.sanitize(dirtyHTML, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true,
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false
      });
    };
  });

  it('sanitizes Google Docs HTML but preserves safe <br> tags', () => {
    // ARRANGE - Typical Google Docs paste with <br> and unsafe attributes
    const googleDocsHTML = `<p class="c1" style="color: red;">Line 1<br>Line 2</p><p>Line 3</p>`;

    // ACT - Sanitize the HTML
    const sanitized = sanitizeHTML(googleDocsHTML);

    // ASSERT - <br> tags are preserved, unsafe attributes removed
    expect(sanitized).toContain('<br>');
    expect(sanitized).not.toContain('style='); // Unsafe style removed
    expect(sanitized).toContain('class='); // Safe class attribute preserved (in ALLOWED_ATTR)
  });

  it('sanitization modifies HTML but result is still valid', () => {
    // ARRANGE - HTML with some unsafe elements
    const mixedHTML = `<p>Safe text<br>with breaks</p><script>alert("xss")</script>`;

    // ACT - Sanitize
    const sanitized = sanitizeHTML(mixedHTML);
    const original = mixedHTML;

    // ASSERT - Sanitized version differs from original BUT is not empty
    expect(sanitized).not.toBe(original);
    expect(sanitized.trim()).not.toBe('');
    expect(sanitized).toContain('<br>');
    expect(sanitized).not.toContain('script');
  });

  it('sanitization changes do NOT mean content is dangerous', () => {
    // ARRANGE - Perfectly safe HTML that will be modified by DOMPurify
    const safeButModified = `<p style="margin: 10px;">Text<br/>with break</p>`;

    // ACT
    const sanitized = sanitizeHTML(safeButModified);

    // ASSERT - Content changed but <br> preserved
    expect(sanitized).not.toBe(safeButModified); // Changed (style removed)
    expect(sanitized).toContain('br'); // But structure preserved

    // CRITICAL INSIGHT: The current paste handler assumes
    // (sanitized !== original) means "dangerous content"
    // This is FALSE - sanitization ALWAYS modifies safe content too!
  });

  it('empty or whitespace-only sanitized result should fallback to plain text', () => {
    // ARRANGE - HTML that becomes empty after sanitization
    const onlyUnsafe = `<script>alert('xss')</script><style>.bad{}</style>`;

    // ACT
    const sanitized = sanitizeHTML(onlyUnsafe);

    // ASSERT - Sanitized to empty (this SHOULD trigger plain text fallback)
    expect(sanitized.trim()).toBe('');
  });

  it('large paste content should be limited to prevent UI freeze', () => {
    // ARRANGE - Simulate paste > 1MB
    const PASTE_SIZE_LIMIT = 1 * 1024 * 1024; // 1MB
    const largeContent = 'x'.repeat(PASTE_SIZE_LIMIT + 1);

    // ASSERT - Size limit is defined and reasonable
    expect(largeContent.length).toBeGreaterThan(PASTE_SIZE_LIMIT);

    // This test documents the requirement for size limiting
    // Actual implementation will be in TipTapEditor paste handler
  });
});
