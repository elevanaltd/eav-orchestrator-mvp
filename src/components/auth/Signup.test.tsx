import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Signup } from './Signup'
import { BrowserRouter } from 'react-router-dom'

const mockSignUp = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
    loading: false
  })
}))

describe('Signup Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render signup form', () => {
    render(
      <BrowserRouter>
        <Signup />
      </BrowserRouter>
    )

    expect(screen.getByText('Create Account')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
  })

  it('should handle successful signup', async () => {
    mockSignUp.mockResolvedValue({ error: null })
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <Signup />
      </BrowserRouter>
    )

    await user.type(screen.getByPlaceholderText('Full name'), 'John Doe')
    await user.type(screen.getByPlaceholderText('Email address'), 'john@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.type(screen.getByPlaceholderText('Confirm password'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('john@example.com', 'password123', 'John Doe')
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    })
  })

  it('should validate password match', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <Signup />
      </BrowserRouter>
    )

    await user.type(screen.getByPlaceholderText('Full name'), 'John Doe')
    await user.type(screen.getByPlaceholderText('Email address'), 'john@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.type(screen.getByPlaceholderText('Confirm password'), 'different')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
      expect(mockSignUp).not.toHaveBeenCalled()
    })
  })

  it('should validate password length', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <Signup />
      </BrowserRouter>
    )

    await user.type(screen.getByPlaceholderText('Password'), 'short')
    await user.type(screen.getByPlaceholderText('Confirm password'), 'short')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
      expect(mockSignUp).not.toHaveBeenCalled()
    })
  })

  it('should link to login page', () => {
    render(
      <BrowserRouter>
        <Signup />
      </BrowserRouter>
    )

    const loginLink = screen.getByText(/already have an account/i)
    expect(loginLink).toBeInTheDocument()
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login')
  })
})