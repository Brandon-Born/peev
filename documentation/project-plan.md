### Panda's Integrated Tracking Assistant (P.I.T.A.) — Project Plan and Architecture

## Goals
- **Purpose**: Track liquidated inventory from purchase to sale and generate financial reports.
- **KPIs**: Accuracy of inventory counts, reliability of COGS and gross profit, latency < 200ms for common reads, zero oversell.

## Tech Stack
- **Frontend**: React + TypeScript, React Router, TanStack Query, React Hook Form, Zod, charting (Recharts or Chart.js), UI kit (MUI or Tailwind).
- **Backend**: Firebase Authentication (Google Sign-In provider), Firestore (native mode), optional Cloud Functions for safeguards/aggregations.
- **Hosting/CI**: Vercel for static SPA hosting with Git-based previews.
- **Environments**: `dev`, `prod`, and Vercel preview environments; environment variables managed in Vercel; feature flags via runtime config document.

## High-Level Architecture
- **SPA** served from Vercel. Client talks directly to Firestore using the Web SDK.
- **Serverless invariants**: Prefer client-side Firestore transactions for atomic stock updates; optional Cloud Functions to enforce invariants and maintain aggregates.
- **Auth**: Google Sign-In. All documents scoped to the authenticated user via `ownerUid` to support multi-user in future.

## Firestore Data Model
- Conventions: All timestamps in UTC; currency in smallest unit (cents); reference fields store DocumentReference; include `ownerUid`, `createdAt`, `updatedAt`.

- `shipments`
  - **Fields**: `name` (string), `purchaseDate` (timestamp), `totalCost` (number, cents), `supplier` (string, optional), `ownerUid` (string), `metrics` (map, optional: `unitsReceived` number, `unitsSold` number, `revenue` number, `cogs` number).
  - **Notes**: Cost allocation is computed as weighted-average cost-per-unit (WAC) per shipment: `allocatedUnitCost = totalCost / max(1, metrics.unitsReceived)`.

- `productCategories`
  - **Fields**: `name` (string), `ownerUid` (string).

- `products`
  - **Fields**: `name` (string), `category` (ref → `productCategories/{id}`), `sku` (string, optional), `description` (string, optional), `ownerUid` (string).

- `inventory`
  - **Fields**: `product` (ref → `products/{id}`), `shipment` (ref → `shipments/{id}`), `initialQuantity` (number), `currentStock` (number), `ownerUid` (string).
  - **Notes**: Each document represents stock for a specific product from a specific shipment.

- `sales`
  - **Fields**: `inventory` (ref → `inventory/{id}`), `quantitySold` (number), `pricePerItem` (number, cents), `saleDate` (timestamp), `ownerUid` (string).
  - **Notes**: Each sale references exactly one inventory document (and thus one shipment). Multi-shipment sales are recorded as multiple sale documents.

- Optional aggregations (for performance at scale)
  - `metrics/monthly/{YYYY-MM}`: `revenue` (number), `unitsSold` (number), `cogs` (number), `ownerUid` (string).
  - `productStats/{productId}`: `onHand` (number), `lifetimeUnitsSold` (number), `lifetimeRevenue` (number).

## Security Rules (outline)
- Require authentication for all reads/writes: `request.auth != null`.
- Enforce tenant isolation: `resource.data.ownerUid == request.auth.uid` on reads; on writes, `request.resource.data.ownerUid == request.auth.uid`.
- Type/shape validation: ensure fields exist with expected types; immutable fields like `ownerUid` cannot change.
- Inventory integrity: prevent negative stock on writes: `request.resource.data.currentStock >= 0`.
- Restrict writes to derived fields: prevent clients from writing aggregate fields when Cloud Functions are enabled.

## Pages, Routes, and Core Flows

- Routing
  - `/` Dashboard
  - `/inventory` with tabs: `shipments`, `products`, `receive`
  - `/sales` Record Sale
  - `/reports` with tabs: `monthly`, `quarterly`

- Dashboard
  - **Metrics**:
    - Overall Gross Profit: `sum(all sales revenue) - sum(COGS for all units sold)`.
    - Monthly P&L (current month): revenue, COGS, gross profit.
  - **Charts**: Bar chart of total sales revenue per month for last 12 months.
  - **Implementation**: Query `sales` by date ranges; derive COGS per sale via related shipment WAC at time of read, or use pre-aggregated `metrics/monthly` for fast loads.

- Inventory Management
  - Manage Shipments
    - Create new shipment with `purchaseDate`, `totalCost`, optional `supplier`.
    - List with totals: `metrics.unitsReceived`, `metrics.unitsSold` (if maintained), and cost-per-unit.
  - Manage Products & Categories
    - CRUD for categories and products.
  - Receive Inventory
    - Create `inventory` by selecting a `Shipment` and a `Product`, entering `Quantity`.
    - Show a table of all inventory with product name, shipment name/date, `initialQuantity`, `currentStock`.

- Sales Tracker
  - Form: select `Product` → show available stock by shipment (grouped `inventory` rows). User selects one inventory row and enters `Quantity Sold` and `Sale Price`.
  - Submission (transaction):
    - Read selected `inventory` doc.
    - Verify `currentStock >= quantitySold`.
    - Create `sales` doc.
    - Decrement `inventory.currentStock`.
    - Optionally increment shipment and monthly aggregates.

