import { InventoryItem, SaleItem, LegacySale } from '../domain/models'
import { toDate } from '../data/firestore'

interface COGSCalculation {
	totalCOGS: number
	itemizedCOGS: Array<{
		itemId: string
		inventoryId: string
		quantitySold: number
		unitCost: number
		itemCOGS: number
	}>
}

/**
 * Calculate unit cost for an inventory item
 * Unit Cost = totalCost / (purchaseQuantity × unitsPerPack)
 */
export function calculateInventoryUnitCost(inventory: InventoryItem): number {
	// Get purchase information directly from inventory
	const totalCost = (inventory as any).totalCost || 0
	const purchaseQuantity = (inventory as any).purchaseQuantity || 1
	const unitsPerPack = (inventory as any).unitsPerPack || inventory.initialQuantity
	
	const totalUnits = purchaseQuantity * unitsPerPack
	
	// If no units, unit cost is 0
	if (totalUnits === 0) return 0
	
	// Unit cost = totalCost / total sellable units
	return totalCost / totalUnits
}

/**
 * Calculate COGS for sale items using direct inventory cost method
 */
export function calculateSaleItemsCOGS(
	saleItems: SaleItem[],
	inventoryItems: InventoryItem[],
	_shipments?: any[] // Keep for compatibility but ignore
): COGSCalculation {
	const itemizedCOGS: COGSCalculation['itemizedCOGS'] = []
	let totalCOGS = 0

	saleItems.forEach(item => {
		// Find the inventory item for this sale
		const inventory = inventoryItems.find(inv => inv.id === item.inventoryId)
		if (!inventory) return

		// Calculate unit cost directly from inventory purchase data
		const unitCost = calculateInventoryUnitCost(inventory)
		
		// Calculate COGS for this item
		const itemCOGS = unitCost * item.quantitySold

		itemizedCOGS.push({
			itemId: item.id,
			inventoryId: inventory.id,
			quantitySold: item.quantitySold,
			unitCost,
			itemCOGS
		})

		totalCOGS += itemCOGS
	})

	return { totalCOGS, itemizedCOGS }
}

/**
 * Calculate COGS for legacy sales using direct inventory cost method
 */
export function calculateLegacySalesCOGS(
	legacySales: LegacySale[],
	inventoryItems: InventoryItem[],
	_shipments?: any[] // Keep for compatibility but ignore
): COGSCalculation {
	const itemizedCOGS: COGSCalculation['itemizedCOGS'] = []
	let totalCOGS = 0

	legacySales.forEach(sale => {
		// Find the inventory item for this sale
		const inventory = inventoryItems.find(inv => inv.id === sale.inventoryId)
		if (!inventory) return

		// Calculate unit cost directly from inventory purchase data
		const unitCost = calculateInventoryUnitCost(inventory)
		
		// Calculate COGS for this sale
		const itemCOGS = unitCost * sale.quantitySold

		itemizedCOGS.push({
			itemId: sale.id,
			inventoryId: inventory.id,
			quantitySold: sale.quantitySold,
			unitCost,
			itemCOGS
		})

		totalCOGS += itemCOGS
	})

	return { totalCOGS, itemizedCOGS }
}

/**
 * Calculate total COGS for all sales (new + legacy)
 */
export function calculateTotalCOGS(
	saleItems: SaleItem[],
	legacySales: LegacySale[],
	inventoryItems: InventoryItem[],
	_shipments?: any[] // Keep for compatibility but ignore
): number {
	const newSalesCOGS = calculateSaleItemsCOGS(saleItems, inventoryItems)
	const legacySalesCOGS = calculateLegacySalesCOGS(legacySales, inventoryItems)
	
	return newSalesCOGS.totalCOGS + legacySalesCOGS.totalCOGS
}

/**
 * Calculate COGS for a specific date range
 */
export function calculateCOGSForDateRange(
	saleItems: SaleItem[],
	legacySales: LegacySale[],
	inventoryItems: InventoryItem[],
	_shipments?: any[], // Keep for compatibility but ignore
	transactions: any[], // We need transactions to get sale dates for saleItems
	startDate: Date,
	endDate: Date
): number {
	// Filter transactions for date range
	const filteredTransactions = transactions.filter(t => {
		const saleDate = new Date(t.saleDate?.toDate?.() ?? t.saleDate ?? new Date())
		return saleDate >= startDate && saleDate <= endDate
	})
	
	const transactionIds = new Set(filteredTransactions.map(t => t.id))
	
	// Filter sale items for these transactions
	const filteredSaleItems = saleItems.filter(item => transactionIds.has(item.transactionId))
	
	// Filter legacy sales for date range
	const filteredLegacySales = legacySales.filter(sale => {
		const saleDate = toDate(sale.saleDate)
		return saleDate && saleDate >= startDate && saleDate <= endDate
	})
	
	return calculateTotalCOGS(filteredSaleItems, filteredLegacySales, inventoryItems)
}
