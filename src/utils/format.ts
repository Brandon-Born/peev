export function formatCurrencyCents(cents: number): string {
	return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)
}

export function formatCurrency(dollars: number): string {
	return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(dollars || 0)
}

export function formatDate(d: Date | null | undefined): string {
	if (!d) return ''
	return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(d)
}


