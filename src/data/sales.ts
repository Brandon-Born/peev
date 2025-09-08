import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../modules/firebase'
import { getUserProfile } from './firestore'

interface SaleItemData {
	inventoryId: string
	quantitySold: number
	pricePerItemCents: number
}

interface TransactionData {
	items: SaleItemData[]
	customerName?: string
	tax?: number // cents
	discount?: number // cents
}

export async function recordSaleTransaction(data: TransactionData) {
	const uid = auth.currentUser?.uid
	if (!uid) throw new Error('Not authenticated')

	if (data.items.length === 0) {
		throw new Error('Transaction must contain at least one item')
	}

	// Get user's team
	const userProfile = await getUserProfile(uid)
	if (!userProfile?.teamId) {
		throw new Error('User not assigned to a team')
	}

	await runTransaction(db, async (transaction) => {
		// 1. Read and validate all inventory documents
		const inventoryUpdates: Array<{ ref: any; currentStock: number; newStock: number }> = []
		let subtotal = 0

		for (const item of data.items) {
			const inventoryRef = doc(db, 'inventory', item.inventoryId)
			const inventorySnap = await transaction.get(inventoryRef)
			
			if (!inventorySnap.exists()) {
				throw new Error(`Inventory not found: ${item.inventoryId}`)
			}
			
			const inventory = inventorySnap.data()

			// Check team ownership
			if (inventory.teamId !== userProfile.teamId) {
				throw new Error('Not authorized')
			}

			// Check sufficient stock
			if (inventory.currentStock < item.quantitySold) {
				throw new Error(`Insufficient stock for item. Available: ${inventory.currentStock}, Requested: ${item.quantitySold}`)
			}

			inventoryUpdates.push({
				ref: inventoryRef,
				currentStock: inventory.currentStock,
				newStock: inventory.currentStock - item.quantitySold
			})

			subtotal += item.pricePerItemCents * item.quantitySold
		}

		// 2. Calculate totals
		const tax = data.tax || 0
		const discount = data.discount || 0
		const total = subtotal + tax - discount

		// 3. Create transaction document
		const transactionsRef = collection(db, 'transactions')
		const transactionData = {
			saleDate: serverTimestamp(),
			customerName: data.customerName || null,
			subtotal,
			tax: tax || null,
			discount: discount || null,
			total,
			teamId: userProfile.teamId,
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
		}
		const transactionRef = doc(transactionsRef)
		transaction.set(transactionRef, transactionData)

		// 4. Create sale items
		const saleItemsRef = collection(db, 'saleItems')
		for (const item of data.items) {
			const lineTotal = item.pricePerItemCents * item.quantitySold
			const saleItemData = {
				transactionId: transactionRef.id,
				inventoryId: item.inventoryId,
				quantitySold: item.quantitySold,
				pricePerItem: item.pricePerItemCents,
				lineTotal,
				teamId: userProfile.teamId,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
			}
			const saleItemRef = doc(saleItemsRef)
			transaction.set(saleItemRef, saleItemData)
		}

		// 5. Update inventory stock
		for (const update of inventoryUpdates) {
			transaction.update(update.ref, {
				currentStock: update.newStock,
				updatedAt: serverTimestamp(),
			})
		}
	})
}

// Legacy function for backward compatibility during migration
interface LegacySaleTransactionData {
	inventoryId: string
	quantitySold: number
	pricePerItemCents: number
}

export async function recordLegacySaleTransaction(data: LegacySaleTransactionData) {
	// Convert to new format and call main function
	await recordSaleTransaction({
		items: [{
			inventoryId: data.inventoryId,
			quantitySold: data.quantitySold,
			pricePerItemCents: data.pricePerItemCents
		}]
	})
}