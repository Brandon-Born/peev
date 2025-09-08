import { Typography, Tabs, Tab, Box, Stack, TextField, Button, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Accordion, AccordionSummary, AccordionDetails, Snackbar, Alert, useMediaQuery, useTheme } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { addWithTeamMeta, deleteById, listByTeam, updateWithMeta, existsTeamWhere } from '../data/firestore'
import { useAuth } from '../modules/auth/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ProductCategory, Product, InventoryItem } from '../domain/models'
import { ConfirmDialog } from '../components/ConfirmDialog'

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
	const { children, value, index, ...other } = props
	return (
		<div role="tabpanel" hidden={value !== index} {...other}>
			{value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
		</div>
	)
}

export function InventoryPage() {
	const { team } = useAuth()
	const theme = useTheme()
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
	const [tab, setTab] = React.useState(0)
	const qc = useQueryClient()
	const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
	const [confirm, setConfirm] = React.useState<{ open: boolean; title: string; message: string; onConfirm: () => Promise<void> }>({ open: false, title: '', message: '', onConfirm: async () => {} })

	function showSuccess(message: string) { setSnack({ open: true, message, severity: 'success' }) }
	function showError(message: string) { setSnack({ open: true, message, severity: 'error' }) }

	// Helper function to check if an item is expiring within 30 days
	function isExpiringSoon(expirationDate: any): boolean {
		if (!expirationDate) return false
		const expDate = expirationDate instanceof Date ? expirationDate : new Date(expirationDate.toDate ? expirationDate.toDate() : expirationDate)
		const now = new Date()
		const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))
		return expDate <= thirtyDaysFromNow && expDate >= now
	}

	// No longer need tryClaimOwnership - team members have equal access

	// Team-based queries  
	const categoriesQuery = useQuery({ 
		queryKey: ['productCategories', team?.id], 
		queryFn: () => team?.id ? listByTeam<ProductCategory>('productCategories', team.id) : Promise.resolve([]),
		enabled: !!team?.id
	})
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

	// Forms
	const categorySchema = z.object({ name: z.string().min(1) })
	type CategoryForm = z.infer<typeof categorySchema>
	const categoryForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: { name: '' } })

	const productSchema = z.object({ 
		name: z.string().min(1), 
		categoryId: z.string().min(1), 
		sku: z.string().optional(), 
		description: z.string().optional(),
		unitSize: z.string().optional(),
		packSize: z.string().optional()
	})
	type ProductForm = z.infer<typeof productSchema>
	const productForm = useForm<ProductForm>({ resolver: zodResolver(productSchema), defaultValues: { name: '', categoryId: '', unitSize: '', packSize: '' } })

	const receiveSchema = z.object({ 
		productId: z.string().min(1),
		purchaseDate: z.string().min(1),
		totalCost: z.string().min(1), 
		supplier: z.string().optional(),
		purchaseQuantity: z.string().min(1), // How many packs you bought
		unitsPerPack: z.string().min(1), // How many sellable units per pack
		expirationDate: z.string().optional(),
		location: z.string().optional()
	})
	type ReceiveForm = z.infer<typeof receiveSchema>
	const receiveForm = useForm<ReceiveForm>({ resolver: zodResolver(receiveSchema), defaultValues: { productId: '', purchaseDate: new Date().toISOString().substring(0, 10), totalCost: '', supplier: '', purchaseQuantity: '', unitsPerPack: '', expirationDate: '', location: '' } })

	async function onAddCategory(values: CategoryForm) {
		if (!team?.id) {
			showError('No team found')
			return
		}
		
		await addWithTeamMeta('productCategories', { name: values.name }, team.id)
		await qc.invalidateQueries({ queryKey: ['productCategories', team.id] })
		categoryForm.reset({ name: '' })
		showSuccess('Category added successfully')
	}

	async function onAddProduct(values: ProductForm) {
		if (!team?.id) {
			showError('No team found')
			return
		}
		
		const productData = {
			name: values.name,
			categoryId: values.categoryId,
			sku: values.sku || undefined,
			description: values.description || undefined,
			unitSize: values.unitSize || undefined,
			packSize: values.packSize ? Number(values.packSize) || undefined : undefined,
		}
		
		await addWithTeamMeta('products', productData, team.id)
		await qc.invalidateQueries({ queryKey: ['products', team.id] })
		productForm.reset({ name: '', categoryId: '', unitSize: '', packSize: '' })
		showSuccess('Product added successfully')
	}

	async function onReceive(values: ReceiveForm) {
		if (!team?.id) {
			showError('No team found')
			return
		}
		
		const purchaseQuantity = Math.max(1, Math.floor(Number(values.purchaseQuantity)))
		const unitsPerPack = Math.max(1, Math.floor(Number(values.unitsPerPack)))
		const totalUnits = purchaseQuantity * unitsPerPack // Total sellable units
		
		const inventoryData = {
			productId: values.productId,
			purchaseDate: new Date(values.purchaseDate),
			totalCost: Math.round(Number(values.totalCost) * 100) || 0, // Convert to cents
			supplier: values.supplier || undefined,
			purchaseQuantity: purchaseQuantity, // How many packs purchased
			unitsPerPack: unitsPerPack, // Units per pack
			initialQuantity: totalUnits, // Total sellable units
			currentStock: totalUnits, // Current sellable units available
			expirationDate: values.expirationDate ? new Date(values.expirationDate) : undefined,
			location: values.location || undefined,
		}
		
		await addWithTeamMeta('inventory', inventoryData, team.id)
		await qc.invalidateQueries({ queryKey: ['inventory', team.id] })
		receiveForm.reset({ productId: '', purchaseDate: new Date().toISOString().substring(0, 10), totalCost: '', supplier: '', purchaseQuantity: '', unitsPerPack: '', expirationDate: '', location: '' })
		showSuccess('Inventory received successfully')
	}
	return (
		<>
		<Box>
			<Typography variant="h4" gutterBottom>Inventory</Typography>
			<Tabs 
				value={tab} 
				onChange={(_, v) => setTab(v)} 
				aria-label="inventory tabs"
				variant="scrollable"
				scrollButtons="auto"
				allowScrollButtonsMobile
			>
				<Tab label="Products & Categories" />
				<Tab label="Receive Inventory" />
			</Tabs>
			<TabPanel value={tab} index={0}>
				<Stack spacing={2}>
					<Accordion defaultExpanded={false}>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Typography variant="h6">Add Category</Typography>
						</AccordionSummary>
						<AccordionDetails>
							<Stack component="form" spacing={2} onSubmit={categoryForm.handleSubmit(onAddCategory)}>
								<TextField label="Name" {...categoryForm.register('name')} />
								<Button type="submit">Save Category</Button>
							</Stack>
						</AccordionDetails>
                    </Accordion>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Categories</Typography>
                        {categoriesQuery.isLoading ? 'Loading...' : (
							isMobile ? (
								<Stack spacing={2}>
									{categoriesQuery.data?.map((c) => (
										<Paper key={c.id} sx={{ p: 2 }} variant="outlined">
											<Stack spacing={1}>
												<TextField label="Name" defaultValue={c.name} size="small" onBlur={(e) => updateWithMeta('productCategories', c.id, { name: e.target.value } as any)} />
												<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Category', message: 'Delete this category? This cannot be undone.', onConfirm: async () => {
													try {
														if (!team?.id) {
															showError('No team found')
															return
														}
														const inUse = await existsTeamWhere('products', 'categoryId', c.id, team.id)
														if (inUse) { showError('Cannot delete: category in use by products') }
														else {
															await deleteById('productCategories', c.id)
															await qc.invalidateQueries({ queryKey: ['productCategories', team.id] })
															showSuccess('Category deleted')
														}
													} catch (e: any) { showError(e.message || 'Delete failed') }
												} })}>Delete</Button>
											</Stack>
										</Paper>
									))}
								</Stack>
							) : (
								<TableContainer>
									<Table size="small">
										<TableHead>
											<TableRow>
												<TableCell>Name</TableCell>
												<TableCell align="right">Actions</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{categoriesQuery.data?.map((c) => (
												<TableRow key={c.id}>
													<TableCell>
														<TextField defaultValue={c.name} size="small" onBlur={(e) => updateWithMeta('productCategories', c.id, { name: e.target.value } as any)} />
													</TableCell>
													<TableCell align="right">
														<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Category', message: 'Delete this category? This cannot be undone.', onConfirm: async () => {
															try {
																if (!team?.id) {
																	showError('No team found')
																	return
																}
																const inUse = await existsTeamWhere('products', 'categoryId', c.id, team.id)
																if (inUse) { showError('Cannot delete: category in use by products') }
																else {
																	await deleteById('productCategories', c.id)
																	await qc.invalidateQueries({ queryKey: ['productCategories', team.id] })
																	showSuccess('Category deleted')
																}
															} catch (e: any) { showError(e.message || 'Delete failed') }
														} })}>Delete</Button>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</TableContainer>
							)
                        )}
                    </Paper>
					<Accordion defaultExpanded={false}>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Typography variant="h6">Add Product</Typography>
						</AccordionSummary>
						<AccordionDetails>
							<Stack component="form" spacing={2} onSubmit={productForm.handleSubmit(onAddProduct)}>
								<TextField label="Name" {...productForm.register('name')} />
								<TextField select label="Category" SelectProps={{ native: true }} {...productForm.register('categoryId')}>
									<option value=""></option>
									{categoriesQuery.data?.map((c) => (
										<option key={c.id} value={c.id}>{c.name}</option>
									))}
								</TextField>
								<TextField label="SKU (optional)" {...productForm.register('sku')} />
								<TextField label="Description (optional)" {...productForm.register('description')} />
								<TextField label="Unit Size (optional)" placeholder="e.g., 12oz Can, 1.5oz Bag" {...productForm.register('unitSize')} />
								<TextField label="Pack Size (optional)" type="number" placeholder="e.g., 24, 32" inputProps={{ min: 1 }} {...productForm.register('packSize')} />
								<Button type="submit">Save Product</Button>
							</Stack>
						</AccordionDetails>
                    </Accordion>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Products</Typography>
                        {productsQuery.isLoading ? 'Loading...' : (
							isMobile ? (
								<Stack spacing={2}>
									{productsQuery.data?.map((p) => (
										<Paper key={p.id} sx={{ p: 2 }} variant="outlined">
											<Stack spacing={1}>
												<TextField label="Name" defaultValue={p.name} size="small" onBlur={(e) => updateWithMeta('products', p.id, { name: e.target.value } as any)} />
												<TextField select label="Category" size="small" defaultValue={(p as any).categoryId} SelectProps={{ native: true }} onChange={(e) => updateWithMeta('products', p.id, { categoryId: e.target.value } as any)}>
													{categoriesQuery.data?.map((c) => (
														<option key={c.id} value={c.id}>{c.name}</option>
													))}
												</TextField>
												<TextField label="SKU" size="small" defaultValue={(p as any).sku ?? ''} onBlur={(e) => updateWithMeta('products', p.id, { sku: e.target.value || undefined } as any)} />
												<TextField label="Description" size="small" defaultValue={(p as any).description ?? ''} onBlur={(e) => updateWithMeta('products', p.id, { description: e.target.value || undefined } as any)} />
												<TextField label="Unit Size" size="small" placeholder="12oz Can, 1.5oz Bag" defaultValue={(p as any).unitSize ?? ''} onBlur={(e) => updateWithMeta('products', p.id, { unitSize: e.target.value || undefined } as any)} />
												<TextField label="Pack Size" type="number" size="small" placeholder="24, 32" defaultValue={(p as any).packSize ?? ''} onBlur={(e) => updateWithMeta('products', p.id, { packSize: Number(e.target.value) || undefined } as any)} />
												<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Product', message: 'Delete this product? This cannot be undone.', onConfirm: async () => {
													try {
														if (!team?.id) {
															showError('No team found')
															return
														}
														const inUse = await existsTeamWhere('inventory', 'productId', p.id, team.id)
														if (inUse) { showError('Cannot delete: product exists in inventory') }
														else {
															await deleteById('products', p.id)
															await qc.invalidateQueries({ queryKey: ['products', team.id] })
															showSuccess('Product deleted')
														}
													} catch (e: any) { showError(e.message || 'Delete failed') }
												} })}>Delete</Button>
											</Stack>
										</Paper>
									))}
								</Stack>
							) : (
								<TableContainer>
									<Table size="small">
										<TableHead>
											<TableRow>
												<TableCell>Name</TableCell>
												<TableCell>Category</TableCell>
												<TableCell>SKU</TableCell>
												<TableCell>Description</TableCell>
												<TableCell>Unit Size</TableCell>
												<TableCell>Pack Size</TableCell>
												<TableCell align="right">Actions</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{productsQuery.data?.map((p) => (
												<TableRow key={p.id}>
													<TableCell>
														<TextField defaultValue={p.name} size="small" onBlur={(e) => updateWithMeta('products', p.id, { name: e.target.value } as any)} />
													</TableCell>
													<TableCell>
														<TextField select size="small" defaultValue={(p as any).categoryId} SelectProps={{ native: true }} onChange={(e) => updateWithMeta('products', p.id, { categoryId: e.target.value } as any)}>
															{categoriesQuery.data?.map((c) => (
																<option key={c.id} value={c.id}>{c.name}</option>
															))}
														</TextField>
													</TableCell>
													<TableCell>
														<TextField size="small" defaultValue={(p as any).sku ?? ''} onBlur={(e) => updateWithMeta('products', p.id, { sku: e.target.value || undefined } as any)} />
													</TableCell>
													<TableCell>
														<TextField size="small" defaultValue={(p as any).description ?? ''} onBlur={(e) => updateWithMeta('products', p.id, { description: e.target.value || undefined } as any)} />
													</TableCell>
													<TableCell>
														<TextField size="small" placeholder="12oz Can" defaultValue={(p as any).unitSize ?? ''} onBlur={(e) => updateWithMeta('products', p.id, { unitSize: e.target.value || undefined } as any)} />
													</TableCell>
													<TableCell>
														<TextField type="number" size="small" placeholder="24" defaultValue={(p as any).packSize ?? ''} onBlur={(e) => updateWithMeta('products', p.id, { packSize: Number(e.target.value) || undefined } as any)} />
													</TableCell>
													<TableCell align="right">
														<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Product', message: 'Delete this product? This cannot be undone.', onConfirm: async () => {
															try {
																if (!team?.id) {
																	showError('No team found')
																	return
																}
																const inUse = await existsTeamWhere('inventory', 'productId', p.id, team.id)
																if (inUse) { showError('Cannot delete: product exists in inventory') }
																else {
																	await deleteById('products', p.id)
																	await qc.invalidateQueries({ queryKey: ['products', team.id] })
																	showSuccess('Product deleted')
																}
															} catch (e: any) { showError(e.message || 'Delete failed') }
														} })}>Delete</Button>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</TableContainer>
							)
                        )}
                    </Paper>
				</Stack>
			</TabPanel>
			<TabPanel value={tab} index={1}>
				<Stack spacing={2}>
					<Accordion defaultExpanded={false}>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Typography variant="h6">Receive Inventory</Typography>
						</AccordionSummary>
						<AccordionDetails>
							<Stack component="form" spacing={2} onSubmit={receiveForm.handleSubmit(onReceive)}>
								<TextField select label="Product" SelectProps={{ native: true }} {...receiveForm.register('productId')}>
									<option value=""></option>
									{productsQuery.data?.map((p) => (
										<option key={p.id} value={p.id}>{p.name}</option>
									))}
								</TextField>
								<TextField 
									type="date" 
									label="Purchase Date" 
									helperText="Automatically set to today (you can change if needed)"
									InputLabelProps={{ shrink: true }}
									{...receiveForm.register('purchaseDate')} 
								/>
								<TextField 
									type="number" 
									label="Total Cost (USD)" 
									placeholder="e.g., 24.00"
									inputProps={{ step: '0.01', min: 0 }} 
									{...receiveForm.register('totalCost')} 
								/>
								<TextField 
									label="Store (optional)" 
									placeholder="e.g., Costco, Sam's Club, Walmart"
									{...receiveForm.register('supplier')} 
								/>
								<TextField 
									type="number" 
									label="Packs Purchased" 
									placeholder="e.g., 1"
									inputProps={{ min: 1, step: 1 }} 
									{...receiveForm.register('purchaseQuantity')} 
								/>
								<TextField 
									type="number" 
									label="Sellable Units per Pack" 
									placeholder="e.g., 24 (cans in a 24-pack)"
									inputProps={{ min: 1, step: 1 }} 
									{...receiveForm.register('unitsPerPack')} 
								/>
								<TextField 
									type="date" 
									label="Expiration Date (optional)" 
									InputLabelProps={{ shrink: true }}
									{...receiveForm.register('expirationDate')} 
								/>
								<TextField 
									label="Location (optional)" 
									placeholder="e.g., Building A - Floor 2, Main Lobby"
									{...receiveForm.register('location')} 
								/>
								<Button type="submit">Receive Inventory</Button>
							</Stack>
						</AccordionDetails>
					</Accordion>
					<Paper sx={{ p: 2 }}>
						<Typography variant="h6" gutterBottom>Inventory</Typography>
						{inventoryQuery.isLoading ? 'Loading...' : (
							isMobile ? (
								<Stack spacing={2}>
									{inventoryQuery.data?.map((inv) => {
										const productName = productsQuery.data?.find((p) => p.id === inv.productId)?.name || inv.productId
										const purchaseDate = (inv as any).purchaseDate 
											? new Date((inv as any).purchaseDate.toDate ? (inv as any).purchaseDate.toDate() : (inv as any).purchaseDate).toLocaleDateString()
											: ''
										const totalCost = ((inv as any).totalCost || 0) / 100
										const supplier = (inv as any).supplier || ''
										const purchaseQuantity = (inv as any).purchaseQuantity || 1
										const unitsPerPack = (inv as any).unitsPerPack || inv.initialQuantity
										const unitCost = totalCost / (purchaseQuantity * unitsPerPack) // Cost per individual sellable unit
										const expiring = isExpiringSoon((inv as any).expirationDate)
										return (
											<Paper 
												key={inv.id} 
												sx={{ 
													p: 2, 
													backgroundColor: expiring ? 'warning.light' : undefined 
												}} 
												variant="outlined"
											>
												<Stack spacing={1}>
													<Typography variant="subtitle1">{productName}</Typography>
													<Typography variant="body2" color="text.secondary">
														Purchased {purchaseQuantity} pack(s) × {unitsPerPack} units on {purchaseDate}
														{supplier && ` from ${supplier}`}
														{totalCost > 0 && ` ($${totalCost.toFixed(2)} total, $${unitCost.toFixed(2)} per unit)`}
													</Typography>
													{(inv as any).location && (
														<Typography variant="body2" color="text.secondary">
															📍 {(inv as any).location}
														</Typography>
													)}
													{(inv as any).expirationDate && (
														<Typography 
															variant="body2" 
															color={expiring ? "warning.dark" : "text.secondary"}
															sx={{ fontWeight: expiring ? 'bold' : 'normal' }}
														>
															⏰ Expires: {new Date((inv as any).expirationDate.toDate ? (inv as any).expirationDate.toDate() : (inv as any).expirationDate).toLocaleDateString()}
														</Typography>
													)}
													<TextField label="Initial Qty" type="number" size="small" defaultValue={inv.initialQuantity} inputProps={{ min: 0, step: 1 }} onBlur={async (e) => {
														const next = Math.max(0, Math.floor(Number(e.target.value)))
														if (next < inv.currentStock) { showError('Initial quantity cannot be less than current stock'); e.target.value = String(inv.initialQuantity); return }
														try {
															await updateWithMeta('inventory', inv.id, { initialQuantity: next } as any)
															await qc.invalidateQueries({ queryKey: ['inventory', team?.id] })
															showSuccess('Initial quantity updated')
														} catch (err: any) { showError(err.message || 'Update failed') }
													}} />
													<TextField label="Current Stock" type="number" size="small" defaultValue={inv.currentStock} inputProps={{ min: 0, step: 1 }} onBlur={async (e) => {
														const next = Math.max(0, Math.floor(Number(e.target.value)))
														if (next > inv.initialQuantity) { showError('Current stock cannot exceed initial quantity'); e.target.value = String(inv.currentStock); return }
														try {
															await updateWithMeta('inventory', inv.id, { currentStock: next } as any)
															await qc.invalidateQueries({ queryKey: ['inventory', team?.id] })
															showSuccess('Current stock updated')
														} catch (err: any) { showError(err.message || 'Update failed') }
													}} />
													<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Inventory', message: 'Delete this inventory receipt? Only allowed if no sales exist for it.', onConfirm: async () => {
														try {
															if (!team?.id) {
																showError('No team found')
																return
															}
															const hasSales = await existsTeamWhere('sales', 'inventoryId', inv.id, team.id)
															if (hasSales) { showError('Cannot delete: sales exist for this inventory') }
															else {
																await deleteById('inventory', inv.id)
																await qc.invalidateQueries({ queryKey: ['inventory', team.id] })
																showSuccess('Inventory deleted')
															}
														} catch (e: any) { showError(e.message || 'Delete failed') }
													} })}>Delete</Button>
												</Stack>
											</Paper>
										)
									})}
								</Stack>
							) : (
								<TableContainer>
									<Table size="small">
										<TableHead>
											<TableRow>
												<TableCell>Product</TableCell>
												<TableCell>Purchase Info</TableCell>
												<TableCell>Location</TableCell>
												<TableCell>Expiration</TableCell>
												<TableCell align="right">Initial Qty</TableCell>
												<TableCell align="right">Current Stock</TableCell>
												<TableCell align="right">Actions</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{inventoryQuery.data?.map((inv) => {
												const productName = productsQuery.data?.find((p) => p.id === inv.productId)?.name || inv.productId
												const purchaseDate = (inv as any).purchaseDate 
													? new Date((inv as any).purchaseDate.toDate ? (inv as any).purchaseDate.toDate() : (inv as any).purchaseDate).toLocaleDateString()
													: ''
												const totalCost = ((inv as any).totalCost || 0) / 100
												const supplier = (inv as any).supplier || ''
												const purchaseQuantity = (inv as any).purchaseQuantity || 1
												const unitsPerPack = (inv as any).unitsPerPack || inv.initialQuantity
												const unitCost = totalCost / (purchaseQuantity * unitsPerPack)
												const purchaseInfo = `${purchaseDate} ${supplier ? `from ${supplier}` : ''} ${totalCost > 0 ? `($${totalCost.toFixed(2)} total, $${unitCost.toFixed(2)}/unit)` : ''}`
												const expiring = isExpiringSoon((inv as any).expirationDate)
												const expirationDisplay = (inv as any).expirationDate 
													? new Date((inv as any).expirationDate.toDate ? (inv as any).expirationDate.toDate() : (inv as any).expirationDate).toLocaleDateString()
													: ''
												return (
													<TableRow 
														key={inv.id}
														sx={{ backgroundColor: expiring ? 'warning.light' : undefined }}
													>
														<TableCell>{productName}</TableCell>
														<TableCell>{purchaseInfo}</TableCell>
														<TableCell>{(inv as any).location || ''}</TableCell>
														<TableCell 
															sx={{ 
																fontWeight: expiring ? 'bold' : 'normal',
																color: expiring ? 'warning.dark' : undefined
															}}
														>
															{expirationDisplay && `${expirationDisplay}${expiring ? ' ⚠️' : ''}`}
														</TableCell>
														<TableCell align="right">
															<TextField
																type="number"
																size="small"
																defaultValue={inv.initialQuantity}
																inputProps={{ min: 0, step: 1, style: { textAlign: 'right' } }}
																onBlur={async (e) => {
																	const next = Math.max(0, Math.floor(Number(e.target.value)))
																	if (next < inv.currentStock) { showError('Initial quantity cannot be less than current stock'); e.target.value = String(inv.initialQuantity); return }
																	try {
																		await updateWithMeta('inventory', inv.id, { initialQuantity: next } as any)
																		await qc.invalidateQueries({ queryKey: ['inventory', team?.id] })
																		showSuccess('Initial quantity updated')
																	} catch (err: any) { showError(err.message || 'Update failed') }
																}}
															/>
														</TableCell>
														<TableCell align="right">
															<TextField
																type="number"
																size="small"
																defaultValue={inv.currentStock}
																inputProps={{ min: 0, step: 1, style: { textAlign: 'right' } }}
																onBlur={async (e) => {
																	const next = Math.max(0, Math.floor(Number(e.target.value)))
																	if (next > inv.initialQuantity) { showError('Current stock cannot exceed initial quantity'); e.target.value = String(inv.currentStock); return }
																	try {
																		await updateWithMeta('inventory', inv.id, { currentStock: next } as any)
																		await qc.invalidateQueries({ queryKey: ['inventory', team?.id] })
																		showSuccess('Current stock updated')
																	} catch (err: any) { showError(err.message || 'Update failed') }
																}}
															/>
														</TableCell>
														<TableCell align="right">
															<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Inventory', message: 'Delete this inventory receipt? Only allowed if no sales exist for it.', onConfirm: async () => {
																try {
																	if (!team?.id) {
																		showError('No team found')
																		return
																	}
																	const hasSales = await existsTeamWhere('sales', 'inventoryId', inv.id, team.id)
																	if (hasSales) { showError('Cannot delete: sales exist for this inventory') }
																	else {
																		await deleteById('inventory', inv.id)
																		await qc.invalidateQueries({ queryKey: ['inventory', team.id] })
																		showSuccess('Inventory deleted')
																	}
																} catch (e: any) { showError(e.message || 'Delete failed') }
															} })}>Delete</Button>
														</TableCell>
													</TableRow>
												)
											})}
										</TableBody>
									</Table>
								</TableContainer>
							)
						)}
					</Paper>
				</Stack>
			</TabPanel>
		</Box>
		<ConfirmDialog open={confirm.open} title={confirm.title} message={confirm.message} onClose={() => setConfirm({ ...confirm, open: false })} onConfirm={async () => { await confirm.onConfirm(); setConfirm({ ...confirm, open: false }) }} />
		<Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
			<Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%' }}>
				{snack.message}
			</Alert>
		</Snackbar>
		</>
	)
}


