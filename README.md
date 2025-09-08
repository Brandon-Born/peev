# PEEV — Profit & Expense Evaluator for Vendors

PEEV is a full-featured team-based inventory and sales tracking web application built with React and Firebase, designed specifically for vending machine operations. This system helps vending machine operators track purchases, manage inventory across multiple locations, monitor expiration dates, and analyze profitability on a per-unit basis.

*Forked and transformed from P.I.T.A. (Panda's Integrated Tracking Assistant) to serve vending machine businesses.*

## Key Features

### 🏢 **Team-Based Operations**
- Multi-user teams with shared data access
- All team members have admin privileges to invite others
- Google Sign-In authentication with team assignment

### 📦 **Smart Inventory Management**
- **Purchase Units vs Sellable Units**: Buy 1 pack of 24 cans, sell 24 individual cans
- **Direct Purchase Recording**: No complex shipment tracking - record purchases directly
- **Expiration Date Tracking**: Visual alerts for items nearing expiration
- **Location Management**: Track which vending machine each inventory batch serves
- **Auto-populated Purchase Dates**: Automatically set to today (editable)

### 💰 **Accurate Financial Tracking**
- **Per-Unit COGS**: Precise cost calculation for individual item sales
- **Real-time Profit Analysis**: Revenue, COGS, and gross profit tracking
- **Monthly & Quarterly Reports**: Detailed breakdowns by product and time period
- **Multi-item Sales Transactions**: Handle complex vending machine restocking scenarios

### 📱 **Vending-Friendly Workflows**
- **Simplified Purchase Flow**: "I bought 1 pack of 24 cans for $24.00 at Costco"
- **Individual Unit Sales**: Sell 1 can at a time with accurate cost tracking
- **Mobile-Responsive**: Works great on phones for on-the-go inventory management
- **Expiration Alerts**: Visual highlighting for products nearing expiration

### 📧 **Automated Email Notifications**
- **Daily Expiration Alerts**: Automated emails sent to all team members
- **30-Day Lookahead**: Proactive notifications for items expiring within 30 days
- **Detailed Information**: Product names, locations, quantities, and urgency levels
- **Team-Based**: Each team receives alerts only for their inventory
- **Smart Filtering**: Only alerts for items still in stock

### 👥 **Advanced Team Management**
- **All Members Have Admin Privileges**: Any team member can invite or remove others
- **Email-Based Invitations**: Team members can invite new members by email address  
- **Member Overview**: View all team members with roles and contact information
- **Owner Protection**: Team owners cannot be removed by other members
- **User-Friendly Interface**: Mobile-responsive team management dashboard
- **Secure Member Removal**: Safe removal process with confirmation dialogs

## Live Tech Stack

- **Frontend**: React 18 + Vite + TypeScript, Material UI, TanStack Query, React Hook Form + Zod
- **Backend**: Firebase Auth (Google Sign-In), Firestore (team-based data)
- **Hosting**: Vercel with serverless functions
- **Charts**: Recharts for dashboard analytics

## Documentation

- **Project Plan & Architecture**: [`documentation/project-plan.md`](./documentation/project-plan.md)
- **Environment Setup Guide**: [`SETUP.md`](./SETUP.md) - **Firebase Admin SDK, Resend, and Vercel configuration**
- **Legacy Documentation**: [`documentation/legacy-project-plan.md`](./documentation/legacy-project-plan.md)

## Enhanced Data Model (Team-Based Firestore)

All collections now use `teamId` for data isolation instead of `ownerUid`:

### Core Collections
- **`teams`**: name, ownerUid, members (array), createdAt
- **`users`**: email, displayName, teamId, joinedAt
- **`productCategories`**: name, teamId
- **`products`**: name, categoryId, sku?, description?, unitSize?, packSize?, teamId

### Enhanced Inventory System
```javascript
inventory: {
  productId: string,
  purchaseDate: date,           // When you bought it at the store
  totalCost: number,           // Total purchase cost (in cents)
  supplier: string?,           // Store name (Costco, Sam's Club, etc.)
  purchaseQuantity: number,    // Packs purchased (e.g., 1)
  unitsPerPack: number,        // Sellable units per pack (e.g., 24)
  initialQuantity: number,     // Total sellable units (auto-calculated)
  currentStock: number,        // Current sellable units available
  expirationDate: date?,       // Product expiration date
  location: string?,           // Vending machine location
  teamId: string
}
```

### Sales & Transactions
- **`transactions`**: saleDate, customerName?, subtotal, tax?, discount?, total, teamId
- **`saleItems`**: transactionId, inventoryId, quantitySold, pricePerItem, lineTotal, teamId
- **`sales`** (legacy): preserved for backward compatibility

### COGS Calculation (Updated)
**Per-Unit Cost Model:**
```javascript
unitCost = totalCost ÷ (purchaseQuantity × unitsPerPack)
// Example: $24.00 ÷ (1 × 24) = $1.00 per can
itemCOGS = unitCost × quantitySold
```

## Security Model

**Team-based access control** with Firestore security rules:
- All operations require authentication (`request.auth != null`)
- Data access restricted by team membership (`request.auth.uid in get(...).data.members`)
- Team owners can manage membership
- All members have equal data access privileges

## Vending Machine Workflows

### 📦 **Receive Inventory**
1. Select product (e.g., "Coke Zero 12oz")
2. Purchase date auto-filled (today)
3. Enter total cost ($24.00)
4. Enter store (Costco)
5. Enter packs purchased (1)
6. Enter units per pack (24)
7. Set expiration date (optional)
8. Set location (Building A vending machine)

**Result**: 24 sellable units at $1.00 per unit cost

### 💵 **Record Sales**
1. Select product and inventory batch
2. Choose quantity sold (1 can)
3. Enter sale price ($1.50)
4. Record transaction

**Result**: $1.50 revenue, $1.00 COGS, $0.50 gross profit

### 📊 **Track Performance**
- **Dashboard**: Real-time revenue, COGS, and profit metrics
- **Reports**: Monthly product performance and quarterly summaries
- **Inventory Alerts**: Visual warnings for expiring products

## Local Development

### 1. Environment Setup
```bash
cp env.example .env
# Configure your Firebase project:
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEF123 # optional
```

### 2. Install & Run
```bash
npm install
npm run dev        # Development server
npm run build      # Production build
npm run preview    # Preview build locally
```

### 3. Firebase Setup
- Create a new Firebase project
- Enable Authentication → Google Sign-In
- Create Firestore database
- Deploy security rules from `firestore-security-rules.txt`
- Add your domain to Firebase Auth authorized domains

## Deployment (Vercel)

1. **Connect Repository**: Link your GitHub repo to Vercel
2. **Environment Variables**: Add all Firebase config vars to Vercel project settings
3. **Build Settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Domain Setup**: Add Vercel domain to Firebase Auth authorized domains

The `vercel.json` includes SPA routing and security headers.

## Project Structure

```
src/
├── components/          # Reusable UI (ConfirmDialog, etc.)
├── data/               # Firestore helpers and sales transactions
│   ├── firestore.ts    # Team-based data operations
│   └── sales.ts        # Transaction recording logic
├── domain/             # Zod schemas and TypeScript types
│   └── models.ts       # Enhanced data models
├── layouts/            # App layout and navigation
├── modules/            # Firebase, Auth context, route protection
│   └── auth/           # Team-based authentication
├── pages/              # Core application pages
│   ├── DashboardPage.tsx    # Analytics and metrics
│   ├── InventoryPage.tsx    # Purchase and inventory management
│   ├── SalesPage.tsx        # Individual unit sales
│   ├── ReportsPage.tsx      # Monthly and quarterly reports
│   ├── LoginPage.tsx        # Authentication
│   ├── OnboardingPage.tsx   # Team creation/joining
│   └── GlossaryPage.tsx     # Business terms reference
└── utils/              # COGS calculations and formatting
    └── cogs.ts         # Updated per-unit cost calculations
```

## Migration from P.I.T.A.

This codebase has been transformed from the original P.I.T.A. liquidated inventory system:

### Major Changes
- **Team-based**: Multi-user shared data instead of single-user isolation
- **Vending-focused**: Optimized for vending machine operations vs liquidated goods
- **Simplified purchases**: Direct inventory recording without shipment complexity
- **Unit tracking**: Proper separation of purchase units vs sellable units
- **Enhanced inventory**: Expiration dates and location tracking
- **Updated COGS**: Per-unit calculations instead of weighted average cost

### Legacy Support
- Original single-user data remains in legacy collections
- Backward compatibility maintained for existing sales data
- COGS calculations handle both new and legacy data models

## Future Enhancements

Recent additions and planned improvements:
- ✅ **Phase 3**: Automated email notifications for expiring inventory *(Now Live!)*
- ✅ **Phase 4**: Enhanced team management UI *(Now Live!)*
- **Export Features**: CSV reports for accounting systems
- **Advanced Analytics**: Trend analysis and forecasting
- **Mobile App**: Native mobile companion

## Contributing

This system was built as a practical solution for vending machine operators. If you find it useful for your business or want to contribute improvements, feel free to:

- Open issues for bugs or feature requests
- Submit pull requests with enhancements
- Share feedback on the vending machine workflows

## Acknowledgments

- **Original P.I.T.A. System**: Built by Freyr and Sons LLC for liquidated inventory management
- **PEEV Transformation**: Enhanced for team-based vending machine operations
- **Focus**: Accuracy, usability, and real-world business needs

---

**PEEV** - Making vending machine inventory management simple, accurate, and profitable! 🥤📊