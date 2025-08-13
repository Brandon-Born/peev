import { Typography, Paper } from '@mui/material'

export function SalesPage() {
	return (
		<Paper sx={{ p: 2 }}>
			<Typography variant="h4" gutterBottom>Sales Tracker</Typography>
			<Typography variant="body1">Record new sales. Select a product and available stock per shipment.</Typography>
		</Paper>
	)
}


