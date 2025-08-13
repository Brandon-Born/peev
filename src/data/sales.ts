import { addDoc, collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../modules/firebase'

export async function recordSaleTransaction(params: { inventoryId: string; quantitySold: number; pricePerItemCents: number; saleDate?: Date }) {
	const uid = auth.currentUser?.uid
	if (!uid) throw new Error('Not authenticated')
	const { inventoryId, quantitySold, pricePerItemCents } = params
	if (quantitySold <= 0) throw new Error('Quantity must be > 0')
	if (pricePerItemCents < 0) throw new Error('Price must be >= 0')

	const inventoryRef = doc(db, 'inventory', inventoryId)

	await runTransaction(db, async (tx) => {
		const invSnap = await tx.get(inventoryRef)
		if (!invSnap.exists()) throw new Error('Inventory item not found')
		const inv = invSnap.data() as any
		if (inv.ownerUid !== uid) throw new Error('Forbidden')
		const currentStock: number = inv.currentStock ?? 0
		if (currentStock < quantitySold) throw new Error('Insufficient stock')

		// Decrement stock
		tx.update(inventoryRef, { currentStock: currentStock - quantitySold, updatedAt: serverTimestamp() })

		// Create sale
		const saleRef = doc(collection(db, 'sales'))
		tx.set(saleRef, {
			inventoryId,
			quantitySold,
			pricePerItem: pricePerItemCents,
			saleDate: params.saleDate ?? new Date(),
			ownerUid: uid,
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
		})
	})
}


