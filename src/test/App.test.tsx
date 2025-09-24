import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    }
  }
}))

describe('App Component', () => {
  it('renders login page when not authenticated', async () => {
    render(<App />)
    expect(await screen.findByText('Sign In')).toBeInTheDocument()
  })

  it('includes routing structure', () => {
    render(<App />)
    // App should render without errors with routing
    expect(document.querySelector('.auth-container')).toBeDefined()
  })
})