import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App Component', () => {
  it('renders the prototype title', () => {
    render(<App />)
    expect(screen.getByText('EAV Orchestrator Prototype')).toBeInTheDocument()
  })

  it('shows architecture validation subtitle', () => {
    render(<App />)
    expect(screen.getByText('Architecture validation: Paragraph=Component model')).toBeInTheDocument()
  })

  it('renders the TipTap editor component', () => {
    render(<App />)
    // Check for component structure content
    expect(screen.getByText('Component C1')).toBeInTheDocument()
    expect(screen.getByText('Component C2')).toBeInTheDocument()
    expect(screen.getByText('Component C3')).toBeInTheDocument()
  })

  it('displays prototype status information', () => {
    render(<App />)
    expect(screen.getByText('Prototype Status:')).toBeInTheDocument()
    expect(screen.getByText('Basic TipTap editor with component structure')).toBeInTheDocument()
  })
})