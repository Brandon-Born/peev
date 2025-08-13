import { z } from 'zod'

export const ShipmentSchema = z.object({
	name: z.string().min(1),
	purchaseDate: z.date(),
	totalCost: z.number().int().nonnegative(), // cents
	supplier: z.string().optional(),
	ownerUid: z.string(),
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type Shipment = z.infer<typeof ShipmentSchema> & { id: string }

export const ProductCategorySchema = z.object({
	name: z.string().min(1),
	ownerUid: z.string(),
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type ProductCategory = z.infer<typeof ProductCategorySchema> & { id: string }

export const ProductSchema = z.object({
	name: z.string().min(1),
	categoryId: z.string().min(1),
	sku: z.string().optional(),
	description: z.string().optional(),
	ownerUid: z.string(),
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type Product = z.infer<typeof ProductSchema> & { id: string }

export const InventorySchema = z.object({
	productId: z.string().min(1),
	shipmentId: z.string().min(1),
	initialQuantity: z.number().int().nonnegative(),
	currentStock: z.number().int().nonnegative(),
	ownerUid: z.string(),
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
	ownerUid: z.string(),
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
	ownerUid: z.string(),
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
	ownerUid: z.string(),
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type LegacySale = z.infer<typeof LegacySaleSchema> & { id: string }


