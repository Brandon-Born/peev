import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AppThemeProvider } from './theme'
import { AuthProvider } from './modules/auth/AuthContext'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	React.createElement(React.StrictMode, null,
		React.createElement(QueryClientProvider, { client: queryClient },
			React.createElement(BrowserRouter, null,
				React.createElement(AuthProvider, null,
					React.createElement(AppThemeProvider, null,
						React.createElement(App)
					)
				)
			)
		)
	)
)


