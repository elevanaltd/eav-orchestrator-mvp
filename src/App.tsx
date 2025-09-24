import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Login } from './components/auth/Login'
import { Signup } from './components/auth/Signup'
import { PrivateRoute } from './components/auth/PrivateRoute'
import { TipTapEditor } from './components/TipTapEditor'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={
            <PrivateRoute>
              <div className="App">
                <TipTapEditor />
              </div>
            </PrivateRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App