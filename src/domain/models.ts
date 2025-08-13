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

export const SaleSchema = z.object({
	inventoryId: z.string().min(1),
	quantitySold: z.number().int().positive(),
	pricePerItem: z.number().int().nonnegative(), // cents
	saleDate: z.date(),
	ownerUid: z.string(),
	createdAt: z.any().optional(),
	updatedAt: z.any().optional(),
})
export type Sale = z.infer<typeof SaleSchema> & { id: string }


