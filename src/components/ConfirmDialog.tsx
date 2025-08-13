import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button } from '@mui/material'

export function ConfirmDialog(props: { open: boolean; title: string; message: string; confirmText?: string; cancelText?: string; onClose: () => void; onConfirm: () => void }) {
	const { open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onClose, onConfirm } = props
	return (
		<Dialog open={open} onClose={onClose}>
			<DialogTitle>{title}</DialogTitle>
			<DialogContent>
				<DialogContentText>{message}</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>{cancelText}</Button>
				<Button color="error" onClick={onConfirm}>{confirmText}</Button>
			</DialogActions>
		</Dialog>
	)
}


