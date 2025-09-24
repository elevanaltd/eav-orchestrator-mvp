import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface PrivateRouteProps {
  children: React.ReactNode
  requiredRole?: string
}

export function PrivateRoute({ children, requiredRole }: PrivateRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return (
      <div className="unauthorized-container">
        <h1>Unauthorized</h1>
        <p>You are not authorized to view this page.</p>
        <a href="/">Return to Home</a>
      </div>
    )
  }

  return <>{children}</>
}