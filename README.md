# P.I.T.A. — Panda's Integrated Tracking Assistant

P.I.T.A. is a full-featured inventory and sales tracking web application built with React and Firebase, designed specifically for liquidated inventory workflows. It was created for my wife and for our small business as a labor of love — Freyr and Sons LLC (https://www.freyrandsons.com).

- Live stack: React + Vite + TypeScript, Material UI, TanStack Query, React Hook Form + Zod
- Backend: Firebase Auth (Google Sign-In), Firestore (native)
- Hosting: Vercel

## Documentation

- Project Plan and Architecture: [`documentation/project-plan.md`](./documentation/project-plan.md)
- Security Verification: [`documentation/security-verification.md`](./documentation/security-verification.md)

## Features

- Authentication: Google Sign-In, protected routes
- Multi-item Sales Transactions with atomic stock decrement
- Inventory Management
  - Shipments CRUD
  - Product Categories and Products CRUD
  - Receive Inventory (by product and shipment)
  - Inline editing and safe deletes with confirmations
  - Mobile-friendly UI with responsive tables/cards
- Dashboard
  - Total Revenue, This Month Revenue
  - COGS and Gross Profit (all-time and monthly)
  - 12-month revenue bar chart
- Reports
  - Monthly Sales Report (by product: units, revenue, avg price)
  - Quarterly Tax Report (Revenue, COGS via WAC, Gross Profit, margins)
- Business Glossary page for terms and formulas
- Snackbar notifications and confirm dialogs

## Tech Stack

- React + Vite + TypeScript
- Material UI (MUI)
- TanStack Query
- React Hook Form + Zod
- Firebase Auth (Google) + Firestore
- Recharts (Dashboard chart)

## Data Model (Firestore)

Collections (all documents include `ownerUid`, `createdAt`, `updatedAt`):
- `shipments`: name, purchaseDate, totalCost (cents), supplier?
- `productCategories`: name
- `products`: name, categoryId, sku?, description?
- `inventory`: productId, shipmentId, initialQuantity, currentStock
- `transactions`: saleDate, customerName?, subtotal, tax?, discount?, total
- `saleItems`: transactionId, inventoryId, quantitySold, pricePerItem, lineTotal
- `sales` (legacy single-item sales; read-only for backward compat)

COGS uses Weighted Average Cost (WAC) per shipment:
- `WAC = shipment.totalCost / unitsReceived`
- `COGS per sale item = WAC * quantitySold`

## Security

All rules require auth and enforce strict tenant isolation (`ownerUid`):
- Reads/updates/deletes require ownership of the target document
- Creates require `ownerUid` to match the authenticated user

See complete analysis: [`documentation/security-verification.md`](./documentation/security-verification.md)

## Local Development

1) Environment variables (use your Firebase project values):

```bash
cp env.example .env
# Fill in:
# VITE_FIREBASE_API_KEY=
# VITE_FIREBASE_AUTH_DOMAIN=
# VITE_FIREBASE_PROJECT_ID=
# VITE_FIREBASE_STORAGE_BUCKET=
# VITE_FIREBASE_MESSAGING_SENDER_ID=
# VITE_FIREBASE_APP_ID=
# VITE_FIREBASE_MEASUREMENT_ID= # optional
```

2) Install and run:

```bash
npm install
npm run dev
```

3) Build:

```bash
npm run build
```

## Deployment (Vercel)

- Connect the repo to Vercel
- Set the same env vars from `.env` in Vercel project settings (client-side vars must start with `VITE_`)
- Build command: `npm run build`
- Output directory: `dist`
- `vercel.json` includes SPA rewrite and security headers
- Firebase Auth → Authorized domains: add `localhost`, Vercel domain(s), and any custom domain

## Project Structure

```
src/
  components/         # Reusable UI components (ConfirmDialog, etc.)
  data/               # Firestore helpers and transactional sales logic
  domain/             # Zod schemas and TypeScript types
  layouts/            # App layout (AppBar, navigation, footer)
  modules/            # Firebase init, Auth context, route protection
  pages/              # Dashboard, Inventory, Sales, Reports, Login, Glossary
  utils/              # Formatting helpers, COGS calculations
```

## Notes & Acknowledgements

- Built as a practical tool for our small business, Freyr and Sons LLC.
- Focused on clarity, performance, and data correctness (no oversell, accurate COGS).
- Designed to be maintainable and extensible (future: CSV export, filters, roles, Cloud Functions guards).

If you have questions or suggestions, feel free to open an issue or PR. Thank you for checking out P.I.T.A.! ❤️
