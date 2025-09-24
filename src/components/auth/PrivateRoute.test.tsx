import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PrivateRoute } from './PrivateRoute'

const mockUseAuth = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}))

describe('PrivateRoute Component', () => {
  it('should show loading when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true
    })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={
            <PrivateRoute>
              <div>Protected Content</div>
            </PrivateRoute>
          } />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('should render children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '123', email: 'test@example.com' },
      loading: false
    })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={
            <PrivateRoute>
              <div>Protected Content</div>
            </PrivateRoute>
          } />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('should redirect to login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={
            <PrivateRoute>
              <div>Protected Content</div>
            </PrivateRoute>
          } />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('should pass role requirements when user has correct role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '123', email: 'admin@example.com' },
      profile: { role: 'admin' },
      loading: false
    })

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={
            <PrivateRoute requiredRole="admin">
              <div>Admin Content</div>
            </PrivateRoute>
          } />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })

  it('should show unauthorized when user lacks required role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '123', email: 'viewer@example.com' },
      profile: { role: 'viewer' },
      loading: false
    })

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={
            <PrivateRoute requiredRole="admin">
              <div>Admin Content</div>
            </PrivateRoute>
          } />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })
})