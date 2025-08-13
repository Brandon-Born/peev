import React from 'react'
import { AppBar, Box, Container, IconButton, Toolbar, Typography, Button, Menu, MenuItem } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../modules/auth/AuthContext'
import { useColorMode } from '../theme'

export function AppLayout({ children }: { children: React.ReactNode }) {
	const { signOut, user } = useAuth()
	const { mode, toggleMode } = useColorMode()
	const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
	const open = Boolean(anchorEl)
	const handleMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
	const handleClose = () => setAnchorEl(null)

	return (
		<Box sx={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
			<AppBar position="static">
				<Toolbar>
					<IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 2 }} onClick={handleMenu}>
						<MenuIcon />
					</IconButton>
					<Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
						<MenuItem component={RouterLink} to="/" onClick={handleClose}>Dashboard</MenuItem>
						<MenuItem component={RouterLink} to="/inventory" onClick={handleClose}>Inventory</MenuItem>
						<MenuItem component={RouterLink} to="/sales" onClick={handleClose}>Sales</MenuItem>
						<MenuItem component={RouterLink} to="/reports" onClick={handleClose}>Reports</MenuItem>
						<MenuItem component={RouterLink} to="/glossary" onClick={handleClose}>Glossary</MenuItem>
					</Menu>
					<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
						P.I.T.A.
					</Typography>
					<IconButton color="inherit" onClick={toggleMode} sx={{ mr: 1 }} aria-label="toggle theme">
						{mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
					</IconButton>
					{user && (
						<Button color="inherit" onClick={signOut}>Sign out</Button>
					)}
				</Toolbar>
			</AppBar>
			<Box component="main" sx={{ flexGrow: 1, py: 3 }}>
				<Container maxWidth="lg">
					{children}
				</Container>
			</Box>
			<Box component="footer" sx={{ py: 3, bgcolor: 'background.paper' }}>
				<Container maxWidth="lg">
					<Typography variant="body2" color="text.secondary">
						© {new Date().getFullYear()} P.I.T.A. All rights reserved.
					</Typography>
				</Container>
			</Box>
		</Box>
	)
}


