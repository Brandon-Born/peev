import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { user, loading, needsOnboarding } = useAuth()
	const location = useLocation()
	
	if (loading) return React.createElement('div', null, 'Loading...')
	if (!user) return React.createElement(Navigate, { to: '/login', replace: true, state: { from: location } })
	
	// Redirect to onboarding if user needs it
	if (needsOnboarding && location.pathname !== '/onboarding') {
		return React.createElement(Navigate, { to: '/onboarding', replace: true })
	}
	
	// Redirect away from onboarding if user already has a team
	if (!needsOnboarding && location.pathname === '/onboarding') {
		return React.createElement(Navigate, { to: '/', replace: true })
	}
	
	return React.createElement(React.Fragment, null, children)
}


