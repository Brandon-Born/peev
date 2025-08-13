import { Typography, Stack, Paper } from '@mui/material'

export function ReportsPage() {
	return (
		<Stack spacing={2}>
			<Typography variant="h4">Reports</Typography>
			<Paper sx={{ p: 2 }}>
				<Typography variant="body1">Monthly Sales Report and Quarterly Tax Report will be available here.</Typography>
			</Paper>
		</Stack>
	)
}


