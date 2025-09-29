import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { ScriptStatusProvider } from './contexts/ScriptStatusContext'

// Critical-Engineer: consulted for Security vulnerability assessment
// Implemented surgical security fixes using npm overrides for esbuild, undici, path-to-regexp
import { Login } from './components/auth/Login'
import { Signup } from './components/auth/Signup'
import { PrivateRoute } from './components/auth/PrivateRoute'
import { Header } from './components/Header'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SmartSuiteTest } from './components/SmartSuiteTest'
import './App.css'

// Lazy load heavy components for better bundle splitting
const NavigationSidebar = lazy(() => import('./components/navigation/NavigationSidebar').then(module => ({ default: module.NavigationSidebar })))
const TipTapEditor = lazy(() => import('./components/TipTapEditor').then(module => ({ default: module.TipTapEditor })))

// Loading component for suspense fallbacks
const ComponentLoader = ({ name }: { name: string }) => (
  <div className="loading-component" style={{ padding: '20px', textAlign: 'center' }}>
    Loading {name}...
  </div>
)

// Critical-Engineer: consulted for Security vulnerability assessment

function MainApp() {
  return (
    <NavigationProvider>
      <ScriptStatusProvider>
        <div className="app-layout">
          <ErrorBoundary>
            <Header />
          </ErrorBoundary>
          <ErrorBoundary>
            <Suspense fallback={<ComponentLoader name="Navigation" />}>
              <NavigationSidebar />
            </Suspense>
          </ErrorBoundary>
          <div className="app-content">
            <ErrorBoundary>
              <SmartSuiteTest />
              <Suspense fallback={<ComponentLoader name="Editor" />}>
                <TipTapEditor />
              </Suspense>
            </ErrorBoundary>
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