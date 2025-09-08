import { Typography, Stack, Paper, Grid } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { listByTeam, toDate } from '../data/firestore'
import { InventoryItem, Transaction, SaleItem, LegacySale } from '../domain/models'
import { useAuth } from '../modules/auth/AuthContext'
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../utils/format'
import { calculateTotalCOGS, calculateCOGSForDateRange } from '../utils/cogs'

export function DashboardPage() {
	const { team } = useAuth()
	const now = React.useMemo(() => new Date(), [])
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

	// Data queries - now team-based
	const transactionsQuery = useQuery({ 
		queryKey: ['transactions', team?.id], 
		queryFn: () => team?.id ? listByTeam<Transaction>('transactions', team.id) : Promise.resolve([]),
		enabled: !!team?.id
	})
	const saleItemsQuery = useQuery({ 
		queryKey: ['saleItems', team?.id], 
		queryFn: () => team?.id ? listByTeam<SaleItem>('saleItems', team.id) : Promise.resolve([]),
		enabled: !!team?.id
	})
	const legacySalesQuery = useQuery({ 
		queryKey: ['sales', team?.id], 
		queryFn: () => team?.id ? listByTeam<LegacySale>('sales', team.id) : Promise.resolve([]),
		enabled: !!team?.id
	})
	const inventoryQuery = useQuery({ 
		queryKey: ['inventory', team?.id], 
		queryFn: () => team?.id ? listByTeam<InventoryItem>('inventory', team.id) : Promise.resolve([]),
		enabled: !!team?.id
	})

	// Calculate revenue from new transactions
	const transactionRevenueAll = (transactionsQuery.data || []).reduce((sum, t) => sum + (t.total || 0), 0)
	
	// Filter transactions for this month (client-side filtering is more reliable)
	const transactionRevenueMonth = (transactionsQuery.data || [])
		.filter(t => {
			const saleDate = toDate(t.saleDate)
			return saleDate && saleDate >= startOfMonth && saleDate <= endOfMonth
		})
		.reduce((sum, t) => sum + (t.total || 0), 0)
	
	// Calculate revenue from legacy sales
	const legacyRevenueAll = (legacySalesQuery.data || []).reduce((sum, s) => sum + (s.pricePerItem || 0) * (s.quantitySold || 0), 0)
	const legacyRevenueMonth = (legacySalesQuery.data || [])
		.filter(s => {
			const saleDate = toDate(s.saleDate)
			return saleDate && saleDate >= startOfMonth && saleDate <= endOfMonth
		})
		.reduce((sum, s) => sum + (s.pricePerItem || 0) * (s.quantitySold || 0), 0)
	
	// Combined totals
	const revenueAll = transactionRevenueAll + legacyRevenueAll
	const revenueMonth = transactionRevenueMonth + legacyRevenueMonth

	// COGS calculations - updated for new inventory model
	const cogsAll = React.useMemo(() => {
		if (!saleItemsQuery.data || !legacySalesQuery.data || !inventoryQuery.data) {
			return 0
		}
		return calculateTotalCOGS(
			saleItemsQuery.data,
			legacySalesQuery.data,
			inventoryQuery.data,
			[] // Empty array for shipments since we no longer use them
		)
	}, [saleItemsQuery.data, legacySalesQuery.data, inventoryQuery.data])

	const cogsMonth = React.useMemo(() => {
		if (!saleItemsQuery.data || !legacySalesQuery.data || !inventoryQuery.data || !transactionsQuery.data) {
			return 0
		}
		return calculateCOGSForDateRange(
			saleItemsQuery.data,
			legacySalesQuery.data,
			inventoryQuery.data,
			[], // Empty array for shipments since we no longer use them
			transactionsQuery.data,
			startOfMonth,
			endOfMonth
		)
	}, [saleItemsQuery.data, legacySalesQuery.data, inventoryQuery.data, transactionsQuery.data, startOfMonth, endOfMonth])

	// Gross Profit calculations
	const grossProfitAll = revenueAll - cogsAll
	const grossProfitMonth = revenueMonth - cogsMonth

	// Gross Margin percentages
	const grossMarginAll = revenueAll > 0 ? (grossProfitAll / revenueAll) * 100 : 0
	const grossMarginMonth = revenueMonth > 0 ? (grossProfitMonth / revenueMonth) * 100 : 0

	// Monthly chart data for last 12 months
	const months = Array.from({ length: 12 }).map((_, i) => {
		const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
		return { key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: d.toLocaleString(undefined, { month: 'short' }), year: d.getFullYear(), month: d.getMonth() }
	})
	const monthlyRevenueMap = new Map(months.map((m) => [m.key, 0]))
	
	// Add transaction revenue to monthly chart
	;(transactionsQuery.data || []).forEach((t) => {
		const d = toDate(t.saleDate)
		if (!d) return
		const key = `${d.getFullYear()}-${d.getMonth() + 1}`
		if (monthlyRevenueMap.has(key)) {
			monthlyRevenueMap.set(key, monthlyRevenueMap.get(key)! + (t.total || 0))
		}
	})
	
	// Add legacy sales revenue to monthly chart
	;(legacySalesQuery.data || []).forEach((s) => {
		const d = toDate(s.saleDate)
		if (!d) return
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
				{/* Revenue Metrics */}
				<Grid item xs={12} sm={6} md={3}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="subtitle2" color="text.secondary">Total Revenue</Typography>
						<Typography variant="h5" color="primary">{formatCurrency(revenueAll / 100)}</Typography>
					</Paper>
				</Grid>
				<Grid item xs={12} sm={6} md={3}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="subtitle2" color="text.secondary">This Month Revenue</Typography>
						<Typography variant="h5" color="primary">{formatCurrency(revenueMonth / 100)}</Typography>
					</Paper>
				</Grid>

				{/* COGS Metrics */}
				<Grid item xs={12} sm={6} md={3}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="subtitle2" color="text.secondary">Total COGS</Typography>
						<Typography variant="h5" color="warning.main">{formatCurrency(cogsAll / 100)}</Typography>
					</Paper>
				</Grid>
				<Grid item xs={12} sm={6} md={3}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="subtitle2" color="text.secondary">This Month COGS</Typography>
						<Typography variant="h5" color="warning.main">{formatCurrency(cogsMonth / 100)}</Typography>
					</Paper>
				</Grid>

				{/* Gross Profit Metrics */}
				<Grid item xs={12} sm={6} md={3}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="subtitle2" color="text.secondary">Total Gross Profit</Typography>
						<Typography variant="h5" color="success.main">{formatCurrency(grossProfitAll / 100)}</Typography>
						<Typography variant="body2" color="text.secondary">
							{grossMarginAll.toFixed(1)}% margin
						</Typography>
					</Paper>
				</Grid>
				<Grid item xs={12} sm={6} md={3}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="subtitle2" color="text.secondary">This Month Gross Profit</Typography>
						<Typography variant="h5" color="success.main">{formatCurrency(grossProfitMonth / 100)}</Typography>
						<Typography variant="body2" color="text.secondary">
							{grossMarginMonth.toFixed(1)}% margin
						</Typography>
					</Paper>
				</Grid>

				{/* Inventory Metric */}
				<Grid item xs={12} sm={6} md={3}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="subtitle2" color="text.secondary">Units On Hand</Typography>
						<Typography variant="h5">{(inventoryQuery.data || []).reduce((sum, i) => sum + (i.currentStock || 0), 0)}</Typography>
					</Paper>
				</Grid>

				{/* P&L Summary */}
				<Grid item xs={12} sm={6} md={3}>
					<Paper sx={{ p: 2, bgcolor: grossProfitMonth >= 0 ? 'success.light' : 'error.light' }}>
						<Typography variant="subtitle2" color="text.secondary">This Month P&L</Typography>
						<Typography variant="body2">Revenue: {formatCurrency(revenueMonth / 100)}</Typography>
						<Typography variant="body2">COGS: {formatCurrency(cogsMonth / 100)}</Typography>
						<Typography variant="h6" sx={{ fontWeight: 'bold' }}>
							Profit: {formatCurrency(grossProfitMonth / 100)}
						</Typography>
					</Paper>
				</Grid>
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


