import React from 'react'
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material'

export type ColorMode = 'light' | 'dark'

type ColorModeContextValue = {
	mode: ColorMode
	toggleMode: () => void
}

const ColorModeContext = React.createContext<ColorModeContextValue | undefined>(undefined)

export function useColorMode(): ColorModeContextValue {
	const ctx = React.useContext(ColorModeContext)
	if (!ctx) throw new Error('useColorMode must be used within AppThemeProvider')
	return ctx
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
	const [mode, setMode] = React.useState<ColorMode>(() => {
		if (typeof window === 'undefined') return 'light'
		const stored = window.localStorage.getItem('peev-color-mode') as ColorMode | null
		return stored ?? 'light'
	})

	const toggleMode = React.useCallback(() => {
		setMode((prev) => {
			const next = prev === 'light' ? 'dark' : 'light'
			if (typeof window !== 'undefined') {
				window.localStorage.setItem('peev-color-mode', next)
			}
			return next
		})
	}, [])

	const theme = React.useMemo(() => createTheme({
		palette: { mode },
		typography: { fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' },
		components: { MuiButton: { defaultProps: { variant: 'contained' } } }
	}), [mode])

	return (
		<ColorModeContext.Provider value={{ mode, toggleMode }}>
			<ThemeProvider theme={theme}>
				<CssBaseline />
				{children}
			</ThemeProvider>
		</ColorModeContext.Provider>
	)
}


