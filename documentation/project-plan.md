# PEEV — Project Plan & Implementation Guide

This document outlines the requirements and implementation plan for forking the P.I.T.A. codebase and transforming it into PEEV (Profit & Expense Evaluator for Vendors), a team-based inventory management system for vending machines.

## What's Already Complete

The agent should assume the following components and logic from the P.I.T.A. codebase are functional and available for modification. **Do not rebuild these from scratch.**

* **Core Application Shell**: A working React 18 application built with Vite and TypeScript.
* **UI Framework**: Material UI (MUI) components are integrated and used throughout the app.
* **Client-Side State Management**: TanStack Query is set up for managing server state from Firestore.
* **Forms**: React Hook Form and Zod are used for form state management and validation.
* **Firebase Integration**: The client-side Firebase SDK is initialized and used for Auth (Google Sign-In) and Firestore.
* **Existing UI Components**:
    * CRUD (Create, Read, Update, Delete) interfaces for `Shipments`, `Products`, and `ProductCategories`.
    * A multi-item sales transaction form.
    * Dashboard components with charts (Recharts) and metric cards.
    * Report generation pages.
* **Core Business Logic (Single-User)**:
    * The data model and logic for tracking inventory from `shipments`.
    * Atomic stock decrements for sales transactions.
    * Calculation of Weighted Average Cost (WAC) for COGS. All `ownerUid`-based logic is functional but needs to be replaced.

## Goals for PEEV

* **Purpose**: Track vending machine inventory from bulk purchase to individual sale, manage product expirations, and generate financial reports for a **team of operators**.
* **Key New Features**:
    1.  Multi-user, team-based data access.
    2.  Tracking of product expiration dates.
    3.  Automated email notifications for items nearing expiration.

## Summary of Core Changes

* **[ADDED] Team-Based Data Sharing**: The entire application will shift from a single-user model (`ownerUid`) to a multi-user, team-based model (`teamId`). This is the most significant architectural change.
* **[ADDED] Expiration Date Tracking**: The inventory system will be updated to track product expiration dates.
* **[ADDED] Automated Email Notifications**: A backend serverless function on Vercel, triggered by a cron job, will send email alerts.
* **[MODIFIED] Vending-Specific Fields**: Minor additions to the data model will be made to better suit vending machine product descriptions.
* **[REMOVED] Single-User Scoping**: The `ownerUid` field and its associated security rules will be completely removed and replaced.

---

## Tech Stack Modifications

* **Backend**: Firebase Authentication and Firestore (Spark Plan).
* **Scheduled Jobs**: **Vercel Cron Jobs** to trigger backend logic.
* **Third-Party Service**: **Resend** for email delivery.

---

## Firestore Data Model Overhaul

* **Convention Change**: **[REMOVED]** The `ownerUid` field from all collections. **[ADDED]** A `teamId` (string) field to all top-level data collections for data isolation.

* **[ADDED] `teams` Collection**
    * **Purpose**: Manages team membership. All members have admin privileges.
    * **Fields**:
        * `name`: (string)
        * `ownerUid`: (string, UID of the team creator)
        * `members`: (array of strings, `["uid123", "uid456"]`)

