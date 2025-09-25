import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { ScriptStatusProvider } from './contexts/ScriptStatusContext'
import { Login } from './components/auth/Login'
import { Signup } from './components/auth/Signup'
import { PrivateRoute } from './components/auth/PrivateRoute'
import { Header } from './components/Header'
import { NavigationSidebar } from './components/navigation/NavigationSidebar'
import { TipTapEditor } from './components/TipTapEditor'
import './App.css'

function MainApp() {
  return (
    <NavigationProvider>
      <ScriptStatusProvider>
        <div className="app-layout">
          <Header />
          <NavigationSidebar />
          <div className="app-content">
            <TipTapEditor />
          </div>
        </div>
      </ScriptStatusProvider>
    </NavigationProvider>
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