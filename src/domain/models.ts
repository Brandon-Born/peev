import { z } from 'zod'

// NEW: Team schema for PEEV
export const TeamSchema = z.object({
	name: z.string().min(1),
	ownerUid: z.string(),
	members: z.array(z.string()), // Array of UIDs, all members have admin privileges
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type Team = z.infer<typeof TeamSchema> & { id: string }

// NEW: User schema for PEEV  
export const UserSchema = z.object({
	displayName: z.string(),
	email: z.string().email(),
	teamId: z.string().optional(), // Optional - users can exist without a team initially
	teamName: z.string().optional(), // Optional - users can exist without a team initially
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type User = z.infer<typeof UserSchema> & { id: string }

// REMOVED: Shipment concept eliminated - purchase info now directly in inventory

export const ProductCategorySchema = z.object({
	name: z.string().min(1),
	teamId: z.string(), // CHANGED: from ownerUid to teamId
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type ProductCategory = z.infer<typeof ProductCategorySchema> & { id: string }

export const ProductSchema = z.object({
	name: z.string().min(1),
	categoryId: z.string().min(1),
	sku: z.string().optional(),
	description: z.string().optional(),
	unitSize: z.string().optional(), // NEW: e.g., "12oz Can", "1.5oz Bag"
	packSize: z.number().int().nonnegative().optional(), // NEW: e.g., 32
	teamId: z.string(), // CHANGED: from ownerUid to teamId
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type Product = z.infer<typeof ProductSchema> & { id: string }

export const InventorySchema = z.object({
	productId: z.string().min(1),
	// REMOVED: shipmentId - purchase info now directly included
	purchaseDate: z.date(), // When you bought this at the store
	totalCost: z.number().int().nonnegative(), // Total cost for this purchase (in cents)
	supplier: z.string().optional(), // Store name: "Costco", "Sam's Club", etc.
	purchaseQuantity: z.number().int().positive(), // How many packs you bought (e.g., 1)
	unitsPerPack: z.number().int().positive(), // Sellable units per pack (e.g., 24 cans)
	initialQuantity: z.number().int().nonnegative(), // Total sellable units (purchaseQuantity × unitsPerPack)
	currentStock: z.number().int().nonnegative(), // Current sellable units available
	expirationDate: z.date().optional(), // When the product expires
	location: z.string().optional(), // Which vending machine location
	teamId: z.string(), // Team ownership
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type InventoryItem = z.infer<typeof InventorySchema> & { id: string }

export const TransactionSchema = z.object({
	saleDate: z.date(),
	customerName: z.string().optional(),
	subtotal: z.number().int().nonnegative(), // cents
	tax: z.number().int().nonnegative().optional(), // cents
	discount: z.number().int().nonnegative().optional(), // cents
	total: z.number().int().nonnegative(), // cents
	teamId: z.string(), // CHANGED: from ownerUid to teamId
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type Transaction = z.infer<typeof TransactionSchema> & { id: string }

export const SaleItemSchema = z.object({
	transactionId: z.string().min(1),
	inventoryId: z.string().min(1),
	quantitySold: z.number().int().positive(),
	pricePerItem: z.number().int().nonnegative(), // cents
	lineTotal: z.number().int().nonnegative(), // cents (quantitySold * pricePerItem)
	teamId: z.string(), // CHANGED: from ownerUid to teamId
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type SaleItem = z.infer<typeof SaleItemSchema> & { id: string }

// Legacy Sale schema - keep for backward compatibility during migration
export const LegacySaleSchema = z.object({
	inventoryId: z.string().min(1),
	quantitySold: z.number().int().positive(),
	pricePerItem: z.number().int().nonnegative(), // cents
	saleDate: z.date(),
	teamId: z.string(), // CHANGED: from ownerUid to teamId
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type LegacySale = z.infer<typeof LegacySaleSchema> & { id: string }


