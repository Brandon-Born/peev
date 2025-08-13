import { Routes, Route, Navigate } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { InventoryPage } from './pages/InventoryPage'
import { SalesPage } from './pages/SalesPage'
import { ReportsPage } from './pages/ReportsPage'
import { GlossaryPage } from './pages/GlossaryPage'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './modules/auth/ProtectedRoute'
import { useAuth } from './modules/auth/AuthContext'
import { AppLayout } from './layouts/AppLayout'

export default function App() {
	const { user, signInWithGoogle, signOut } = useAuth()

	return (
		<Routes>
			<Route path="/login" element={<LoginPage />} />
			<Route
				path="/"
				element={
					<ProtectedRoute>
						<AppLayout>
							<DashboardPage />
						</AppLayout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/inventory"
				element={
					<ProtectedRoute>
						<AppLayout>
							<InventoryPage />
						</AppLayout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/sales"
				element={
					<ProtectedRoute>
						<AppLayout>
							<SalesPage />
						</AppLayout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/reports"
				element={
					<ProtectedRoute>
						<AppLayout>
							<ReportsPage />
						</AppLayout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/glossary"
				element={
					<ProtectedRoute>
						<AppLayout>
							<GlossaryPage />
						</AppLayout>
					</ProtectedRoute>
				}
			/>
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	)
}