- Reporting
  - Monthly Sales Report
    - Input: target month. Query `sales` in range; group by product; compute `unitsSold` and `revenue` per product.
  - Quarterly Tax Report
    - Input: year + quarter.
    - Total Sales Revenue: sum within range.
    - COGS: For each sale, compute per-unit cost using its shipment WAC: `(shipment.totalCost / shipment.metrics.unitsReceived) * sale.quantitySold`.
    - Gross Profit: `revenue - COGS`.

## Data and Calculation Details
- Revenue per sale: `pricePerItem * quantitySold`.
- WAC per shipment: `totalCost / unitsReceived` where `unitsReceived = sum(initialQuantity of inventory referencing shipment)`.
- COGS per sale: `WAC(shipment) * quantitySold`.
- Overall Gross Profit: `sum(pricePerItem * quantitySold) - sum(WAC(shipment) * quantitySold)`.
- Note: If `unitsReceived` is zero (no inventory yet), treat WAC as 0 for interim display; block sales if no stock.

## Client Data Layer
- Use TanStack Query for server state with Firestore SDK; collections as queries, writes via mutations.
- Use Firestore transactions for stock decrements and sale creation.
- Optimistic updates only where safe; otherwise rely on transaction result.

## Validation
- Zod schemas mirroring Firestore shapes; form validation via React Hook Form resolver.
- Guards: quantities are positive integers; prices are non-negative integers; dates required.

## Indexing Plan (Firestore)
- `sales`: composite index on `ownerUid` + `saleDate` (ASC/DESC) for range queries and ordering.
- `inventory`: index on `ownerUid` + `product`, and `ownerUid` + `shipment` for lookups.
- `products`: index on `ownerUid` + `category`.
- `shipments`: index on `ownerUid` + `purchaseDate` (ordering for lists).

## UX and Components (high level)
- Layout: top nav with routes; content area with tabs on inventory and reports pages.
- Reusable components: `DateRangePicker`, `CurrencyInput`, `SelectWithSearch`, `DataTable` with sorting/pagination, `BarChart`.

## Edge Cases and Invariants
- Prevent oversell (transaction check fails if insufficient stock).
- Deleting shipments/products with dependent documents should be blocked or handled with cascading updates disabled; use soft validation and surface in UI.
- Editing `totalCost` after receiving inventory recalculates WAC and impacts historical COGS in derived views; display recalculated values consistently. If this is undesirable, persist `unitCostAtSale` on `sales` at write-time.

## Optional Cloud Functions (if enabling server-enforced invariants)
- onCreate(`sales`): decrement `inventory.currentStock`, update shipment/monthly aggregates, compute and persist `unitCostAtSale` and `cogsAtSale` on the sale.
- onWrite(`inventory`): update `shipments.metrics.unitsReceived`.
- onWrite(`sales`): update `shipments.metrics.unitsSold`, `metrics.revenue`, `metrics.cogs` and `metrics/monthly` docs.

## Hosting and Deployment (Vercel)
- Project type: Client-side React SPA deployed as static assets.
- Build command: `npm run build`. Output folder: `dist` (Vite) or `build` (CRA). Configure Vercel accordingly.
- SPA routing: add a rewrite so all non-asset paths serve `index.html`.

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- Environment variables (set in Vercel; use `VITE_` prefix for client builds):

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=# optional
```

- Firebase Auth domains: In Firebase Console → Authentication → Settings → Authorized domains, add `localhost`, your production domain (e.g., `pita.yourdomain.com`), and your Vercel production domain (e.g., `pita.vercel.app`). Preview deployments use ephemeral domains; use a custom preview domain or test auth locally/production.
- Google Sign-In: Enable the Google provider in Firebase Auth. If using an external OAuth client, add the production domain(s) to Authorized JavaScript Origins.
- Caching: Let Vercel cache static assets aggressively; avoid long caching for `index.html` to allow quick rollouts.
- CI/CD: Connect the Git repo to Vercel. Previews build on pull requests with preview env vars; Production builds on merge to `main`/`master`.
- Optional headers (add to `vercel.json` if desired): security headers like `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.

## Delivery Plan and Milestones
- Phase 1: Data model + CRUD
  - Google auth scaffolding; CRUD for `shipments`, `productCategories`, `products`.
  - Inventory receive flow; inventory table.
  - Acceptance: Create shipments/products, receive inventory, view inventory list.
- Phase 2: Sales flow + stock integrity
  - Sales form with product → inventory selection; transactional decrement and sale creation.
  - Acceptance: Cannot oversell; sale appears in list; stock decrements correctly.
- Phase 3: Dashboard + reports
  - Dashboard metrics and 12-month revenue chart.
  - Monthly report (group by product); Quarterly report (revenue, COGS via WAC, gross profit).
  - Acceptance: Figures match hand-calculated fixtures.
- Phase 4 (optional): Aggregations/Functions and polishing
  - Monthly metrics aggregation for performance; export to CSV; basic search/filter.

## Acceptance Criteria (summary)
- Accurate inventory counts at all times; write paths prevent negative stock.
- Dashboard and reports display correct revenue/COGS/gross profit for given ranges.
- Queries are responsive with test data at 10k sales scale (with or without aggregations).

## Future Enhancements
- Multi-user teams with roles; audit log of edits; barcode scanning; image attachments; per-product pricing history; FIFO costing option; connectors for marketplaces.


