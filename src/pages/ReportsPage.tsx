import React from 'react'
import { 
	Typography, Stack, Paper, Grid, TextField, Table, TableBody, TableCell, 
	TableContainer, TableHead, TableRow, Accordion, AccordionSummary, AccordionDetails,
	Box, Chip
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useQuery } from '@tanstack/react-query'
import { listByOwner, toDate } from '../data/firestore'
import { Transaction, SaleItem, LegacySale, InventoryItem, Product, Shipment } from '../domain/models'
import { formatCurrency } from '../utils/format'
import { calculateCOGSForDateRange } from '../utils/cogs'

interface ProductSalesData {
	productId: string
	productName: string
	unitsSold: number
	totalRevenue: number
	averagePrice: number
	transactionCount: number
}

export function ReportsPage() {
	const [selectedMonth, setSelectedMonth] = React.useState(() => {
		const now = new Date()
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
	})

	// State for quarterly report
	const [selectedQuarter, setSelectedQuarter] = React.useState(() => {
		const now = new Date()
		const quarter = Math.ceil((now.getMonth() + 1) / 3)
		return `${now.getFullYear()}-Q${quarter}`
	})

	// Data queries
	const transactionsQuery = useQuery({ queryKey: ['transactions'], queryFn: () => listByOwner<Transaction>('transactions') })
	const saleItemsQuery = useQuery({ queryKey: ['saleItems'], queryFn: () => listByOwner<SaleItem>('saleItems') })
	const legacySalesQuery = useQuery({ queryKey: ['sales'], queryFn: () => listByOwner<LegacySale>('sales') })
	const inventoryQuery = useQuery({ queryKey: ['inventory'], queryFn: () => listByOwner<InventoryItem>('inventory') })
	const productsQuery = useQuery({ queryKey: ['products'], queryFn: () => listByOwner<Product>('products') })
	const shipmentsQuery = useQuery({ queryKey: ['shipments'], queryFn: () => listByOwner<Shipment>('shipments') })

	// Helper function to get product name
	const getProductName = (productId: string) => {
		const product = (productsQuery.data || []).find(p => p.id === productId)
		return product?.name || `Unknown Product (${productId})`
	}

	// Calculate monthly sales data
	const monthlyReport = React.useMemo(() => {
		if (!transactionsQuery.data || !saleItemsQuery.data || !inventoryQuery.data) {
			return { productSales: [], totalRevenue: 0, totalUnits: 0, totalTransactions: 0 }
		}

		const [year, month] = selectedMonth.split('-').map(Number)
		const startOfMonth = new Date(year, month - 1, 1)
		const endOfMonth = new Date(year, month, 0, 23, 59, 59)

		// Filter transactions for selected month
		const monthTransactions = transactionsQuery.data.filter(t => {
			const saleDate = toDate(t.saleDate)
			return saleDate && saleDate >= startOfMonth && saleDate <= endOfMonth
		})

		// Get transaction IDs for the month
		const monthTransactionIds = new Set(monthTransactions.map(t => t.id))

		// Filter sale items for these transactions
		const monthSaleItems = saleItemsQuery.data.filter(item => 
			monthTransactionIds.has(item.transactionId)
		)

		// Add legacy sales for the month
		const monthLegacySales = legacySalesQuery.data?.filter(s => {
			const saleDate = toDate(s.saleDate)
			return saleDate && saleDate >= startOfMonth && saleDate <= endOfMonth
		}) || []

		// Aggregate by product
		const productMap = new Map<string, ProductSalesData>()

		// Process new sale items
		monthSaleItems.forEach(item => {
			// Find the inventory item to get the product ID
			const inventory = inventoryQuery.data.find(inv => inv.id === item.inventoryId)
			if (!inventory) return

			const productId = inventory.productId
			const existing = productMap.get(productId) || {
				productId,
				productName: getProductName(productId),
				unitsSold: 0,
				totalRevenue: 0,
				averagePrice: 0,
				transactionCount: 0
			}

			existing.unitsSold += item.quantitySold
			existing.totalRevenue += item.lineTotal
			existing.transactionCount += 1

			productMap.set(productId, existing)
		})

		// Process legacy sales
		monthLegacySales.forEach(sale => {
			// Find the inventory item to get the product ID
			const inventory = inventoryQuery.data.find(inv => inv.id === sale.inventoryId)
			if (!inventory) return

			const productId = inventory.productId
			const existing = productMap.get(productId) || {
				productId,
				productName: getProductName(productId),
				unitsSold: 0,
				totalRevenue: 0,
				averagePrice: 0,
				transactionCount: 0
			}

			const revenue = sale.pricePerItem * sale.quantitySold
			existing.unitsSold += sale.quantitySold
			existing.totalRevenue += revenue
			existing.transactionCount += 1

			productMap.set(productId, existing)
		})

		// Calculate average prices and sort by revenue
		const productSales = Array.from(productMap.values())
			.map(p => ({
				...p,
				averagePrice: p.unitsSold > 0 ? p.totalRevenue / p.unitsSold : 0
			}))
			.sort((a, b) => b.totalRevenue - a.totalRevenue)

		// Calculate totals
		const totalRevenue = monthTransactions.reduce((sum, t) => sum + t.total, 0) +
			monthLegacySales.reduce((sum, s) => sum + (s.pricePerItem * s.quantitySold), 0)
		
		const totalUnits = productSales.reduce((sum, p) => sum + p.unitsSold, 0)
		const totalTransactions = monthTransactions.length + monthLegacySales.length

		return { productSales, totalRevenue, totalUnits, totalTransactions }
	}, [selectedMonth, transactionsQuery.data, saleItemsQuery.data, legacySalesQuery.data, inventoryQuery.data, getProductName])

	// Calculate quarterly tax report data
	const quarterlyReport = React.useMemo(() => {
		if (!transactionsQuery.data || !saleItemsQuery.data || !inventoryQuery.data || !shipmentsQuery.data) {
			return { totalRevenue: 0, totalCOGS: 0, grossProfit: 0, grossMargin: 0, totalTransactions: 0, totalUnits: 0 }
		}

		const [year, quarterStr] = selectedQuarter.split('-Q')
		const quarter = parseInt(quarterStr)
		
		// Calculate quarter date range
		const startMonth = (quarter - 1) * 3
		const startOfQuarter = new Date(parseInt(year), startMonth, 1)
		const endOfQuarter = new Date(parseInt(year), startMonth + 3, 0, 23, 59, 59)

		// Filter transactions for selected quarter
		const quarterTransactions = transactionsQuery.data.filter(t => {
			const saleDate = toDate(t.saleDate)
			return saleDate && saleDate >= startOfQuarter && saleDate <= endOfQuarter
		})

		// Filter legacy sales for selected quarter
		const quarterLegacySales = legacySalesQuery.data?.filter(s => {
			const saleDate = toDate(s.saleDate)
			return saleDate && saleDate >= startOfQuarter && saleDate <= endOfQuarter
		}) || []

		// Calculate total revenue
		const transactionRevenue = quarterTransactions.reduce((sum, t) => sum + t.total, 0)
		const legacyRevenue = quarterLegacySales.reduce((sum, s) => sum + (s.pricePerItem * s.quantitySold), 0)
		const totalRevenue = transactionRevenue + legacyRevenue

		// Calculate COGS using our COGS calculation utility
		const totalCOGS = calculateCOGSForDateRange(
			saleItemsQuery.data,
			legacySalesQuery.data || [],
			inventoryQuery.data,
			shipmentsQuery.data,
			transactionsQuery.data,
			startOfQuarter,
			endOfQuarter
		)

		// Calculate gross profit and margin
		const grossProfit = totalRevenue - totalCOGS
		const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

		// Calculate totals
		const totalTransactions = quarterTransactions.length + quarterLegacySales.length
		
		// Calculate total units sold
		const transactionIds = new Set(quarterTransactions.map(t => t.id))
		const quarterSaleItems = saleItemsQuery.data.filter(item => transactionIds.has(item.transactionId))
		const newTransactionUnits = quarterSaleItems.reduce((sum, item) => sum + item.quantitySold, 0)
		const legacyUnits = quarterLegacySales.reduce((sum, s) => sum + s.quantitySold, 0)
		const totalUnits = newTransactionUnits + legacyUnits

		return { 
			totalRevenue, 
			totalCOGS, 
			grossProfit, 
			grossMargin, 
			totalTransactions, 
			totalUnits,
			startOfQuarter,
			endOfQuarter 
		}
	}, [selectedQuarter, transactionsQuery.data, saleItemsQuery.data, legacySalesQuery.data, inventoryQuery.data, shipmentsQuery.data])

	const isLoading = transactionsQuery.isLoading || saleItemsQuery.isLoading || 
		legacySalesQuery.isLoading || inventoryQuery.isLoading || productsQuery.isLoading || shipmentsQuery.isLoading

	return (
		<Stack spacing={3}>
			<Typography variant="h4">Reports</Typography>

			{/* Monthly Sales Report */}
			<Accordion defaultExpanded={true}>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography variant="h5">Monthly Sales Report</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<Stack spacing={3}>
						{/* Month Selection */}
						<Grid container spacing={2} alignItems="center">
							<Grid item xs={12} sm={4}>
								<TextField
									type="month"
									label="Select Month"
									value={selectedMonth}
									onChange={(e) => setSelectedMonth(e.target.value)}
									fullWidth
									InputLabelProps={{ shrink: true }}
								/>
							</Grid>
							<Grid item xs={12} sm={8}>
								<Typography variant="h6" color="text.secondary">
									{new Date(selectedMonth + '-01').toLocaleDateString(undefined, { 
										month: 'long', 
										year: 'numeric' 
									})}
								</Typography>
							</Grid>
						</Grid>

						{isLoading ? (
							<Typography>Loading report data...</Typography>
						) : (
							<>
								{/* Summary Cards */}
								<Grid container spacing={2}>
									<Grid item xs={12} sm={3}>
										<Paper sx={{ p: 2, textAlign: 'center' }}>
											<Typography variant="h6" color="primary">
												{formatCurrency(monthlyReport.totalRevenue / 100)}
											</Typography>
											<Typography variant="body2" color="text.secondary">
												Total Revenue
											</Typography>
										</Paper>
									</Grid>
									<Grid item xs={12} sm={3}>
										<Paper sx={{ p: 2, textAlign: 'center' }}>
											<Typography variant="h6" color="primary">
												{monthlyReport.totalUnits}
											</Typography>
											<Typography variant="body2" color="text.secondary">
												Units Sold
											</Typography>
										</Paper>
									</Grid>
									<Grid item xs={12} sm={3}>
										<Paper sx={{ p: 2, textAlign: 'center' }}>
											<Typography variant="h6" color="primary">
												{monthlyReport.totalTransactions}
											</Typography>
											<Typography variant="body2" color="text.secondary">
												Transactions
											</Typography>
										</Paper>
									</Grid>
									<Grid item xs={12} sm={3}>
										<Paper sx={{ p: 2, textAlign: 'center' }}>
											<Typography variant="h6" color="primary">
												{monthlyReport.productSales.length}
											</Typography>
											<Typography variant="body2" color="text.secondary">
												Products Sold
											</Typography>
										</Paper>
									</Grid>
								</Grid>

								{/* Product Performance Table */}
								{monthlyReport.productSales.length > 0 ? (
									<Paper>
										<Box sx={{ p: 2 }}>
											<Typography variant="h6" gutterBottom>
												Product Performance
											</Typography>
										</Box>
										<TableContainer>
											<Table>
												<TableHead>
													<TableRow>
														<TableCell>Product</TableCell>
														<TableCell align="right">Units Sold</TableCell>
														<TableCell align="right">Total Revenue</TableCell>
														<TableCell align="right">Avg Price</TableCell>
														<TableCell align="right">Transactions</TableCell>
														<TableCell align="right">% of Revenue</TableCell>
													</TableRow>
												</TableHead>
												<TableBody>
													{monthlyReport.productSales.map((product) => (
														<TableRow key={product.productId}>
															<TableCell>
																<Stack direction="row" spacing={1} alignItems="center">
																	<Typography variant="body2">
																		{product.productName}
																	</Typography>
																	{product.totalRevenue === Math.max(...monthlyReport.productSales.map(p => p.totalRevenue)) && (
																		<Chip label="Top Seller" size="small" color="success" />
																	)}
																</Stack>
															</TableCell>
															<TableCell align="right">{product.unitsSold}</TableCell>
															<TableCell align="right">
																{formatCurrency(product.totalRevenue / 100)}
															</TableCell>
															<TableCell align="right">
																{formatCurrency(product.averagePrice / 100)}
															</TableCell>
															<TableCell align="right">{product.transactionCount}</TableCell>
															<TableCell align="right">
																{monthlyReport.totalRevenue > 0 
																	? `${((product.totalRevenue / monthlyReport.totalRevenue) * 100).toFixed(1)}%`
																	: '0%'
																}
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</TableContainer>
									</Paper>
								) : (
									<Paper sx={{ p: 3, textAlign: 'center' }}>
										<Typography variant="h6" color="text.secondary">
											No sales found for {new Date(selectedMonth + '-01').toLocaleDateString(undefined, { 
												month: 'long', 
												year: 'numeric' 
											})}
										</Typography>
										<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
											Try selecting a different month or create some transactions first.
										</Typography>
									</Paper>
								)}
							</>
						)}
					</Stack>
				</AccordionDetails>
			</Accordion>

			{/* Quarterly Tax Report */}
			<Accordion defaultExpanded={false}>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography variant="h5">Quarterly Tax Report</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<Stack spacing={3}>
						{/* Quarter Selection */}
						<Grid container spacing={2} alignItems="center">
							<Grid item xs={12} sm={4}>
								<TextField
									select
									label="Select Quarter"
									value={selectedQuarter}
									onChange={(e) => setSelectedQuarter(e.target.value)}
									fullWidth
									SelectProps={{ native: true }}
								>
									{/* Generate quarter options for current and previous years */}
									{Array.from({ length: 8 }, (_, i) => {
										const year = new Date().getFullYear() - Math.floor(i / 4)
										const quarter = 4 - (i % 4)
										const value = `${year}-Q${quarter}`
										const label = `Q${quarter} ${year}`
										return (
											<option key={value} value={value}>
												{label}
											</option>
										)
									})}
								</TextField>
							</Grid>
							<Grid item xs={12} sm={8}>
								<Typography variant="h6" color="text.secondary">
									{(() => {
										const [year, quarterStr] = selectedQuarter.split('-Q')
										const quarter = parseInt(quarterStr)
										const startMonth = (quarter - 1) * 3
										const startDate = new Date(parseInt(year), startMonth, 1)
										const endDate = new Date(parseInt(year), startMonth + 3, 0)
										return `${startDate.toLocaleDateString(undefined, { month: 'long' })} - ${endDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
									})()}
								</Typography>
							</Grid>
						</Grid>

						{isLoading ? (
							<Typography>Loading tax report data...</Typography>
						) : (
							<>
								{/* Tax Summary - Primary Metrics */}
								<Paper sx={{ p: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
									<Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
										Tax Summary for {selectedQuarter}
									</Typography>
									<Grid container spacing={2}>
										<Grid item xs={12} sm={4}>
											<Typography variant="h4" sx={{ fontWeight: 'bold' }}>
												{formatCurrency(quarterlyReport.totalRevenue / 100)}
											</Typography>
											<Typography variant="body1">Total Sales Revenue</Typography>
										</Grid>
										<Grid item xs={12} sm={4}>
											<Typography variant="h4" sx={{ fontWeight: 'bold' }}>
												{formatCurrency(quarterlyReport.totalCOGS / 100)}
											</Typography>
											<Typography variant="body1">Cost of Goods Sold</Typography>
										</Grid>
										<Grid item xs={12} sm={4}>
											<Typography variant="h4" sx={{ fontWeight: 'bold' }}>
												{formatCurrency(quarterlyReport.grossProfit / 100)}
											</Typography>
											<Typography variant="body1">Gross Profit</Typography>
										</Grid>
									</Grid>
								</Paper>

								{/* Detailed Financial Breakdown */}
								<Grid container spacing={2}>
									<Grid item xs={12} md={8}>
										<Paper sx={{ p: 3 }}>
											<Typography variant="h6" gutterBottom>
												Financial Breakdown
											</Typography>
											<Table>
												<TableBody>
													<TableRow>
														<TableCell><strong>Total Sales Revenue</strong></TableCell>
														<TableCell align="right">
															<Typography variant="h6" color="primary">
																{formatCurrency(quarterlyReport.totalRevenue / 100)}
															</Typography>
														</TableCell>
													</TableRow>
													<TableRow>
														<TableCell>Less: Cost of Goods Sold (COGS)</TableCell>
														<TableCell align="right">
															<Typography variant="h6" color="warning.main">
																({formatCurrency(quarterlyReport.totalCOGS / 100)})
															</Typography>
														</TableCell>
													</TableRow>
													<TableRow sx={{ borderTop: 2, borderColor: 'divider' }}>
														<TableCell><strong>Gross Profit</strong></TableCell>
														<TableCell align="right">
															<Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
																{formatCurrency(quarterlyReport.grossProfit / 100)}
															</Typography>
														</TableCell>
													</TableRow>
													<TableRow>
														<TableCell>Gross Margin</TableCell>
														<TableCell align="right">
															<Typography variant="body1" color="success.main">
																{quarterlyReport.grossMargin.toFixed(1)}%
															</Typography>
														</TableCell>
													</TableRow>
												</TableBody>
											</Table>
										</Paper>
									</Grid>

									<Grid item xs={12} md={4}>
										<Stack spacing={2}>
											{/* Transaction Volume */}
											<Paper sx={{ p: 2, textAlign: 'center' }}>
												<Typography variant="h5" color="primary">
													{quarterlyReport.totalTransactions}
												</Typography>
												<Typography variant="body2" color="text.secondary">
													Total Transactions
												</Typography>
											</Paper>

											{/* Units Sold */}
											<Paper sx={{ p: 2, textAlign: 'center' }}>
												<Typography variant="h5" color="primary">
													{quarterlyReport.totalUnits}
												</Typography>
												<Typography variant="body2" color="text.secondary">
													Units Sold
												</Typography>
											</Paper>

											{/* Average Transaction */}
											<Paper sx={{ p: 2, textAlign: 'center' }}>
												<Typography variant="h5" color="primary">
													{quarterlyReport.totalTransactions > 0 
														? formatCurrency((quarterlyReport.totalRevenue / quarterlyReport.totalTransactions) / 100)
														: formatCurrency(0)
													}
												</Typography>
												<Typography variant="body2" color="text.secondary">
													Avg Transaction Value
												</Typography>
											</Paper>
										</Stack>
									</Grid>
								</Grid>

								{/* Tax Notes and Information */}
								<Paper sx={{ p: 3, bgcolor: 'info.light' }}>
									<Typography variant="h6" gutterBottom>
										📋 Tax Filing Notes
									</Typography>
									<Grid container spacing={2}>
										<Grid item xs={12} md={6}>
											<Typography variant="body2" paragraph>
												<strong>COGS Calculation Method:</strong> Weighted Average Cost (WAC) per shipment
											</Typography>
											<Typography variant="body2" paragraph>
												<strong>Report Period:</strong> {quarterlyReport.startOfQuarter?.toLocaleDateString()} to {quarterlyReport.endOfQuarter?.toLocaleDateString()}
											</Typography>
											<Typography variant="body2">
												<strong>Currency:</strong> All amounts in USD
											</Typography>
										</Grid>
										<Grid item xs={12} md={6}>
											<Typography variant="body2" paragraph>
												<strong>For Tax Filing:</strong> Use "Total Sales Revenue" and "Cost of Goods Sold" figures above
											</Typography>
											<Typography variant="body2" paragraph>
												<strong>Gross Profit:</strong> This is your profit before operating expenses, taxes, and other deductions
											</Typography>
											<Typography variant="body2">
												<strong>Consult Tax Professional:</strong> For specific tax advice and filing requirements
											</Typography>
										</Grid>
									</Grid>
								</Paper>

								{/* No Data State */}
								{quarterlyReport.totalRevenue === 0 && (
									<Paper sx={{ p: 3, textAlign: 'center' }}>
										<Typography variant="h6" color="text.secondary">
											No sales found for {selectedQuarter}
										</Typography>
										<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
											Try selecting a different quarter or create some transactions first.
										</Typography>
									</Paper>
								)}
							</>
						)}
					</Stack>
				</AccordionDetails>
			</Accordion>
		</Stack>
	)
}