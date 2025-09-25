import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import '../styles/Header.css'

export function Header() {
  const { currentUser, logout } = useAuth()

  const handleLogout = () => {
    logout()
  }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">EAV Orchestrator</h1>
        </div>
        <div className="header-right">
          {currentUser && (
            <div className="user-controls">
              <span className="user-email">{currentUser.email}</span>
              <button
                className="logout-button"
                onClick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}