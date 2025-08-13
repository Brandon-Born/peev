import { Typography, Tabs, Tab, Box, Stack, TextField, Button, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Accordion, AccordionSummary, AccordionDetails, Snackbar, Alert, useMediaQuery, useTheme } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { addWithMeta, deleteById, listByOwner, updateWithMeta, existsWhere } from '../data/firestore'
import { auth } from '../modules/firebase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shipment, ProductCategory, Product, InventoryItem } from '../domain/models'
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
	const theme = useTheme()
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
	const [tab, setTab] = React.useState(0)
	const qc = useQueryClient()
	const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
	const [confirm, setConfirm] = React.useState<{ open: boolean; title: string; message: string; onConfirm: () => Promise<void> }>({ open: false, title: '', message: '', onConfirm: async () => {} })

	function showSuccess(message: string) { setSnack({ open: true, message, severity: 'success' }) }
	function showError(message: string) { setSnack({ open: true, message, severity: 'error' }) }

	async function tryClaimOwnership(path: string, id: string) {
		try { await updateWithMeta<any>(path, id, { ownerUid: auth.currentUser?.uid } as any) } catch {}
	}

	// Queries
	const shipmentsQuery = useQuery({ queryKey: ['shipments'], queryFn: () => listByOwner<Shipment>('shipments') })
	const categoriesQuery = useQuery({ queryKey: ['productCategories'], queryFn: () => listByOwner<ProductCategory>('productCategories') })
	const productsQuery = useQuery({ queryKey: ['products'], queryFn: () => listByOwner<Product>('products') })
    const inventoryQuery = useQuery({ queryKey: ['inventory'], queryFn: () => listByOwner<InventoryItem>('inventory') })

	// Forms
	const shipmentSchema = z.object({ name: z.string().min(1), purchaseDate: z.string().min(1), totalCost: z.string().min(1), supplier: z.string().optional() })
	type ShipmentForm = z.infer<typeof shipmentSchema>
	const shipmentForm = useForm<ShipmentForm>({ resolver: zodResolver(shipmentSchema), defaultValues: { name: '', purchaseDate: '', totalCost: '' } })

	const categorySchema = z.object({ name: z.string().min(1) })
	type CategoryForm = z.infer<typeof categorySchema>
	const categoryForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: { name: '' } })

	const productSchema = z.object({ name: z.string().min(1), categoryId: z.string().min(1), sku: z.string().optional(), description: z.string().optional() })
	type ProductForm = z.infer<typeof productSchema>
	const productForm = useForm<ProductForm>({ resolver: zodResolver(productSchema), defaultValues: { name: '', categoryId: '' } })

	const receiveSchema = z.object({ productId: z.string().min(1), shipmentId: z.string().min(1), quantity: z.string().min(1) })
	type ReceiveForm = z.infer<typeof receiveSchema>
	const receiveForm = useForm<ReceiveForm>({ resolver: zodResolver(receiveSchema), defaultValues: { productId: '', shipmentId: '', quantity: '' } })

	async function onAddShipment(values: ShipmentForm) {
		await addWithMeta('shipments', {
			name: values.name,
			purchaseDate: new Date(values.purchaseDate),
			totalCost: Math.round(Number(values.totalCost) * 100) || 0,
			supplier: values.supplier || undefined,
		})
		await qc.invalidateQueries({ queryKey: ['shipments'] })
		shipmentForm.reset({ name: '', purchaseDate: '', totalCost: '' })
	}

	async function onAddCategory(values: CategoryForm) {
		await addWithMeta('productCategories', { name: values.name })
		await qc.invalidateQueries({ queryKey: ['productCategories'] })
		categoryForm.reset({ name: '' })
	}

	async function onAddProduct(values: ProductForm) {
		await addWithMeta('products', values)
		await qc.invalidateQueries({ queryKey: ['products'] })
		productForm.reset({ name: '', categoryId: '' })
	}

	async function onReceive(values: ReceiveForm) {
		const qty = Math.max(0, Math.floor(Number(values.quantity)))
		await addWithMeta('inventory', {
			productId: values.productId,
			shipmentId: values.shipmentId,
			initialQuantity: qty,
			currentStock: qty,
		})
		await qc.invalidateQueries({ queryKey: ['inventory'] })
		receiveForm.reset({ productId: '', shipmentId: '', quantity: '' })
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
				<Tab label="Shipments" />
				<Tab label="Products & Categories" />
				<Tab label="Receive Inventory" />
			</Tabs>
			<TabPanel value={tab} index={0}>
				<Stack spacing={2}>
					<Accordion defaultExpanded={false}>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Typography variant="h6">Add Shipment</Typography>
						</AccordionSummary>
						<AccordionDetails>
							<Stack component="form" spacing={2} onSubmit={shipmentForm.handleSubmit(onAddShipment)}>
								<TextField label="Name" {...shipmentForm.register('name')} />
								<TextField type="date" label="Purchase Date" InputLabelProps={{ shrink: true }} {...shipmentForm.register('purchaseDate')} />
								<TextField type="number" label="Total Cost (USD)" inputProps={{ step: '0.01' }} {...shipmentForm.register('totalCost')} />
								<TextField label="Supplier (optional)" {...shipmentForm.register('supplier')} />
								<Button type="submit">Save Shipment</Button>
							</Stack>
						</AccordionDetails>
					</Accordion>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Shipments</Typography>
                        {shipmentsQuery.isLoading ? 'Loading...' : (
							isMobile ? (
								<Stack spacing={2}>
									{shipmentsQuery.data?.map((s) => (
										<Paper key={s.id} sx={{ p: 2 }} variant="outlined">
											<Stack spacing={1}>
												<TextField label="Name" defaultValue={s.name} size="small" onBlur={(e) => updateWithMeta('shipments', s.id, { name: e.target.value })} />
												<TextField label="Purchase Date" type="date" size="small" defaultValue={new Date((s as any).purchaseDate?.toDate?.() ?? (s as any).purchaseDate ?? new Date()).toISOString().substring(0,10)} onBlur={(e) => updateWithMeta('shipments', s.id, { purchaseDate: new Date(e.target.value) } as any)} />
												<TextField label="Total Cost" type="number" size="small" defaultValue={((s as any).totalCost ?? 0)/100} onBlur={(e) => updateWithMeta('shipments', s.id, { totalCost: Math.round(Number(e.target.value)*100) } as any)} />
												<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Shipment', message: 'Are you sure you want to delete this shipment?', onConfirm: async () => {
													try {
														const inUse = await existsWhere('inventory', 'shipmentId', s.id)
														if (inUse) { showError('Cannot delete: shipment has inventory items') }
														else {
															await tryClaimOwnership('shipments', s.id)
															await deleteById('shipments', s.id)
															await qc.invalidateQueries({ queryKey: ['shipments'] })
															showSuccess('Shipment deleted')
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
												<TableCell>Purchase Date</TableCell>
												<TableCell align="right">Total Cost</TableCell>
												<TableCell align="right">Actions</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{shipmentsQuery.data?.map((s) => (
												<TableRow key={s.id}>
													<TableCell>
														<TextField defaultValue={s.name} size="small" onBlur={(e) => updateWithMeta('shipments', s.id, { name: e.target.value })} />
													</TableCell>
													<TableCell>
														<TextField type="date" size="small" defaultValue={new Date((s as any).purchaseDate?.toDate?.() ?? (s as any).purchaseDate ?? new Date()).toISOString().substring(0,10)} onBlur={(e) => updateWithMeta('shipments', s.id, { purchaseDate: new Date(e.target.value) } as any)} />
													</TableCell>
													<TableCell align="right">
														<TextField type="number" size="small" defaultValue={((s as any).totalCost ?? 0)/100} onBlur={(e) => updateWithMeta('shipments', s.id, { totalCost: Math.round(Number(e.target.value)*100) } as any)} />
													</TableCell>
													<TableCell align="right">
														<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Shipment', message: 'Are you sure you want to delete this shipment?', onConfirm: async () => {
															try {
																const inUse = await existsWhere('inventory', 'shipmentId', s.id)
																if (inUse) { showError('Cannot delete: shipment has inventory items') }
																else {
																	await tryClaimOwnership('shipments', s.id)
																	await deleteById('shipments', s.id)
																	await qc.invalidateQueries({ queryKey: ['shipments'] })
																	showSuccess('Shipment deleted')
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
														const inUse = await existsWhere('products', 'categoryId', c.id)
														if (inUse) { showError('Cannot delete: category in use by products') }
														else {
															await tryClaimOwnership('productCategories', c.id)
															await deleteById('productCategories', c.id)
															await qc.invalidateQueries({ queryKey: ['productCategories'] })
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
																const inUse = await existsWhere('products', 'categoryId', c.id)
																if (inUse) { showError('Cannot delete: category in use by products') }
																else {
																	await tryClaimOwnership('productCategories', c.id)
																	await deleteById('productCategories', c.id)
																	await qc.invalidateQueries({ queryKey: ['productCategories'] })
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
												<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Product', message: 'Delete this product? This cannot be undone.', onConfirm: async () => {
													try {
														const inUse = await existsWhere('inventory', 'productId', p.id)
														if (inUse) { showError('Cannot delete: product exists in inventory') }
														else {
															await tryClaimOwnership('products', p.id)
															await deleteById('products', p.id)
															await qc.invalidateQueries({ queryKey: ['products'] })
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
													<TableCell align="right">
														<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Product', message: 'Delete this product? This cannot be undone.', onConfirm: async () => {
															try {
																const inUse = await existsWhere('inventory', 'productId', p.id)
																if (inUse) { showError('Cannot delete: product exists in inventory') }
																else {
																	await tryClaimOwnership('products', p.id)
																	await deleteById('products', p.id)
																	await qc.invalidateQueries({ queryKey: ['products'] })
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
			<TabPanel value={tab} index={2}>
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
								<TextField select label="Shipment" SelectProps={{ native: true }} {...receiveForm.register('shipmentId')}>
									<option value=""></option>
									{shipmentsQuery.data?.map((s) => (
										<option key={s.id} value={s.id}>{s.name}</option>
									))}
								</TextField>
								<TextField type="number" label="Quantity" inputProps={{ min: 0, step: 1 }} {...receiveForm.register('quantity')} />
								<Button type="submit">Receive</Button>
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
										const shipmentName = shipmentsQuery.data?.find((s) => s.id === inv.shipmentId)?.name || inv.shipmentId
										return (
											<Paper key={inv.id} sx={{ p: 2 }} variant="outlined">
												<Stack spacing={1}>
													<Typography variant="subtitle1">{productName}</Typography>
													<Typography variant="body2" color="text.secondary">from {shipmentName}</Typography>
													<TextField label="Initial Qty" type="number" size="small" defaultValue={inv.initialQuantity} inputProps={{ min: 0, step: 1 }} onBlur={async (e) => {
														const next = Math.max(0, Math.floor(Number(e.target.value)))
														if (next < inv.currentStock) { showError('Initial quantity cannot be less than current stock'); e.target.value = String(inv.initialQuantity); return }
														try {
															await updateWithMeta('inventory', inv.id, { initialQuantity: next } as any)
															await qc.invalidateQueries({ queryKey: ['inventory'] })
															showSuccess('Initial quantity updated')
														} catch (err: any) { showError(err.message || 'Update failed') }
													}} />
													<TextField label="Current Stock" type="number" size="small" defaultValue={inv.currentStock} inputProps={{ min: 0, step: 1 }} onBlur={async (e) => {
														const next = Math.max(0, Math.floor(Number(e.target.value)))
														if (next > inv.initialQuantity) { showError('Current stock cannot exceed initial quantity'); e.target.value = String(inv.currentStock); return }
														try {
															await updateWithMeta('inventory', inv.id, { currentStock: next } as any)
															await qc.invalidateQueries({ queryKey: ['inventory'] })
															showSuccess('Current stock updated')
														} catch (err: any) { showError(err.message || 'Update failed') }
													}} />
													<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Inventory', message: 'Delete this inventory receipt? Only allowed if no sales exist for it.', onConfirm: async () => {
														try {
															const hasSales = await existsWhere('sales', 'inventoryId', inv.id)
															if (hasSales) { showError('Cannot delete: sales exist for this inventory') }
															else {
																await tryClaimOwnership('inventory', inv.id)
																await deleteById('inventory', inv.id)
																await qc.invalidateQueries({ queryKey: ['inventory'] })
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
												<TableCell>Shipment</TableCell>
												<TableCell align="right">Initial Qty</TableCell>
												<TableCell align="right">Current Stock</TableCell>
												<TableCell align="right">Actions</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{inventoryQuery.data?.map((inv) => {
												const productName = productsQuery.data?.find((p) => p.id === inv.productId)?.name || inv.productId
												const shipmentName = shipmentsQuery.data?.find((s) => s.id === inv.shipmentId)?.name || inv.shipmentId
												return (
													<TableRow key={inv.id}>
														<TableCell>{productName}</TableCell>
														<TableCell>{shipmentName}</TableCell>
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
																		await qc.invalidateQueries({ queryKey: ['inventory'] })
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
																		await qc.invalidateQueries({ queryKey: ['inventory'] })
																		showSuccess('Current stock updated')
																	} catch (err: any) { showError(err.message || 'Update failed') }
																}}
															/>
														</TableCell>
														<TableCell align="right">
															<Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Inventory', message: 'Delete this inventory receipt? Only allowed if no sales exist for it.', onConfirm: async () => {
																try {
																	const hasSales = await existsWhere('sales', 'inventoryId', inv.id)
																	if (hasSales) { showError('Cannot delete: sales exist for this inventory') }
																	else {
																		await tryClaimOwnership('inventory', inv.id)
																		await deleteById('inventory', inv.id)
																		await qc.invalidateQueries({ queryKey: ['inventory'] })
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


