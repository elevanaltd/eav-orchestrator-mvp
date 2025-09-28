import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface PrivateRouteProps {
  children: React.ReactNode
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { currentUser, loading } = useAuth()

  console.log('[PrivateRoute] Render state:', {
    loading,
    hasUser: !!currentUser,
    userId: currentUser?.id
  })

  if (loading) {
    console.log('[PrivateRoute] Still loading, showing spinner...')
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    )
  }

  if (!currentUser) {
    console.log('[PrivateRoute] No user, redirecting to login...')
    return <Navigate to="/login" replace />
  }

  console.log('[PrivateRoute] User authenticated, rendering children')
  return <>{children}</>
}