/**
 * MobileScriptView Component Tests
 *
 * Tests for the mobile graceful degradation component that displays
 * scripts in a read-only format with clear messaging about desktop editing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileScriptView } from './MobileScriptView';

// Mock contexts
vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: vi.fn(() => ({
    selectedVideo: {
      id: 'video-123',
      title: 'Test Video',
      description: 'Test Description'
    }
  }))
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    userProfile: {
      id: 'user-123',
      email: 'test@example.com',
      role: 'admin',
      display_name: 'Test User',
      created_at: '2024-01-01'
    }
  }))
}));

// Mock script service
vi.mock('../services/scriptService', () => ({
  loadScriptForVideo: vi.fn().mockResolvedValue({
    id: 'script-123',
    video_id: 'video-123',
    plain_text: 'This is paragraph one.\n\nThis is paragraph two.',
    components: [
      { number: 1, content: 'This is paragraph one.', wordCount: 4, hash: 'hash1' },
      { number: 2, content: 'This is paragraph two.', wordCount: 4, hash: 'hash2' }
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  })
}));

describe('MobileScriptView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render mobile-friendly script view', () => {
    render(<MobileScriptView />);

    expect(screen.getByText(/Script: Test Video/)).toBeInTheDocument();
    expect(screen.getByText(/Mobile View/)).toBeInTheDocument();
  });

  it('should display desktop editing message', () => {
    render(<MobileScriptView />);

    expect(screen.getByText(/editing requires desktop/i)).toBeInTheDocument();
    expect(screen.getByText(/view script content below/i)).toBeInTheDocument();
  });

  it('should render script content as read-only HTML', () => {
    render(<MobileScriptView />);

    // Should display the script content
    expect(screen.getByText('This is paragraph one.')).toBeInTheDocument();
    expect(screen.getByText('This is paragraph two.')).toBeInTheDocument();
  });

  it('should display component numbers for each paragraph', () => {
    render(<MobileScriptView />);

    // Should show component labels
    expect(screen.getByText('C1')).toBeInTheDocument();
    expect(screen.getByText('C2')).toBeInTheDocument();
  });

  it('should show loading state while fetching script', () => {
    // Mock loading state
    vi.mocked(require('../services/scriptService').loadScriptForVideo).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<MobileScriptView />);

    expect(screen.getByText(/loading script/i)).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should handle no video selected state', () => {
    // Mock no video selected
    vi.mocked(require('../contexts/NavigationContext').useNavigation).mockReturnValue({
      selectedVideo: null
    });

    render(<MobileScriptView />);

    expect(screen.getByText(/no video selected/i)).toBeInTheDocument();
    expect(screen.getByText(/select a video to view its script/i)).toBeInTheDocument();
  });

  it('should handle empty script content gracefully', () => {
    // Mock empty script
    vi.mocked(require('../services/scriptService').loadScriptForVideo).mockResolvedValue({
      id: 'script-123',
      video_id: 'video-123',
      plain_text: '',
      components: [],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    });

    render(<MobileScriptView />);

    expect(screen.getByText(/no script content/i)).toBeInTheDocument();
  });

  it('should render with proper mobile-optimized styling', () => {
    render(<MobileScriptView />);

    const container = screen.getByTestId('mobile-script-view');
    expect(container).toHaveClass('mobile-script-view');
  });

  it('should display script metadata information', () => {
    render(<MobileScriptView />);

    // Should show component count and word count
    expect(screen.getByText(/2 components/i)).toBeInTheDocument();
    expect(screen.getByText(/8 total words/i)).toBeInTheDocument();
  });

  it('should handle script loading errors gracefully', () => {
    // Mock script loading error
    vi.mocked(require('../services/scriptService').loadScriptForVideo).mockRejectedValue(
      new Error('Failed to load script')
    );

    render(<MobileScriptView />);

    expect(screen.getByText(/error loading script/i)).toBeInTheDocument();
    expect(screen.getByText(/please try again/i)).toBeInTheDocument();
  });

  it('should provide clear call-to-action for desktop editing', () => {
    render(<MobileScriptView />);

    expect(screen.getByText(/switch to desktop/i)).toBeInTheDocument();
    expect(screen.getByText(/full editing experience/i)).toBeInTheDocument();
  });
});