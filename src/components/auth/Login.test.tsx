import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Login } from './Login'
import { BrowserRouter } from 'react-router-dom'

const mockSignIn = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    loading: false
  })
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render login form', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('should handle successful login', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )

    const emailInput = screen.getByPlaceholderText('Email address')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('should display error on failed login', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } })
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )

    const emailInput = screen.getByPlaceholderText('Email address')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )

    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)

    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('should link to signup page', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )

    const signupLink = screen.getByText(/don't have an account/i)
    expect(signupLink).toBeInTheDocument()
    expect(signupLink.closest('a')).toHaveAttribute('href', '/signup')
  })
})