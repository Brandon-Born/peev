import { Typography, Stack, Paper, Grid } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { listByOwner, listByOwnerBetween } from '../data/firestore'
import { InventoryItem } from '../domain/models'
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export function DashboardPage() {
	const now = React.useMemo(() => new Date(), [])
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

	const salesQuery = useQuery({ queryKey: ['sales', 'month', startOfMonth.toISOString()], queryFn: () => listByOwnerBetween<any>('sales', 'saleDate', startOfMonth, endOfMonth) })
	const allSalesQuery = useQuery({ queryKey: ['sales'], queryFn: () => listByOwner<any>('sales') })
	const inventoryQuery = useQuery({ queryKey: ['inventory'], queryFn: () => listByOwner<InventoryItem>('inventory') })

	const revenueAll = (allSalesQuery.data || []).reduce((sum, s: any) => sum + (s.pricePerItem || 0) * (s.quantitySold || 0), 0)
	const revenueMonth = (salesQuery.data || []).reduce((sum, s: any) => sum + (s.pricePerItem || 0) * (s.quantitySold || 0), 0)

	// Simple monthly chart data for last 12 months based on saleDate
	const months = Array.from({ length: 12 }).map((_, i) => {
		const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
		return { key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: d.toLocaleString(undefined, { month: 'short' }), year: d.getFullYear(), month: d.getMonth() }
	})
	const monthlyRevenueMap = new Map(months.map((m) => [m.key, 0]))
	;(allSalesQuery.data || []).forEach((s: any) => {
		const d = new Date(s.saleDate?.toDate?.() ?? s.saleDate ?? new Date())
		const key = `${d.getFullYear()}-${d.getMonth() + 1}`
		if (monthlyRevenueMap.has(key)) {
			monthlyRevenueMap.set(key, monthlyRevenueMap.get(key)! + (s.pricePerItem || 0) * (s.quantitySold || 0))
		}
	})
	const chartData = months.map((m) => ({ name: m.label, revenue: (monthlyRevenueMap.get(m.key) || 0) / 100 }))

	return (
		<Stack spacing={2}>
			<Typography variant="h4">Dashboard</Typography>
			<Grid container spacing={2}>
				<Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography variant="subtitle2">Total Revenue</Typography><Typography variant="h5">${(revenueAll / 100).toFixed(2)}</Typography></Paper></Grid>
				<Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography variant="subtitle2">This Month Revenue</Typography><Typography variant="h5">${(revenueMonth / 100).toFixed(2)}</Typography></Paper></Grid>
				<Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography variant="subtitle2">Products On Hand</Typography><Typography variant="h5">{(inventoryQuery.data || []).reduce((sum, i) => sum + (i.currentStock || 0), 0)}</Typography></Paper></Grid>
			</Grid>
			<Paper sx={{ p: 2, height: 300 }}>
				<Typography variant="subtitle2" gutterBottom>Revenue (last 12 months)</Typography>
				<ResponsiveContainer width="100%" height={240}>
					<BarChart data={chartData}>
						<XAxis dataKey="name" />
						<YAxis />
						<Tooltip />
						<Bar dataKey="revenue" fill="#1976d2" />
					</BarChart>
				</ResponsiveContainer>
			</Paper>
		</Stack>
	)
}


