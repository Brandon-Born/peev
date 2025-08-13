import { Typography, Paper, Stack, TextField, Button, Accordion, AccordionSummary, AccordionDetails, Snackbar, Alert } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { listByOwner, deleteById, updateWithMeta } from '../data/firestore'
import { auth } from '../modules/firebase'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InventoryItem, Product } from '../domain/models'
import { recordSaleTransaction } from '../data/sales'

export function SalesPage() {
	const qc = useQueryClient()
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: () => listByOwner<Product>('products') })
  const inventoryQuery = useQuery({ queryKey: ['inventory'], queryFn: () => listByOwner<InventoryItem>('inventory') })
  const salesQuery = useQuery({ queryKey: ['sales'], queryFn: () => listByOwner<any>('sales') })
  const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const [confirm, setConfirm] = React.useState<{ open: boolean; title: string; message: string; onConfirm: () => Promise<void> }>({ open: false, title: '', message: '', onConfirm: async () => {} })

	const saleSchema = z.object({ productId: z.string().min(1), inventoryId: z.string().min(1), quantity: z.string().min(1), priceUsd: z.string().min(1) })
	type SaleForm = z.infer<typeof saleSchema>
	const form = useForm<SaleForm>({ resolver: zodResolver(saleSchema), defaultValues: { productId: '', inventoryId: '', quantity: '', priceUsd: '' } })

	const selectedProductId = form.watch('productId')
	const filteredInventory = (inventoryQuery.data || []).filter((inv) => inv.productId === selectedProductId && inv.currentStock > 0)

	async function onSubmit(values: SaleForm) {
		const qty = Math.max(1, Math.floor(Number(values.quantity)))
		const priceCents = Math.round((Number(values.priceUsd) || 0) * 100)
		await recordSaleTransaction({ inventoryId: values.inventoryId, quantitySold: qty, pricePerItemCents: priceCents })
        await Promise.all([
			qc.invalidateQueries({ queryKey: ['inventory'] }),
			qc.invalidateQueries({ queryKey: ['sales'] }),
		])
		form.reset({ productId: '', inventoryId: '', quantity: '', priceUsd: '' })
	}

  return (
    <>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h4" gutterBottom>Sales Tracker</Typography>
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Record New Sale</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack component="form" spacing={2} onSubmit={form.handleSubmit(onSubmit)}>
                <TextField select label="Product" SelectProps={{ native: true }} {...form.register('productId')}>
                  <option value=""></option>
                  {productsQuery.data?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </TextField>
                <TextField select label="Inventory (Shipment)" SelectProps={{ native: true }} {...form.register('inventoryId')}>
                  <option value=""></option>
                  {filteredInventory.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.shipmentId} — {inv.currentStock} available</option>
                  ))}
                </TextField>
                <TextField type="number" label="Quantity" inputProps={{ min: 1, step: 1 }} {...form.register('quantity')} />
                <TextField type="number" label="Price (USD)" inputProps={{ min: 0, step: '0.01' }} {...form.register('priceUsd')} />
                <Button type="submit">Record Sale</Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Recent Sales</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {(salesQuery.data || []).slice(0, 20).map((s: any) => (
                  <Stack key={s.id} direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2">{s.quantitySold} × ${(s.pricePerItem/100).toFixed(2)} on {new Date((s as any).saleDate?.toDate?.() ?? (s as any).saleDate ?? new Date()).toLocaleDateString()}</Typography>
                    <Button color="error" size="small" onClick={() => setConfirm({ open: true, title: 'Delete Sale', message: 'Delete this sale? This cannot be undone.', onConfirm: async () => { try { await updateWithMeta<any>('sales', s.id, { ownerUid: auth.currentUser?.uid } as any); await deleteById('sales', s.id); await qc.invalidateQueries({ queryKey: ['sales'] }); setSnack({ open: true, message: 'Sale deleted', severity: 'success' }) } catch (e: any) { setSnack({ open: true, message: e.message || 'Delete failed', severity: 'error' }) } } })}>Delete</Button>
                  </Stack>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </Paper>
      <ConfirmDialog open={confirm.open} title={confirm.title} message={confirm.message} onClose={() => setConfirm({ ...confirm, open: false })} onConfirm={async () => { await confirm.onConfirm(); setConfirm({ ...confirm, open: false }) }} />
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </>
  )
}


