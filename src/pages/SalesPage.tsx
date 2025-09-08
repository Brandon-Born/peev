import React from 'react'
import { 
	Typography, Paper, Stack, TextField, Button, Accordion, AccordionSummary, AccordionDetails, 
	Snackbar, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
	IconButton, Box, Divider, Grid
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { listByTeam, deleteById, toDate } from '../data/firestore'
import { useAuth } from '../modules/auth/AuthContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InventoryItem, Product, Transaction, SaleItem, LegacySale } from '../domain/models'
import { recordSaleTransaction } from '../data/sales'
import { formatCurrency } from '../utils/format'

// Form schemas
const saleItemFormSchema = z.object({
	productId: z.string().min(1, 'Product required'),
	inventoryId: z.string().min(1, 'Inventory required'),
	quantity: z.string().min(1, 'Quantity required'),
	priceUsd: z.string().min(1, 'Price required'),
})

const transactionFormSchema = z.object({
	customerName: z.string().optional(),
	items: z.array(saleItemFormSchema).min(1, 'At least one item required'),
	taxUsd: z.string().optional(),
	discountUsd: z.string().optional(),
})

type TransactionForm = z.infer<typeof transactionFormSchema>

export function SalesPage() {
	const { team } = useAuth()
	const qc = useQueryClient()
	const productsQuery = useQuery({ 
		queryKey: ['products', team?.id], 
		queryFn: () => team?.id ? listByTeam<Product>('products', team.id) : Promise.resolve([]),
		enabled: !!team?.id
	})
	const inventoryQuery = useQuery({ 
		queryKey: ['inventory', team?.id], 
		queryFn: () => team?.id ? listByTeam<InventoryItem>('inventory', team.id) : Promise.resolve([]),
		enabled: !!team?.id
	})
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

	const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ 
		open: false, message: '', severity: 'success' 
	})
	const [confirm, setConfirm] = React.useState<{ 
		open: boolean; title: string; message: string; onConfirm: () => Promise<void> 
	}>({ 
		open: false, title: '', message: '', onConfirm: async () => {} 
	})

	const form = useForm<TransactionForm>({
		resolver: zodResolver(transactionFormSchema),
		defaultValues: {
			customerName: '',
			items: [{ productId: '', inventoryId: '', quantity: '', priceUsd: '' }],
			taxUsd: '',
			discountUsd: '',
		}
	})

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: 'items'
	})

	// Helper functions

	const getProductName = (productId: string) => {
		const product = (productsQuery.data || []).find(p => p.id === productId)
		return product?.name || productId
	}

	const getAvailableInventory = (productId: string) => {
		return (inventoryQuery.data || []).filter(inv => 
			inv.productId === productId && inv.currentStock > 0
		)
	}

	// Calculate totals
	const watchedItems = form.watch('items')
	const subtotal = watchedItems.reduce((sum, item) => {
		const qty = Math.max(0, Math.floor(Number(item.quantity) || 0))
		const price = Math.max(0, Number(item.priceUsd) || 0)
		return sum + (qty * price)
	}, 0)

	const tax = Math.max(0, Number(form.watch('taxUsd')) || 0)
	const discount = Math.max(0, Number(form.watch('discountUsd')) || 0)
	const total = Math.max(0, subtotal + tax - discount)

	async function onSubmit(values: TransactionForm) {
		try {
			const items = values.items.map(item => ({
				inventoryId: item.inventoryId,
				quantitySold: Math.max(1, Math.floor(Number(item.quantity))),
				pricePerItemCents: Math.round((Number(item.priceUsd) || 0) * 100)
			}))

			await recordSaleTransaction({
				items,
				customerName: values.customerName || undefined,
				tax: tax > 0 ? Math.round(tax * 100) : undefined,
				discount: discount > 0 ? Math.round(discount * 100) : undefined,
			})

			await Promise.all([
				qc.invalidateQueries({ queryKey: ['inventory'] }),
				qc.invalidateQueries({ queryKey: ['transactions'] }),
				qc.invalidateQueries({ queryKey: ['saleItems'] }),
			])

			setSnack({ open: true, message: 'Transaction recorded successfully', severity: 'success' })

			// Defer the form reset to avoid React hook conflicts
			setTimeout(() => {
				// Reset form fields first
				form.reset({
					customerName: '',
					taxUsd: '',
					discountUsd: '',
				})
				
				// Then safely reset the field array
				const currentItemCount = fields.length
				for (let i = currentItemCount - 1; i >= 0; i--) {
					remove(i)
				}
				
				// Add exactly one fresh item
				append({ productId: '', inventoryId: '', quantity: '', priceUsd: '' })
			}, 0)
		} catch (error: any) {
			setSnack({ open: true, message: error.message || 'Transaction failed', severity: 'error' })
		}
	}

	async function deleteTransaction(transactionId: string) {
		try {
			// Delete related sale items first
			const relatedItems = (saleItemsQuery.data || []).filter(item => item.transactionId === transactionId)
			await Promise.all(relatedItems.map(item => deleteById('saleItems', item.id)))
			
			// Delete transaction
			await deleteById('transactions', transactionId)
			
			await Promise.all([
				qc.invalidateQueries({ queryKey: ['transactions'] }),
				qc.invalidateQueries({ queryKey: ['saleItems'] }),
			])
			
			setSnack({ open: true, message: 'Transaction deleted', severity: 'success' })
		} catch (error: any) {
			setSnack({ open: true, message: error.message || 'Delete failed', severity: 'error' })
		}
	}

	return (
		<>
			<Paper sx={{ p: 2 }}>
				<Stack spacing={2}>
					<Typography variant="h4" gutterBottom>Sales Tracker</Typography>
					
					<Accordion defaultExpanded={true}>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Typography variant="h6">Record New Transaction</Typography>
						</AccordionSummary>
						<AccordionDetails>
							<Stack component="form" spacing={3} onSubmit={form.handleSubmit(onSubmit)}>
								{/* Customer name */}
								<TextField 
									label="Customer Name (Optional)" 
									{...form.register('customerName')}
									error={!!form.formState.errors.customerName}
									helperText={form.formState.errors.customerName?.message}
								/>

								{/* Items */}
								<Typography variant="h6">Items</Typography>
								{fields.map((field, index) => (
									<Paper key={field.id} sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
										<Stack spacing={2}>
											<Grid container spacing={2}>
												<Grid item xs={12} md={6}>
													<TextField 
														select 
														label="Product" 
														fullWidth
														SelectProps={{ native: true }} 
														{...form.register(`items.${index}.productId`)}
														error={!!form.formState.errors.items?.[index]?.productId}
														helperText={form.formState.errors.items?.[index]?.productId?.message}
													>
														<option value=""></option>
														{productsQuery.data?.map((p) => (
															<option key={p.id} value={p.id}>{p.name}</option>
														))}
													</TextField>
												</Grid>
												<Grid item xs={12} md={6}>
													<TextField 
														select 
														label="Inventory (Shipment)" 
														fullWidth
														SelectProps={{ native: true }} 
														{...form.register(`items.${index}.inventoryId`)}
														error={!!form.formState.errors.items?.[index]?.inventoryId}
														helperText={form.formState.errors.items?.[index]?.inventoryId?.message}
													>
														<option value=""></option>
														{getAvailableInventory(form.watch(`items.${index}.productId`)).map((inv) => {
															const purchaseDate = (inv as any).purchaseDate 
																? new Date((inv as any).purchaseDate.toDate ? (inv as any).purchaseDate.toDate() : (inv as any).purchaseDate).toLocaleDateString()
																: ''
															const supplier = (inv as any).supplier || ''
															const totalCost = ((inv as any).totalCost || 0) / 100
															const purchaseQuantity = (inv as any).purchaseQuantity || 1
															const unitsPerPack = (inv as any).unitsPerPack || inv.initialQuantity
															const unitCost = totalCost / (purchaseQuantity * unitsPerPack)
															const purchaseInfo = `${purchaseDate} ${supplier ? `from ${supplier}` : ''} ${totalCost > 0 ? `($${unitCost.toFixed(2)}/unit)` : ''}`
															return (
																<option key={inv.id} value={inv.id}>
																	{purchaseInfo} — {inv.currentStock} units available
																</option>
															)
														})}
													</TextField>
												</Grid>
											</Grid>
											<Grid container spacing={2} alignItems="center">
												<Grid item xs={6} sm={3}>
													<TextField 
														type="number" 
														label="Quantity" 
														fullWidth
														inputProps={{ min: 1, step: 1 }} 
														{...form.register(`items.${index}.quantity`)}
														error={!!form.formState.errors.items?.[index]?.quantity}
														helperText={form.formState.errors.items?.[index]?.quantity?.message}
													/>
												</Grid>
												<Grid item xs={6} sm={3}>
													<TextField 
														type="number" 
														label="Price (USD)" 
														fullWidth
														inputProps={{ min: 0, step: '0.01' }} 
														{...form.register(`items.${index}.priceUsd`)}
														error={!!form.formState.errors.items?.[index]?.priceUsd}
														helperText={form.formState.errors.items?.[index]?.priceUsd?.message}
													/>
												</Grid>
												<Grid item xs={12} sm={6}>
													<Stack direction="row" spacing={1} justifyContent="flex-end">
														{fields.length > 1 && (
															<IconButton onClick={() => remove(index)} color="error">
																<DeleteIcon />
															</IconButton>
														)}
														{index === fields.length - 1 && (
															<IconButton 
																onClick={() => append({ productId: '', inventoryId: '', quantity: '', priceUsd: '' })}
																color="primary"
															>
																<AddIcon />
															</IconButton>
														)}
													</Stack>
												</Grid>
											</Grid>
										</Stack>
									</Paper>
								))}

								{/* Transaction totals */}
								<Divider />
								<Typography variant="h6">Transaction Totals</Typography>
								<Grid container spacing={2}>
									<Grid item xs={12} sm={4}>
										<TextField 
											type="number" 
											label="Tax (USD)" 
											fullWidth
											inputProps={{ min: 0, step: '0.01' }} 
											{...form.register('taxUsd')}
										/>
									</Grid>
									<Grid item xs={12} sm={4}>
										<TextField 
											type="number" 
											label="Discount (USD)" 
											fullWidth
											inputProps={{ min: 0, step: '0.01' }} 
											{...form.register('discountUsd')}
										/>
									</Grid>
									<Grid item xs={12} sm={4}>
										<Box sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText', borderRadius: 1 }}>
											<Typography variant="subtitle2">Subtotal: {formatCurrency(subtotal)}</Typography>
											{tax > 0 && <Typography variant="body2">Tax: {formatCurrency(tax)}</Typography>}
											{discount > 0 && <Typography variant="body2">Discount: -{formatCurrency(discount)}</Typography>}
											<Typography variant="h6">Total: {formatCurrency(total)}</Typography>
										</Box>
									</Grid>
								</Grid>

								<Button type="submit" variant="contained" size="large">
									Record Transaction
								</Button>
							</Stack>
						</AccordionDetails>
					</Accordion>

					<Accordion defaultExpanded={false}>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Typography variant="h6">Recent Transactions</Typography>
						</AccordionSummary>
						<AccordionDetails>
							<TableContainer>
								<Table>
									<TableHead>
										<TableRow>
											<TableCell>Date</TableCell>
											<TableCell>Customer</TableCell>
											<TableCell>Items</TableCell>
											<TableCell align="right">Total</TableCell>
											<TableCell align="center">Actions</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{(transactionsQuery.data || []).slice(0, 20).map((transaction) => {
											const relatedItems = (saleItemsQuery.data || []).filter(item => 
												item.transactionId === transaction.id
											)
											return (
												<TableRow key={transaction.id}>
													<TableCell>
														{toDate(transaction.saleDate)?.toLocaleDateString()}
													</TableCell>
													<TableCell>{transaction.customerName || '—'}</TableCell>
													<TableCell>
														{relatedItems.map((item, idx) => (
															<div key={idx}>
																{item.quantitySold}× {getProductName(
																	(inventoryQuery.data || []).find(inv => inv.id === item.inventoryId)?.productId || ''
																)}
															</div>
														))}
													</TableCell>
													<TableCell align="right">{formatCurrency(transaction.total / 100)}</TableCell>
													<TableCell align="center">
														<Button 
															color="error" 
															size="small" 
															onClick={() => setConfirm({ 
																open: true, 
																title: 'Delete Transaction', 
																message: 'Delete this transaction? This cannot be undone.', 
																onConfirm: () => deleteTransaction(transaction.id)
															})}
														>
															Delete
														</Button>
													</TableCell>
												</TableRow>
											)
										})}
									</TableBody>
								</Table>
							</TableContainer>
						</AccordionDetails>
					</Accordion>

					{/* Legacy sales - for backward compatibility during migration */}
					{(legacySalesQuery.data?.length || 0) > 0 && (
						<Accordion defaultExpanded={false}>
							<AccordionSummary expandIcon={<ExpandMoreIcon />}>
								<Typography variant="h6">Legacy Sales (Single Items)</Typography>
							</AccordionSummary>
							<AccordionDetails>
								<Typography variant="body2" color="text.secondary" gutterBottom>
									These are old single-item sales from before the multi-item transaction update.
								</Typography>
								<Stack spacing={1}>
									{(legacySalesQuery.data || []).slice(0, 10).map((sale) => (
										<Stack key={sale.id} direction="row" alignItems="center" justifyContent="space-between">
											<Typography variant="body2">
												{sale.quantitySold} × {formatCurrency(sale.pricePerItem / 100)} on{' '}
												{toDate(sale.saleDate)?.toLocaleDateString()}
											</Typography>
											<Button 
												color="error" 
												size="small" 
												onClick={() => setConfirm({ 
													open: true, 
													title: 'Delete Sale', 
													message: 'Delete this legacy sale? This cannot be undone.', 
													onConfirm: async () => {
														try {
															await deleteById('sales', sale.id)
															await qc.invalidateQueries({ queryKey: ['sales'] })
															setSnack({ open: true, message: 'Sale deleted', severity: 'success' })
														} catch (error: any) {
															setSnack({ open: true, message: error.message || 'Delete failed', severity: 'error' })
														}
													}
												})}
											>
												Delete
											</Button>
										</Stack>
									))}
								</Stack>
							</AccordionDetails>
						</Accordion>
					)}
				</Stack>
			</Paper>

			<ConfirmDialog 
				open={confirm.open} 
				title={confirm.title} 
				message={confirm.message} 
				onClose={() => setConfirm({ ...confirm, open: false })} 
				onConfirm={async () => { 
					await confirm.onConfirm()
					setConfirm({ ...confirm, open: false }) 
				}} 
			/>
			
			<Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
				<Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%' }}>
					{snack.message}
				</Alert>
			</Snackbar>
		</>
	)
}