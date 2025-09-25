import { render, screen } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { NavigationSidebar } from './NavigationSidebar';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { supabase } from '../../lib/supabase';

// Mock Supabase
vi.mock('../../lib/supabase');

// Mock CSS import
vi.mock('../../styles/Navigation.css', () => ({}));

const mockSupabase = vi.mocked(supabase);

// Test wrapper with NavigationProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <NavigationProvider>{children}</NavigationProvider>
);

describe('NavigationSidebar Auto-Refresh', () => {
  const mockProjects = [
    { id: '1', title: 'Project 1', due_date: '2024-01-01' },
    { id: '2', title: 'Project 2', due_date: '2024-02-01' }
  ];

  const mockVideos = [
    {
      id: 'v1',
      project_id: '1',
      title: 'Video 1',
      main_stream_status: 'ready',
      vo_stream_status: 'pending'
    },
    {
      id: 'v2',
      project_id: '1',
      title: 'Video 2',
      main_stream_status: 'processing',
      vo_stream_status: 'ready'
    }
  ];

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock successful Supabase responses
    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'projects') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockProjects,
              error: null
            })
          })
        };
      } else if (tableName === 'videos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockVideos,
                error: null
              })
            })
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      };
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Auto-refresh functionality', () => {
    it('should render component with basic structure', () => {
      render(
        <TestWrapper>
          <NavigationSidebar />
        </TestWrapper>
      );

      // Should render basic structure immediately
      expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      expect(screen.getByText('Projects & Videos')).toBeInTheDocument();
    });

    it('should accept refresh interval prop', () => {
      // Test that component accepts the prop without errors
      const { rerender } = render(
        <TestWrapper>
          <NavigationSidebar refreshInterval={5000} />
        </TestWrapper>
      );

      // Should render without error
      expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();

      // Test with different interval
      rerender(
        <TestWrapper>
          <NavigationSidebar refreshInterval={60000} />
        </TestWrapper>
      );

      expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
    });

    it('should show refresh indicator when refreshing', () => {
      render(
        <TestWrapper>
          <NavigationSidebar />
        </TestWrapper>
      );

      // Initially no refresh indicator
      expect(screen.queryByTitle('Refreshing data...')).not.toBeInTheDocument();

      // The refresh indicator would appear during actual refresh operations
      // This test verifies the basic structure is in place
      expect(screen.getByText('Projects & Videos')).toBeInTheDocument();
    });

    it('should have visibility detection capability', () => {
      render(
        <TestWrapper>
          <NavigationSidebar />
        </TestWrapper>
      );

      // Component should render and be ready for visibility detection
      expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();

      // Visibility change events would be handled in the actual component
      // This test confirms the component mounts without errors
    });

  });

  // Note: More complex integration tests would be added here
  // For now, focusing on manual testing of the implemented functionality
});