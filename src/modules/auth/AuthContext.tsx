import React from 'react'
import { User, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

type AuthContextValue = {
	user: User | null
	loading: boolean
	signInWithGoogle: () => Promise<void>
	signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = React.useState<User | null>(null)
	const [loading, setLoading] = React.useState<boolean>(true)

	React.useEffect(() => {
		return onAuthStateChanged(auth, (u) => {
			setUser(u)
			setLoading(false)
		})
	}, [])

	const signInWithGoogle = React.useCallback(async () => {
		await signInWithPopup(auth, googleProvider)
	}, [])

	const signOut = React.useCallback(async () => {
		await fbSignOut(auth)
	}, [])

	const value: AuthContextValue = { user, loading, signInWithGoogle, signOut }
	return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextValue {
	const ctx = React.useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used within AuthProvider')
	return ctx
}


