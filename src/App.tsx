import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { Login } from './components/auth/Login'
import { Signup } from './components/auth/Signup'
import { PrivateRoute } from './components/auth/PrivateRoute'
import { NavigationSidebar } from './components/navigation/NavigationSidebar'
import { TipTapEditor } from './components/TipTapEditor'
import { TestRLS } from './components/TestRLS'
import { TestDataPanel } from './components/TestDataPanel'
import { NavigationTest } from './components/NavigationTest'
import { SmartSuiteSyncPanel } from './components/SmartSuiteSyncPanel'
import './App.css'

function MainApp() {
  return (
    <NavigationProvider>
      <div className="app-layout">
        <NavigationSidebar />
        <div className="app-content">
          <NavigationTest />
          <TestRLS />
          <SmartSuiteSyncPanel />
          <TipTapEditor />
          <TestDataPanel />
        </div>
      </div>
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