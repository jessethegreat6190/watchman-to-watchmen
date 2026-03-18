import { createContext, useContext, useState, useEffect } from 'react'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth, ADMIN_UID } from '../firebase/config'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!auth) {
      console.warn('Firebase auth not initialized')
      setLoading(false)
      return
    }
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setIsAdmin(user?.uid === ADMIN_UID)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = (email, password) => {
    if (!auth) throw new Error('Auth not initialized')
    return signInWithEmailAndPassword(auth, email, password)
  }

  const signup = (email, password) => {
    if (!auth) throw new Error('Auth not initialized')
    return createUserWithEmailAndPassword(auth, email, password)
  }

  const loginWithGoogle = () => {
    if (!auth) throw new Error('Auth not initialized')
    const provider = new GoogleAuthProvider()
    return signInWithPopup(auth, provider)
  }

  const loginWithGitHub = () => {
    if (!auth) throw new Error('Auth not initialized')
    const provider = new GithubAuthProvider()
    return signInWithPopup(auth, provider)
  }

  const logout = () => {
    if (!auth) throw new Error('Auth not initialized')
    return signOut(auth)
  }

  const value = {
    user,
    isAdmin,
    loading,
    login,
    signup,
    loginWithGoogle,
    loginWithGitHub,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
