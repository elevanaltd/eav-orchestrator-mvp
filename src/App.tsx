import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Login } from './components/auth/Login'
import { Signup } from './components/auth/Signup'
import { PrivateRoute } from './components/auth/PrivateRoute'
import { TipTapEditor } from './components/TipTapEditor'
import { TestRLS } from './components/TestRLS'
import { TestDataPanel } from './components/TestDataPanel'
import './App.css'

function MainApp() {
  return (
    <div className="App">
      <TestRLS />
      <TipTapEditor />
      <TestDataPanel />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainApp />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App