import { Shipment, InventoryItem, SaleItem, LegacySale } from '../domain/models'
import { toDate } from '../data/firestore'

interface COGSCalculation {
	totalCOGS: number
	itemizedCOGS: Array<{
		itemId: string
		shipmentId: string
		quantitySold: number
		unitCost: number
		itemCOGS: number
	}>
}

/**
 * Calculate Weighted Average Cost (WAC) for a shipment
 * WAC = totalCost / unitsReceived
 */
export function calculateShipmentWAC(shipment: Shipment, inventoryItems: InventoryItem[]): number {
	// Find all inventory items for this shipment
	const shipmentInventory = inventoryItems.filter(inv => inv.shipmentId === shipment.id)
	
	// Calculate total units received for this shipment
	const unitsReceived = shipmentInventory.reduce((sum, inv) => sum + inv.initialQuantity, 0)
	
	// If no units received, WAC is 0
	if (unitsReceived === 0) return 0
	
	// WAC = totalCost / unitsReceived
	return shipment.totalCost / unitsReceived
}

/**
 * Calculate COGS for sale items using WAC method
 */
export function calculateSaleItemsCOGS(
	saleItems: SaleItem[],
	inventoryItems: InventoryItem[],
	shipments: Shipment[]
): COGSCalculation {
	const itemizedCOGS: COGSCalculation['itemizedCOGS'] = []
	let totalCOGS = 0

	saleItems.forEach(item => {
		// Find the inventory item for this sale
		const inventory = inventoryItems.find(inv => inv.id === item.inventoryId)
		if (!inventory) return

		// Find the shipment for this inventory
		const shipment = shipments.find(s => s.id === inventory.shipmentId)
		if (!shipment) return

		// Calculate WAC for this shipment
		const unitCost = calculateShipmentWAC(shipment, inventoryItems)
		
		// Calculate COGS for this item
		const itemCOGS = unitCost * item.quantitySold

		itemizedCOGS.push({
			itemId: item.id,
			shipmentId: shipment.id,
			quantitySold: item.quantitySold,
			unitCost,
			itemCOGS
		})

		totalCOGS += itemCOGS
	})

	return { totalCOGS, itemizedCOGS }
}

/**
 * Calculate COGS for legacy sales using WAC method
 */
export function calculateLegacySalesCOGS(
	legacySales: LegacySale[],
	inventoryItems: InventoryItem[],
	shipments: Shipment[]
): COGSCalculation {
	const itemizedCOGS: COGSCalculation['itemizedCOGS'] = []
	let totalCOGS = 0

	legacySales.forEach(sale => {
		// Find the inventory item for this sale
		const inventory = inventoryItems.find(inv => inv.id === sale.inventoryId)
		if (!inventory) return

		// Find the shipment for this inventory
		const shipment = shipments.find(s => s.id === inventory.shipmentId)
		if (!shipment) return

		// Calculate WAC for this shipment
		const unitCost = calculateShipmentWAC(shipment, inventoryItems)
		
		// Calculate COGS for this sale
		const itemCOGS = unitCost * sale.quantitySold

		itemizedCOGS.push({
			itemId: sale.id,
			shipmentId: shipment.id,
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
	shipments: Shipment[]
): number {
	const newSalesCOGS = calculateSaleItemsCOGS(saleItems, inventoryItems, shipments)
	const legacySalesCOGS = calculateLegacySalesCOGS(legacySales, inventoryItems, shipments)
	
	return newSalesCOGS.totalCOGS + legacySalesCOGS.totalCOGS
}

/**
 * Calculate COGS for a specific date range
 */
export function calculateCOGSForDateRange(
	saleItems: SaleItem[],
	legacySales: LegacySale[],
	inventoryItems: InventoryItem[],
	shipments: Shipment[],
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
	
	return calculateTotalCOGS(filteredSaleItems, filteredLegacySales, inventoryItems, shipments)
}
