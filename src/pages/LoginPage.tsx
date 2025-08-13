import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../modules/auth/AuthContext'

export function LoginPage() {
	const { user, signInWithGoogle } = useAuth()
	const navigate = useNavigate()
	const location = useLocation() as { state?: { from?: { pathname?: string } } }

	useEffect(() => {
		if (user) {
			const redirectTo = location.state?.from?.pathname || '/'
			navigate(redirectTo, { replace: true })
		}
	}, [user, navigate, location])

	return (
		<div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
			<div style={{ textAlign: 'center' }}>
				<h2>Sign in to P.I.T.A.</h2>
				<p>Use your Google account to continue.</p>
				<button onClick={signInWithGoogle}>Sign in with Google</button>
			</div>
		</div>
	)
}


