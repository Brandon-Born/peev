import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { user, loading } = useAuth()
	const location = useLocation()
	if (loading) return React.createElement('div', null, 'Loading...')
	if (!user) return React.createElement(Navigate, { to: '/login', replace: true, state: { from: location } })
	return React.createElement(React.Fragment, null, children)
}


