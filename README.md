# P.I.T.A. (Panda's Integrated Tracking Assistant)

React + Vite + TypeScript app using Firebase (Firestore + Google Auth). Hosted on Vercel.

## Setup
- Copy env template and fill Firebase values:
```bash
cp env.example .env
```
- Install and run locally:
```bash
npm install
npm run dev
```

## Deploy on Vercel
- Connect repo to Vercel.
- Add env vars (same keys as `env.example`).
- Build command: `npm run build`, output: `dist`.
- `vercel.json` includes SPA rewrite to `index.html`.
- Firebase Auth → Authorized domains: add `localhost`, your Vercel domain(s), and custom domain.

## Structure
- `src/modules/firebase.ts`: Firebase init
- `src/modules/auth/*`: Auth context and protected route
- `src/pages/*`: Dashboard, Inventory, Sales, Reports, Login
