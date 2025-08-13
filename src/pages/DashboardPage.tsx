import { Typography, Stack, Paper } from '@mui/material'

export function DashboardPage() {
	return (
		<Stack spacing={2}>
			<Typography variant="h4">Dashboard</Typography>
			<Typography variant="body1">Welcome to Panda's Integrated Tracking Assistant (P.I.T.A.).</Typography>
			<Paper sx={{ p: 2 }}>
				<Typography variant="body2">This dashboard will show KPIs and a 12-month revenue chart.</Typography>
			</Paper>
		</Stack>
	)
}