* **[ADDED] `users` Collection**
    * **Purpose**: Links an authenticated user to their team for easy access control.
    * **Fields**:
        * `displayName`: (string)
        * `email`: (string)
        * `teamId`: (string, reference to the team's document ID)
        * `teamName`: (string)

* **[REMOVED] `shipments` Collection**
    * **Rationale**: For vending machine operators purchasing at wholesale stores (Costco, Sam's Club), there's no formal "shipment" concept. Purchase information is now captured directly in inventory entries.

* **[MODIFIED] `productCategories`, `transactions`, `saleItems` Collections**
    * **Fields**: **[REMOVED]** `ownerUid`. **[ADDED]** `teamId` (string). Other fields remain.

* **[MODIFIED] `products` Collection**
    * **Fields**:
        * **[REMOVED]** `ownerUid`
        * **[ADDED]** `teamId` (string)
        * **[ADDED]** `unitSize` (string, optional, e.g., "12oz Can", "1.5oz Bag")
        * **[ADDED]** `packSize` (number, optional, e.g., 32)

* **[MODIFIED] `inventory` Collection**
    * **Purpose**: Now serves as the primary purchase and inventory tracking record. No longer references separate shipments.
    * **Fields**:
        * **[REMOVED]** `ownerUid`, `shipmentId`
        * **[ADDED]** `teamId` (string)
        * **[ADDED]** `purchaseDate` (timestamp, when you bought this at the store)
        * **[ADDED]** `totalCost` (number, cents, total cost for this purchase)
        * **[ADDED]** `supplier` (string, optional, store name like "Costco", "Sam's Club")
        * **[ADDED]** `expirationDate` (timestamp, optional)
        * **[ADDED]** `location` (string, optional, e.g., "Building A - Floor 2", "Main Lobby")

---

## Security Rules (Complete Overhaul)

Rewrite `firestore.rules` to enforce team-based access.

* **Global Rule**: Require authentication for all access: `request.auth != null`.
* **Team Isolation Logic**: Use a helper function to verify team membership on all data operations.

    ```firestore.rules
    // firestore.rules

    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {

        // Helper function to check if a user belongs to a team
        function isTeamMember(teamId) {
          return request.auth.uid in get(/databases/$(database)/documents/teams/$(teamId)).data.members;
        }

        // Rule for a team-scoped collection
        match /products/{productId} {
          allow read, write: if isTeamMember(resource.data.teamId);
        }

        // Add similar rules for inventory, transactions, etc.

        // Rules for the teams collection itself
        match /teams/{teamId} {
          allow read: if isTeamMember(teamId);
          allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
          allow update: if get(/databases/$(database)/documents/teams/$(teamId)).data.ownerUid == request.auth.uid; // Only owner can add/remove members
        }

        // Rules for user profiles
        match /users/{userId} {
           allow read: if request.auth.uid == userId;
           allow create: if request.auth.uid == userId;
        }
      }
    }
    ```

---

## Required UI/UX and Flow Changes

* **Onboarding Flow**: After a new user signs in, they must be prompted to either **create a new team** or be instructed on how to join one. The main application should be inaccessible until the user is associated with a `teamId`.
* **Team Management Page (`/team`)**: A new page where team members can view other members and invite new ones. All members have admin privileges.
* **Simplified Receive Inventory Flow**: **[REMOVED]** Two-step process (create shipment → receive inventory). **[ADDED]** Single-step "Receive Inventory" form that captures:
    * Product selection
    * Purchase details (date, total cost, store name)
    * Quantity received
    * Optional expiration date and vending machine location
* **Enhanced Inventory List**: The table displays purchase information, expiration dates, and locations directly. Items expiring within 30 days are visually highlighted (yellow background).
* **Client-Side Data Logic**: All Firestore queries (`useQuery` hooks) must be refactored to use `where('teamId', '==', currentUser.teamId)` instead of `where('ownerUid', '==', currentUser.uid)`.

---

## Required Backend Logic (Vercel Serverless Functions)

* **`sendExpirationAlerts` Serverless Function**:
    * **Location**: Create a serverless function at `/api/sendExpirationAlerts`.
    * **Trigger**: A **Vercel Cron Job** defined in `vercel.json` will call this endpoint on a daily schedule.
    * **Authentication**: The endpoint should be protected from public access. A common method is to check for a secret key passed in the headers, which is stored as an environment variable (`CRON_SECRET`).
    * **Logic**:
        1.  The function will use the **Firebase Admin SDK** (not the client SDK) to connect to Firestore with service account credentials.
        2.  Define a date range: from `now` to `now + 30 days`.
        3.  Query the `inventory` collection for all documents where `currentStock > 0` and `expirationDate` is within the defined range.
        4.  Group the resulting documents by `teamId`.
        5.  For each team with expiring items:
            a.  Fetch the team document to get the emails of all members.
            b.  Format a summary email from "PEEV" listing the expiring products with their locations, team name, expiration dates, and quantities.
            c.  Use the **Resend API** to send one consolidated email to all members of that team.

---

## New Delivery Plan & Milestones

Follow this order of operations to ensure a stable build process.

### Phase 1: Team Foundation & Authentication (Highest Priority)

1.  **Data Model**: Implement the new `teams` and `users` collections in your Firestore console.
2.  **Security Rules**: Write and deploy the new team-based `firestore.rules`.
3.  **Onboarding UI**:
    * Create a protected route wrapper that checks if a user has a `teamId`.
    * If no `teamId` exists, redirect to an "Onboarding" page.
    * Build the form for a new user to create a team, which upon submission creates a `teams` document and updates their `users` document.
4.  **Auth Context**: Modify the existing authentication context/hook to fetch and provide the user's `teamId` throughout the application.

### Phase 2: Core Logic Migration & Simplified Inventory

1.  **Refactor Firestore Queries**: Systematically go through every component that fetches or writes data. Replace all `ownerUid` logic with `teamId` logic, using the `teamId` from the updated auth context.
2.  **Eliminate Shipment Concept**: **[REMOVED]** Separate shipment management. **[ADDED]** Direct purchase tracking in inventory entries.
3.  **Enhanced Receive Inventory Form**: Single form that captures product, purchase details (date, cost, store), quantity, expiration date, and location.
4.  **Modify `products` UI**: Add the optional `unitSize` and `packSize` fields to the product creation/editing form.
5.  **Visual Enhancements**: Display purchase information and highlight items expiring within 30 days.

### Phase 3: Automated Expiration Notifications on Vercel

1.  **Backend Setup**:
    * Create a new serverless function file at `/api/sendExpirationAlerts.js`.
    * Install the necessary dependencies: `firebase-admin` and `resend`.
    * Add environment variables to your Vercel project: Firebase service account credentials, your Resend API key, and a `CRON_SECRET` for securing the endpoint.
2.  **Function Implementation**: Write the serverless function logic to connect to Firestore using the Admin SDK, perform the query for expiring items, and use the Resend SDK to send the emails. Ensure it checks for the `CRON_SECRET`.
3.  **Scheduling**: Configure a Vercel Cron Job in the `vercel.json` file to call the `/api/sendExpirationAlerts` endpoint daily.

    ```json
    // vercel.json
    {
      "crons": [
        {
          "path": "/api/sendExpirationAlerts",
          "schedule": "0 8 * * *"
        }
      ]
    }
    ```

### Phase 4: Reports & Final Polish

1.  **Verification**: Thoroughly test the Dashboard and Reports pages. Confirm that all financial calculations are correctly scoped to the user's team data.
2.  **Team Management UI**: Build the `/team` page where team members can see a list of all members and invite new ones.
3.  **End-to-End Testing**: Perform a full test of the user journey: sign-up, create a team, add products, receive inventory (with purchase details, expiration dates, and locations), make a sale, and verify dashboard metrics. Manually trigger the cron job to test the email notification flow.