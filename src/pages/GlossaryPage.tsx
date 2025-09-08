import React from 'react'
import { 
	Typography, Stack, Paper, Accordion, AccordionSummary, AccordionDetails,
	Box, Chip, Divider
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

interface GlossaryTerm {
	term: string
	definition: string
	example?: string
	formula?: string
	category: 'Financial' | 'Inventory' | 'Operations' | 'Calculations'
}

const glossaryTerms: GlossaryTerm[] = [
	// Financial Terms
	{
		term: 'COGS (Cost of Goods Sold)',
		definition: 'The direct costs of acquiring or producing the goods that were actually sold during a specific period. This only includes items that were sold, not items still in inventory.',
		example: 'If you bought a pallet for $1,000 with 100 items, and sold 20 items, your COGS would be $200 (20 items × $10 per item).',
		formula: 'COGS = Weighted Average Cost × Quantity Sold',
		category: 'Financial'
	},
	{
		term: 'Revenue',
		definition: 'The total amount of money received from sales before deducting any costs or expenses. Also called "gross sales" or "turnover".',
		example: 'If you sell 10 items for $25 each, your revenue is $250.',
		formula: 'Revenue = Price Per Item × Quantity Sold',
		category: 'Financial'
	},
	{
		term: 'Gross Profit',
		definition: 'The profit made after deducting the cost of goods sold from revenue. This shows how much money you made from sales before operating expenses.',
		example: 'Revenue of $500 minus COGS of $200 equals a gross profit of $300.',
		formula: 'Gross Profit = Revenue - COGS',
		category: 'Financial'
	},
	{
		term: 'Gross Margin',
		definition: 'Gross profit expressed as a percentage of revenue. This shows what percentage of each sale dollar becomes profit after covering the cost of goods.',
		example: 'A gross profit of $300 on revenue of $500 gives a gross margin of 60%.',
		formula: 'Gross Margin = (Gross Profit ÷ Revenue) × 100',
		category: 'Financial'
	},
	{
		term: 'P&L (Profit & Loss)',
		definition: 'A financial statement showing revenue, costs, and profit over a specific period. In PEEV, this focuses on vending machine gross profit calculations.',
		example: 'Monthly P&L: Revenue $2,000 - COGS $800 = Gross Profit $1,200 (60% margin).',
		category: 'Financial'
	},

	// Inventory Terms
	{
		term: 'Shipment',
		definition: 'A bulk purchase of liquidated inventory, typically a pallet or lot of mixed products. Each shipment has a total cost and purchase date.',
		example: 'August Electronics Pallet purchased for $1,500 containing various electronics items.',
		category: 'Inventory'
	},
	{
		term: 'Product Category',
		definition: 'A classification system to organize products by type or theme, making inventory management easier.',
		example: 'Electronics, Clothing, Home & Garden, Toys, etc.',
		category: 'Inventory'
	},
	{
		term: 'Product',
		definition: 'A specific type of item you sell. This is the master record for an item type, regardless of which shipment it came from.',
		example: 'iPhone 12 Case, Samsung Galaxy Earbuds, Nike Running Shoes.',
		category: 'Inventory'
	},
	{
		term: 'Inventory Item',
		definition: 'Specific stock of a product from a particular shipment. Tracks how many units you received and how many remain in stock.',
		example: '50 iPhone cases from August Electronics Pallet, with 23 currently in stock.',
		category: 'Inventory'
	},
	{
		term: 'Initial Quantity',
		definition: 'The number of units of a product you received when you first added it to inventory from a shipment.',
		example: 'You received 50 iPhone cases in your electronics shipment.',
		category: 'Inventory'
	},
	{
		term: 'Current Stock',
		definition: 'The number of units currently available for sale. This decreases each time you make a sale.',
		example: 'Started with 50 iPhone cases, sold 27, so current stock is 23.',
		category: 'Inventory'
	},

	// Operations Terms
	{
		term: 'Transaction',
		definition: 'A complete sale that can contain multiple different products. Includes customer information, taxes, discounts, and multiple line items.',
		example: 'Sale to John Doe including 2 phone cases and 1 charger, with $5 tax, totaling $67.',
		category: 'Operations'
	},
	{
		term: 'Sale Item (Line Item)',
		definition: 'An individual product within a transaction. Each sale item references specific inventory from a specific shipment.',
		example: 'Within a transaction: "2× iPhone Case from Electronics Pallet at $15 each = $30".',
		category: 'Operations'
	},
	{
		term: 'Legacy Sales',
		definition: 'Single-item sales from before PEEV supported multi-item transactions. These are maintained for historical data.',
		example: 'Old sales records that contained only one product per sale transaction.',
		category: 'Operations'
	},

	// Calculation Terms
	{
		term: 'Weighted Average Cost (WAC)',
		definition: 'The average cost per unit for all items in a shipment, calculated by dividing the total shipment cost by the number of units received.',
		example: '$1,000 shipment with 100 items = $10 WAC per item.',
		formula: 'WAC = Total Shipment Cost ÷ Total Units Received',
		category: 'Calculations'
	},
	{
		term: 'Line Total',
		definition: 'The total price for a specific product line within a transaction, calculated by multiplying quantity by price per item.',
		example: '3 items × $15 each = $45 line total.',
		formula: 'Line Total = Quantity × Price Per Item',
		category: 'Calculations'
	},
	{
		term: 'Subtotal',
		definition: 'The sum of all line totals in a transaction before adding taxes or subtracting discounts.',
		example: 'Line 1: $30 + Line 2: $25 = $55 subtotal.',
		category: 'Calculations'
	},
	{
		term: 'Units On Hand',
		definition: 'The total number of items currently in stock across all products and shipments.',
		example: '145 total items available for sale across all your inventory.',
		category: 'Calculations'
	}
]

const categories = ['Financial', 'Inventory', 'Operations', 'Calculations'] as const

export function GlossaryPage() {
	const [expandedCategory, setExpandedCategory] = React.useState<string>('Financial')

	const handleCategoryChange = (category: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
		setExpandedCategory(isExpanded ? category : '')
	}

	const getCategoryColor = (category: string) => {
		switch (category) {
			case 'Financial': return 'success'
			case 'Inventory': return 'primary'
			case 'Operations': return 'warning'
			case 'Calculations': return 'info'
			default: return 'default'
		}
	}

	const getCategoryDescription = (category: string) => {
		switch (category) {
			case 'Financial': return 'Money-related terms and profit calculations'
			case 'Inventory': return 'Product and stock management concepts'
			case 'Operations': return 'Sales transactions and business processes'
			case 'Calculations': return 'Formulas and computational methods'
			default: return ''
		}
	}

	return (
		<Stack spacing={3}>
			<Box>
				<Typography variant="h4" gutterBottom>Business Glossary</Typography>
				<Typography variant="body1" color="text.secondary">
					Essential terms and metrics used in PEEV to help you understand your vending machine business finances and operations.
				</Typography>
			</Box>

			{categories.map((category) => {
				const categoryTerms = glossaryTerms.filter(term => term.category === category)
				
				return (
					<Accordion 
						key={category}
						expanded={expandedCategory === category}
						onChange={handleCategoryChange(category)}
					>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Stack direction="row" spacing={2} alignItems="center">
								<Chip 
									label={category} 
									color={getCategoryColor(category)} 
									size="small"
								/>
								<Box>
									<Typography variant="h6">{category} Terms</Typography>
									<Typography variant="body2" color="text.secondary">
										{getCategoryDescription(category)} • {categoryTerms.length} terms
									</Typography>
								</Box>
							</Stack>
						</AccordionSummary>
						<AccordionDetails>
							<Stack spacing={3}>
								{categoryTerms.map((term, index) => (
									<Paper key={term.term} sx={{ p: 3 }} variant="outlined">
										<Stack spacing={2}>
											<Box>
												<Typography variant="h6" color="primary" gutterBottom>
													{term.term}
												</Typography>
												<Typography variant="body1">
													{term.definition}
												</Typography>
											</Box>

											{term.formula && (
												<Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, border: 1, borderColor: 'divider' }}>
													<Typography variant="subtitle2" color="text.secondary" gutterBottom>
														Formula:
													</Typography>
													<Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'text.primary' }}>
														{term.formula}
													</Typography>
												</Box>
											)}

											{term.example && (
												<Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', p: 2, borderRadius: 1 }}>
													<Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
														Example:
													</Typography>
													<Typography variant="body2">
														{term.example}
													</Typography>
												</Box>
											)}
										</Stack>
										{index < categoryTerms.length - 1 && <Divider sx={{ mt: 2 }} />}
									</Paper>
								))}
							</Stack>
						</AccordionDetails>
					</Accordion>
				)
			})}

			<Paper sx={{ p: 3, bgcolor: 'info.light' }}>
				<Typography variant="h6" gutterBottom>
					💡 Quick Reference
				</Typography>
				<Typography variant="body2" paragraph>
					<strong>Key Business Formula:</strong> Revenue - COGS = Gross Profit
				</Typography>
				<Typography variant="body2" paragraph>
					<strong>Success Metric:</strong> Higher gross margin percentage = more profitable business
				</Typography>
				<Typography variant="body2">
					<strong>Per-Unit Method:</strong> PEEV uses per-unit cost calculations to ensure accurate COGS for vending machine inventory with direct purchase tracking.
				</Typography>
			</Paper>
		</Stack>
	)
}
