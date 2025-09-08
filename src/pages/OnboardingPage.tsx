import React from 'react'
import { Typography, Stack, Paper, TextField, Button, Container, Box, Alert } from '@mui/material'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../modules/auth/AuthContext'
import { createTeam, createUserProfile } from '../data/firestore'
import { useNavigate } from 'react-router-dom'

const createTeamSchema = z.object({
	teamName: z.string().min(1, 'Team name is required')
})

type CreateTeamForm = z.infer<typeof createTeamSchema>

export function OnboardingPage() {
	const { user, refreshUserProfile } = useAuth()
	const navigate = useNavigate()
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState<string | null>(null)
	const [success, setSuccess] = React.useState<string | null>(null)

	const form = useForm<CreateTeamForm>({
		resolver: zodResolver(createTeamSchema),
		defaultValues: {
			teamName: ''
		}
	})

	const onCreateTeam = async (values: CreateTeamForm) => {
		if (!user) {
			setError('You must be logged in to create a team')
			return
		}

		setLoading(true)
		setError(null)
		
		try {
			// Create the team
			const team = await createTeam(values.teamName)
			
			// Create the user profile linked to this team
			await createUserProfile(team.id, team.name)
			
			// Refresh the user profile in the auth context
			await refreshUserProfile()
			
			setSuccess('Team created successfully! Redirecting...')
			
			// Navigate to the main app
			setTimeout(() => {
				navigate('/')
			}, 1500)
			
		} catch (err: any) {
			console.error('Error creating team:', err)
			setError(err.message || 'Failed to create team. Please try again.')
		} finally {
			setLoading(false)
		}
	}

	return (
		<Container maxWidth="sm" sx={{ mt: 8 }}>
			<Stack spacing={4}>
				<Box textAlign="center">
					<Typography variant="h3" component="h1" gutterBottom>
						Welcome to PEEV!
					</Typography>
					<Typography variant="h6" color="text.secondary">
						Profit & Expense Evaluator for Vendors
					</Typography>
				</Box>

				<Paper elevation={3} sx={{ p: 4 }}>
					<Stack spacing={3}>
						<Typography variant="h5" component="h2">
							Create Your Team
						</Typography>
						
						<Typography variant="body1" color="text.secondary">
							To get started, create a team for your vending operation. You can invite team members later.
						</Typography>

						{error && (
							<Alert severity="error" onClose={() => setError(null)}>
								{error}
							</Alert>
						)}

						{success && (
							<Alert severity="success">
								{success}
							</Alert>
						)}

						<Stack component="form" spacing={3} onSubmit={form.handleSubmit(onCreateTeam)}>
							<TextField
								label="Team Name"
								placeholder="e.g., Downtown Vending Co."
								fullWidth
								{...form.register('teamName')}
								error={!!form.formState.errors.teamName}
								helperText={form.formState.errors.teamName?.message}
							/>

							<Button
								type="submit"
								variant="contained"
								size="large"
								disabled={loading}
								fullWidth
							>
								{loading ? 'Creating Team...' : 'Create Team'}
							</Button>
						</Stack>

						<Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
							<Typography variant="subtitle2" gutterBottom>
								Need to join an existing team?
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Ask your team owner to add your email address ({user?.email}) to the team. 
								Once added, refresh this page to access the team workspace.
							</Typography>
							<Button 
								variant="outlined" 
								size="small" 
								sx={{ mt: 1 }}
								onClick={() => window.location.reload()}
							>
								Refresh Page
							</Button>
						</Box>
					</Stack>
				</Paper>

				<Box textAlign="center">
					<Typography variant="body2" color="text.secondary">
						Signed in as {user?.displayName || user?.email}
					</Typography>
				</Box>
			</Stack>
		</Container>
	)
}
