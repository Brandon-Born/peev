import { Typography, Tabs, Tab, Box, Stack, TextField, Button, Paper } from '@mui/material'
import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { addWithMeta, listByOwner } from '../data/firestore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shipment, ProductCategory, Product } from '../domain/models'

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
	const { children, value, index, ...other } = props
	return (
		<div role="tabpanel" hidden={value !== index} {...other}>
			{value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
		</div>
	)
}

export function InventoryPage() {
	const [tab, setTab] = React.useState(0)
	const qc = useQueryClient()

	// Queries
	const shipmentsQuery = useQuery({ queryKey: ['shipments'], queryFn: () => listByOwner<Shipment>('shipments') })
	const categoriesQuery = useQuery({ queryKey: ['productCategories'], queryFn: () => listByOwner<ProductCategory>('productCategories') })
	const productsQuery = useQuery({ queryKey: ['products'], queryFn: () => listByOwner<Product>('products') })

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
	return (
		<Box>
			<Typography variant="h4" gutterBottom>Inventory</Typography>
			<Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="inventory tabs">
				<Tab label="Shipments" />
				<Tab label="Products & Categories" />
				<Tab label="Receive Inventory" />
			</Tabs>
			<TabPanel value={tab} index={0}>
				<Stack spacing={2}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="h6">Add Shipment</Typography>
						<Stack component="form" spacing={2} onSubmit={shipmentForm.handleSubmit(onAddShipment)}>
							<TextField label="Name" {...shipmentForm.register('name')} />
							<TextField type="date" label="Purchase Date" InputLabelProps={{ shrink: true }} {...shipmentForm.register('purchaseDate')} />
							<TextField type="number" label="Total Cost (USD)" inputProps={{ step: '0.01' }} {...shipmentForm.register('totalCost')} />
							<TextField label="Supplier (optional)" {...shipmentForm.register('supplier')} />
							<Button type="submit">Save Shipment</Button>
						</Stack>
					</Paper>
					<Paper sx={{ p: 2 }}>
						<Typography variant="h6" gutterBottom>Shipments</Typography>
						{shipmentsQuery.isLoading ? 'Loading...' : (
							<ul>
								{shipmentsQuery.data?.map((s) => (
									<li key={s.id}>{s.name}</li>
								))}
							</ul>
						)}
					</Paper>
				</Stack>
			</TabPanel>
			<TabPanel value={tab} index={1}>
				<Stack spacing={2}>
					<Paper sx={{ p: 2 }}>
						<Typography variant="h6">Add Category</Typography>
						<Stack component="form" spacing={2} onSubmit={categoryForm.handleSubmit(onAddCategory)}>
							<TextField label="Name" {...categoryForm.register('name')} />
							<Button type="submit">Save Category</Button>
						</Stack>
					</Paper>
					<Paper sx={{ p: 2 }}>
						<Typography variant="h6">Add Product</Typography>
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
					</Paper>
				</Stack>
			</TabPanel>
			<TabPanel value={tab} index={2}>Receive inventory and view stock table (to be implemented).</TabPanel>
		</Box>
	)
}


