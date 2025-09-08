import React from 'react'
import {
	Typography, Stack, Paper, Button, TextField, Box, Chip, Avatar, 
	Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
	Card, CardContent, CardActions, Alert, Snackbar,
	Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
	useMediaQuery, useTheme
} from '@mui/material'
import {
	PersonAdd as PersonAddIcon,
	Delete as DeleteIcon,
	AdminPanelSettings as AdminIcon,
	Email as EmailIcon,
	Group as GroupIcon
} from '@mui/icons-material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../modules/auth/AuthContext'
import { getTeamDetails, inviteTeamMember, removeTeamMember } from '../data/firestore'

// Form schemas
const inviteSchema = z.object({
	email: z.string().email('Please enter a valid email address')
})

type InviteForm = z.infer<typeof inviteSchema>

export function TeamPage() {
	const { user, team } = useAuth()
	const qc = useQueryClient()
	const theme = useTheme()
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
	
	const [snack, setSnack] = React.useState<{ 
		open: boolean; message: string; severity: 'success' | 'error' 
	}>({ open: false, message: '', severity: 'success' })
	
	const [removeDialog, setRemoveDialog] = React.useState<{
		open: boolean; member?: any
	}>({ open: false })

	const form = useForm<InviteForm>({
		resolver: zodResolver(inviteSchema),
		defaultValues: { email: '' }
	})

	// Query team details
	const teamDetailsQuery = useQuery({
		queryKey: ['teamDetails', team?.id],
		queryFn: () => team?.id ? getTeamDetails(team.id) : Promise.resolve(null),
		enabled: !!team?.id
	})

	const showSuccess = (message: string) => {
		setSnack({ open: true, message, severity: 'success' })
	}

	const showError = (message: string) => {
		setSnack({ open: true, message, severity: 'error' })
	}

	const onInviteMember = async (values: InviteForm) => {
		try {
			const result = await inviteTeamMember(values.email)
			
			if (result.success) {
				showSuccess(result.message)
				form.reset({ email: '' })
				qc.invalidateQueries({ queryKey: ['teamDetails', team?.id] })
			} else {
				showError(result.message)
			}
		} catch (error: any) {
			showError(`Failed to invite member: ${error.message}`)
		}
	}

	const onRemoveMember = async (memberId: string) => {
		try {
			const result = await removeTeamMember(memberId)
			
			if (result.success) {
				showSuccess(result.message)
				qc.invalidateQueries({ queryKey: ['teamDetails', team?.id] })
				setRemoveDialog({ open: false })
			} else {
				showError(result.message)
			}
		} catch (error: any) {
			showError(`Failed to remove member: ${error.message}`)
		}
	}

	if (!team) {
		return (
			<Stack spacing={3} alignItems="center" sx={{ py: 8 }}>
				<GroupIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
				<Typography variant="h5" color="text.secondary">
					No Team Found
				</Typography>
				<Typography variant="body1" color="text.secondary" textAlign="center">
					You need to be part of a team to access this page.
				</Typography>
			</Stack>
		)
	}

	if (teamDetailsQuery.isLoading) {
		return (
			<Stack spacing={3} alignItems="center" sx={{ py: 8 }}>
				<Typography variant="h6">Loading team details...</Typography>
			</Stack>
		)
	}

	const teamDetails = teamDetailsQuery.data
	const isTeamMember = teamDetails?.members.some(member => member.id === user?.uid)

	return (
		<Stack spacing={4}>
			{/* Team Header */}
			<Paper sx={{ p: 3 }}>
				<Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
					<Avatar sx={{ bgcolor: 'primary.main' }}>
						<GroupIcon />
					</Avatar>
					<Box>
						<Typography variant="h4">{teamDetails?.team.name || 'Team'}</Typography>
						<Typography variant="body2" color="text.secondary">
							{teamDetails?.members.length || 0} member{(teamDetails?.members.length || 0) !== 1 ? 's' : ''}
						</Typography>
					</Box>
				</Stack>
				
				{!isTeamMember && (
					<Alert severity="info" sx={{ mt: 2 }}>
						You need to be a team member to manage the team.
					</Alert>
				)}
			</Paper>

			{/* Invite Members Section - All team members have admin privileges */}
			{isTeamMember && (
				<Paper sx={{ p: 3 }}>
					<Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<PersonAddIcon />
						Invite Team Member
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
						Invite new members by email address. They must already have a PEEV account. All team members have admin privileges.
					</Typography>
					
					<Stack component="form" onSubmit={form.handleSubmit(onInviteMember)} spacing={2}>
						<TextField
							label="Email Address"
							placeholder="colleague@example.com"
							error={!!form.formState.errors.email}
							helperText={form.formState.errors.email?.message}
							{...form.register('email')}
						/>
						<Box>
							<Button 
								type="submit" 
								variant="contained" 
								startIcon={<PersonAddIcon />}
								disabled={form.formState.isSubmitting}
							>
								{form.formState.isSubmitting ? 'Inviting...' : 'Send Invitation'}
							</Button>
						</Box>
					</Stack>
				</Paper>
			)}

			{/* Team Members List */}
			<Paper sx={{ p: 3 }}>
				<Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<GroupIcon />
					Team Members
				</Typography>

				{isMobile ? (
					// Mobile view - Cards
					<Stack spacing={2} sx={{ mt: 2 }}>
						{teamDetails?.members.map((member) => {
							const isCurrentUser = member.id === user?.uid
							const isMemberOwner = member.id === teamDetails.team.ownerUid
							
							return (
								<Card key={member.id} variant="outlined">
									<CardContent sx={{ pb: 1 }}>
										<Stack direction="row" alignItems="center" spacing={2}>
											<Avatar sx={{ bgcolor: 'primary.main' }}>
												{member.displayName?.charAt(0) || member.email?.charAt(0) || '?'}
											</Avatar>
											<Box sx={{ flexGrow: 1 }}>
												<Typography variant="subtitle1">
													{member.displayName || 'Unknown User'}
													{isCurrentUser && <Chip label="You" size="small" sx={{ ml: 1 }} />}
												</Typography>
												<Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
													<EmailIcon fontSize="small" />
													{member.email}
												</Typography>
											</Box>
											{isMemberOwner && (
												<Chip 
													icon={<AdminIcon />} 
													label="Owner" 
													color="primary" 
													size="small" 
												/>
											)}
										</Stack>
									</CardContent>
									{isTeamMember && !isCurrentUser && !isMemberOwner && (
										<CardActions>
											<Button
												size="small"
												color="error"
												startIcon={<DeleteIcon />}
												onClick={() => setRemoveDialog({ open: true, member })}
											>
												Remove
											</Button>
										</CardActions>
									)}
								</Card>
							)
						})}
					</Stack>
				) : (
					// Desktop view - Table
					<TableContainer sx={{ mt: 2 }}>
						<Table>
							<TableHead>
								<TableRow>
									<TableCell>Member</TableCell>
									<TableCell>Email</TableCell>
									<TableCell>Role</TableCell>
									{isTeamMember && <TableCell align="right">Actions</TableCell>}
								</TableRow>
							</TableHead>
							<TableBody>
								{teamDetails?.members.map((member) => {
									const isCurrentUser = member.id === user?.uid
									const isMemberOwner = member.id === teamDetails.team.ownerUid
									
									return (
										<TableRow key={member.id}>
											<TableCell>
												<Stack direction="row" alignItems="center" spacing={2}>
													<Avatar sx={{ bgcolor: 'primary.main' }}>
														{member.displayName?.charAt(0) || member.email?.charAt(0) || '?'}
													</Avatar>
													<Box>
														<Typography variant="subtitle2">
															{member.displayName || 'Unknown User'}
														</Typography>
														{isCurrentUser && (
															<Chip label="You" size="small" variant="outlined" />
														)}
													</Box>
												</Stack>
											</TableCell>
											<TableCell>{member.email}</TableCell>
											<TableCell>
												{isMemberOwner ? (
													<Chip 
														icon={<AdminIcon />} 
														label="Team Owner" 
														color="primary" 
														size="small" 
													/>
												) : (
													<Chip label="Member" variant="outlined" size="small" />
												)}
											</TableCell>
											{isTeamMember && (
												<TableCell align="right">
													{!isCurrentUser && !isMemberOwner ? (
														<IconButton
															color="error"
															size="small"
															onClick={() => setRemoveDialog({ open: true, member })}
														>
															<DeleteIcon />
														</IconButton>
													) : (
														<Typography variant="body2" color="text.secondary">
															—
														</Typography>
													)}
												</TableCell>
											)}
										</TableRow>
									)
								})}
							</TableBody>
						</Table>
					</TableContainer>
				)}

				{(!teamDetails?.members || teamDetails.members.length === 0) && (
					<Box sx={{ textAlign: 'center', py: 4 }}>
						<Typography variant="body1" color="text.secondary">
							No team members found
						</Typography>
					</Box>
				)}
			</Paper>

			{/* Team Information */}
			<Paper sx={{ p: 3 }}>
				<Typography variant="h6" gutterBottom>Team Information</Typography>
				<Stack spacing={2}>
					<Box>
						<Typography variant="subtitle2" color="text.secondary">Team Name</Typography>
						<Typography variant="body1">{teamDetails?.team.name}</Typography>
					</Box>
					<Box>
						<Typography variant="subtitle2" color="text.secondary">Created</Typography>
						<Typography variant="body1">
							{teamDetails?.team.createdAt 
								? new Date(teamDetails.team.createdAt.toDate()).toLocaleDateString()
								: 'Unknown'
							}
						</Typography>
					</Box>
					<Box>
						<Typography variant="subtitle2" color="text.secondary">Team ID</Typography>
						<Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
							{teamDetails?.team.id}
						</Typography>
					</Box>
				</Stack>
			</Paper>

			{/* Remove Member Dialog */}
			<Dialog 
				open={removeDialog.open} 
				onClose={() => setRemoveDialog({ open: false })}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Remove Team Member</DialogTitle>
				<DialogContent>
					<Typography>
						Are you sure you want to remove <strong>{removeDialog.member?.displayName || removeDialog.member?.email}</strong> from your team?
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
						They will lose access to all team data and will need to be re-invited to rejoin.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setRemoveDialog({ open: false })}>
						Cancel
					</Button>
					<Button 
						color="error" 
						variant="contained"
						onClick={() => removeDialog.member && onRemoveMember(removeDialog.member.id)}
					>
						Remove Member
					</Button>
				</DialogActions>
			</Dialog>

			{/* Snackbar for notifications */}
			<Snackbar 
				open={snack.open} 
				autoHideDuration={6000} 
				onClose={() => setSnack({ ...snack, open: false })}
			>
				<Alert 
					onClose={() => setSnack({ ...snack, open: false })} 
					severity={snack.severity}
					sx={{ width: '100%' }}
				>
					{snack.message}
				</Alert>
			</Snackbar>
		</Stack>
	)
}
