import React from 'react'
import { User, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { getUserProfile, createUserProfile } from '../../data/firestore'
import { User as UserProfile, Team } from '../../domain/models'

type AuthContextValue = {
	user: User | null
	userProfile: (UserProfile & { id: string }) | null
	team: (Team & { id: string }) | null
	loading: boolean
	needsOnboarding: boolean
	signInWithGoogle: () => Promise<void>
	signOut: () => Promise<void>
	refreshUserProfile: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = React.useState<User | null>(null)
	const [userProfile, setUserProfile] = React.useState<(UserProfile & { id: string }) | null>(null)
	const [team, setTeam] = React.useState<(Team & { id: string }) | null>(null)
	const [loading, setLoading] = React.useState<boolean>(true)
	const [needsOnboarding, setNeedsOnboarding] = React.useState<boolean>(false)

	const refreshUserProfile = React.useCallback(async () => {
		if (!user) {
			setUserProfile(null)
			setTeam(null)
			setNeedsOnboarding(false)
			return
		}

		try {
			let profile = await getUserProfile(user.uid)
			
			// If no profile exists, create one automatically (for invitations to work)
			if (!profile) {
				console.log('Creating user profile for first-time user:', user.email)
				await createUserProfile() // No team initially
				profile = await getUserProfile(user.uid)
			}
			
			setUserProfile(profile)
			
			if (!profile || !profile.teamId) {
				// User doesn't have a team yet, needs onboarding
				setNeedsOnboarding(true)
				setTeam(null)
			} else {
				// User has a team, fetch team details
				setNeedsOnboarding(false)
				// For now, we'll set a placeholder team - we'll fetch the actual team data later
				// This prevents breaking existing functionality during the transition
				setTeam({
					id: profile.teamId!,
					name: profile.teamName || '',
					ownerUid: '',
					members: [],
					createdAt: null,
					updatedAt: null
				})
			}
		} catch (error) {
			console.error('Error fetching user profile:', error)
			setNeedsOnboarding(true)
			setUserProfile(null)
			setTeam(null)
		}
	}, [user])

	React.useEffect(() => {
		return onAuthStateChanged(auth, async (u) => {
			setUser(u)
			if (u) {
				// User is signed in, fetch their profile and team info
				await refreshUserProfile()
			} else {
				// User is signed out
				setUserProfile(null)
				setTeam(null)
				setNeedsOnboarding(false)
			}
			setLoading(false)
		})
	}, [refreshUserProfile])

	// Refresh user profile when user changes
	React.useEffect(() => {
		if (user) {
			refreshUserProfile()
		}
	}, [user, refreshUserProfile])

	const signInWithGoogle = React.useCallback(async () => {
		await signInWithPopup(auth, googleProvider)
	}, [])

	const signOut = React.useCallback(async () => {
		await fbSignOut(auth)
		setUserProfile(null)
		setTeam(null)
		setNeedsOnboarding(false)
	}, [])

	const value: AuthContextValue = { 
		user, 
		userProfile, 
		team, 
		loading, 
		needsOnboarding, 
		signInWithGoogle, 
		signOut, 
		refreshUserProfile 
	}
	return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextValue {
	const ctx = React.useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used within AuthProvider')
	return ctx
}


