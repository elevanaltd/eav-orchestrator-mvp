import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from './Header'
import { useAuth } from '../contexts/AuthContext'

// Mock the AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

const mockUseAuth = vi.mocked(useAuth)

describe('Header', () => {
  const mockLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display user email when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    render(<Header />)

    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('should display logout button when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    render(<Header />)

    const logoutButton = screen.getByRole('button', { name: /logout/i })
    expect(logoutButton).toBeInTheDocument()
  })

  it('should call logout function when logout button is clicked', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    render(<Header />)

    const logoutButton = screen.getByRole('button', { name: /logout/i })
    fireEvent.click(logoutButton)

    expect(mockLogout).toHaveBeenCalledOnce()
  })

  it('should have professional styling classes', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    const { container } = render(<Header />)
    const headerElement = container.firstChild as HTMLElement

    expect(headerElement).toHaveClass('app-header')
  })

  it('should display app title', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: '123', email: 'test@example.com' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    render(<Header />)

    expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument()
  })
})