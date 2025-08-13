import { Typography, Stack, Paper, Grid } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { listByOwner, listByOwnerBetween } from '../data/firestore'
import { InventoryItem, Transaction, SaleItem, LegacySale } from '../domain/models'
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../utils/format'

export function DashboardPage() {
	const now = React.useMemo(() => new Date(), [])
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

	// New transaction-based queries
	const transactionsQuery = useQuery({ queryKey: ['transactions'], queryFn: () => listByOwner<Transaction>('transactions') })
	const monthTransactionsQuery = useQuery({ 
		queryKey: ['transactions', 'month', startOfMonth.toISOString()], 
		queryFn: () => listByOwnerBetween<Transaction>('transactions', 'saleDate', startOfMonth, endOfMonth) 
	})
	
	// Legacy sales for backward compatibility
	const legacySalesQuery = useQuery({ queryKey: ['sales'], queryFn: () => listByOwner<LegacySale>('sales') })
	const inventoryQuery = useQuery({ queryKey: ['inventory'], queryFn: () => listByOwner<InventoryItem>('inventory') })

	// Calculate revenue from new transactions
	const transactionRevenueAll = (transactionsQuery.data || []).reduce((sum, t) => sum + (t.total || 0), 0)
	const transactionRevenueMonth = (monthTransactionsQuery.data || []).reduce((sum, t) => sum + (t.total || 0), 0)
	
	// Calculate revenue from legacy sales
	const legacyRevenueAll = (legacySalesQuery.data || []).reduce((sum, s) => sum + (s.pricePerItem || 0) * (s.quantitySold || 0), 0)
	const legacyRevenueMonth = (legacySalesQuery.data || [])
		.filter(s => {
			const saleDate = new Date(s.saleDate?.toDate?.() ?? s.saleDate ?? new Date())
			return saleDate >= startOfMonth && saleDate <= endOfMonth
		})
		.reduce((sum, s) => sum + (s.pricePerItem || 0) * (s.quantitySold || 0), 0)
	
	// Combined totals
	const revenueAll = transactionRevenueAll + legacyRevenueAll
	const revenueMonth = transactionRevenueMonth + legacyRevenueMonth

	// Monthly chart data for last 12 months
	const months = Array.from({ length: 12 }).map((_, i) => {
		const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
		return { key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: d.toLocaleString(undefined, { month: 'short' }), year: d.getFullYear(), month: d.getMonth() }
	})
	const monthlyRevenueMap = new Map(months.map((m) => [m.key, 0]))
	
	// Add transaction revenue to monthly chart
	;(transactionsQuery.data || []).forEach((t) => {
		const d = new Date(t.saleDate?.toDate?.() ?? t.saleDate ?? new Date())
		const key = `${d.getFullYear()}-${d.getMonth() + 1}`
		if (monthlyRevenueMap.has(key)) {
			monthlyRevenueMap.set(key, monthlyRevenueMap.get(key)! + (t.total || 0))
		}
	})
	
	// Add legacy sales revenue to monthly chart
	;(legacySalesQuery.data || []).forEach((s) => {
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
				<Grid item xs={12} md={4}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="subtitle2">Total Revenue</Typography>
						<Typography variant="h5">{formatCurrency(revenueAll / 100)}</Typography>
					</Paper>
				</Grid>
				<Grid item xs={12} md={4}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="subtitle2">This Month Revenue</Typography>
						<Typography variant="h5">{formatCurrency(revenueMonth / 100)}</Typography>
					</Paper>
				</Grid>
				<Grid item xs={12} md={4}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="subtitle2">Units On Hand</Typography>
						<Typography variant="h5">{(inventoryQuery.data || []).reduce((sum, i) => sum + (i.currentStock || 0), 0)}</Typography>
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


