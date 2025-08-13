import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { InventoryPage } from './pages/InventoryPage'
import { SalesPage } from './pages/SalesPage'
import { ReportsPage } from './pages/ReportsPage'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './modules/auth/ProtectedRoute'
import { useAuth } from './modules/auth/AuthContext'

export default function App() {
	const { user, signInWithGoogle, signOut } = useAuth()

	return (
		<div style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
			{user && (
				<header style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
					<nav style={{ display: 'flex', gap: 12 }}>
						<Link to="/">Dashboard</Link>
						<Link to="/inventory">Inventory</Link>
						<Link to="/sales">Sales</Link>
						<Link to="/reports">Reports</Link>
					</nav>
					<div style={{ marginLeft: 'auto' }}>
						<button onClick={signOut}>Sign out</button>
					</div>
				</header>
			)}

			<Routes>
				<Route path="/login" element={<LoginPage />} />
				<Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
				<Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
				<Route path="/sales" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
				<Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</div>
	)
}


