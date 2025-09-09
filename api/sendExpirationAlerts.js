import admin from 'firebase-admin'
import { Resend } from 'resend'

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (admin.apps.length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
  return admin.firestore()
}

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  try {
    // Security check - only allow cron jobs or requests with secret
    const cronSecret = req.headers['x-vercel-cron-signature'] || req.query.secret
    if (cronSecret !== process.env.CRON_SECRET) {
      console.log('Unauthorized request - missing or invalid cron secret')
      return res.status(401).json({ error: 'Unauthorized' })
    }

    console.log('Starting expiration alert check...')
    
    // Initialize Firebase Admin
    const db = initializeFirebaseAdmin()

    // Calculate date 30 days from now
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    console.log(`Checking for inventory expiring before: ${thirtyDaysFromNow.toISOString()}`)

    // Query expiring inventory across all teams
    const inventorySnapshot = await db.collection('inventory')
      .where('expirationDate', '<=', thirtyDaysFromNow)
      .where('currentStock', '>', 0) // Only alert for items still in stock
      .get()

    console.log(`Found ${inventorySnapshot.size} expiring inventory items`)

    if (inventorySnapshot.empty) {
      console.log('No expiring inventory found')
      return res.status(200).json({ 
        message: 'No expiring inventory found', 
        count: 0 
      })
    }

    // Group inventory by team
    const teamInventoryMap = new Map()

    for (const doc of inventorySnapshot.docs) {
      const inventory = { id: doc.id, ...doc.data() }
      const teamId = inventory.teamId

      if (!teamInventoryMap.has(teamId)) {
        teamInventoryMap.set(teamId, [])
      }
      teamInventoryMap.get(teamId).push(inventory)
    }

    console.log(`Found expiring inventory for ${teamInventoryMap.size} teams`)

    // Process each team
    let totalEmailsSent = 0
    const results = []

    for (const [teamId, expiringItems] of teamInventoryMap) {
      try {
        console.log(`Processing team ${teamId} with ${expiringItems.length} expiring items`)

        // Get team details
        const teamDoc = await db.collection('teams').doc(teamId).get()
        if (!teamDoc.exists) {
          console.log(`Team ${teamId} not found, skipping`)
          continue
        }

        const teamData = teamDoc.data()
        const teamName = teamData.name || 'Your Team'
        const memberIds = teamData.members || []

        console.log(`Team "${teamName}" has ${memberIds.length} members`)

        // Get member email addresses
        const memberEmails = []
        for (const memberId of memberIds) {
          try {
            const userDoc = await db.collection('users').doc(memberId).get()
            if (userDoc.exists) {
              const userData = userDoc.data()
              if (userData.email) {
                memberEmails.push(userData.email)
              }
            }
          } catch (error) {
            console.log(`Error getting user ${memberId}:`, error.message)
          }
        }

        console.log(`Found ${memberEmails.length} member emails for team ${teamName}`)

        if (memberEmails.length === 0) {
          console.log(`No valid email addresses found for team ${teamName}`)
          continue
        }

        // Get product names for expiring items
        const enrichedItems = []
        for (const item of expiringItems) {
          try {
            const productDoc = await db.collection('products').doc(item.productId).get()
            const productName = productDoc.exists ? productDoc.data().name : 'Unknown Product'
            
            enrichedItems.push({
              ...item,
              productName,
              expirationDate: item.expirationDate.toDate(),
              daysUntilExpiration: Math.ceil(
                (item.expirationDate.toDate() - new Date()) / (1000 * 60 * 60 * 24)
              )
            })
          } catch (error) {
            console.log(`Error getting product ${item.productId}:`, error.message)
            enrichedItems.push({
              ...item,
              productName: 'Unknown Product',
              expirationDate: item.expirationDate.toDate(),
              daysUntilExpiration: Math.ceil(
                (item.expirationDate.toDate() - new Date()) / (1000 * 60 * 60 * 24)
              )
            })
          }
        }

        // Sort by expiration date (soonest first)
        enrichedItems.sort((a, b) => a.expirationDate - b.expirationDate)

        // Send email notification
        const emailContent = generateEmailContent(teamName, enrichedItems)
        
        const emailResult = await resend.emails.send({
          from: 'PEEV Alerts <noreply@dont-look-at-the-chart.com>',
          to: memberEmails,
          subject: `⚠️ PEEV Alert: ${enrichedItems.length} items expiring soon`,
          html: emailContent,
        })

        console.log(`Email sent to team ${teamName}:`, emailResult.data?.id)

        results.push({
          teamId,
          teamName,
          expiringItemsCount: enrichedItems.length,
          membersNotified: memberEmails.length,
          emailId: emailResult.data?.id,
          status: 'success'
        })

        totalEmailsSent++

      } catch (error) {
        console.error(`Error processing team ${teamId}:`, error.message)
        results.push({
          teamId,
          expiringItemsCount: teamInventoryMap.get(teamId)?.length || 0,
          status: 'error',
          error: error.message
        })
      }
    }

    console.log(`Expiration alert check completed. Sent ${totalEmailsSent} emails.`)

    return res.status(200).json({
      message: 'Expiration alerts processed successfully',
      emailsSent: totalEmailsSent,
      teamsProcessed: teamInventoryMap.size,
      results
    })

  } catch (error) {
    console.error('Error in expiration alerts:', error.message)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}

function generateEmailContent(teamName, expiringItems) {
  const today = new Date().toLocaleDateString()
  
  let itemsHtml = ''
  for (const item of expiringItems) {
    const expirationFormatted = item.expirationDate.toLocaleDateString()
    const urgencyClass = item.daysUntilExpiration <= 7 ? 'urgent' : 'warning'
    const urgencyText = item.daysUntilExpiration <= 0 ? 'EXPIRED' : 
                      item.daysUntilExpiration <= 7 ? 'URGENT' : 
                      `${item.daysUntilExpiration} days`
    
    itemsHtml += `
      <tr class="${urgencyClass}">
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <strong>${item.productName}</strong>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          ${item.location || 'No location specified'}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          ${expirationFormatted}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          ${item.currentStock} units
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold;">
          ${urgencyText}
        </td>
      </tr>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PEEV Expiration Alert</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1976d2; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background-color: #fff; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .footer { background-color: #f5f5f5; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; color: #666; }
        .table-container { margin: 20px 0; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; }
        .urgent { background-color: #ffebee; }
        .warning { background-color: #fff3e0; }
        .alert-badge { display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 14px; font-weight: bold; }
        .urgent-badge { background-color: #f44336; color: white; }
        .warning-badge { background-color: #ff9800; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🥤 PEEV Expiration Alert</h1>
          <p>Inventory items nearing expiration for <strong>${teamName}</strong></p>
        </div>
        
        <div class="content">
          <p>Hello ${teamName} team,</p>
          
          <p>This is your daily PEEV alert. We found <strong>${expiringItems.length} inventory item${expiringItems.length > 1 ? 's' : ''}</strong> 
          that will expire within the next 30 days.</p>
          
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Location</th>
                  <th>Expiration Date</th>
                  <th>Quantity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          
          <p><strong>Action needed:</strong></p>
          <ul>
            <li>🔴 <strong>EXPIRED items</strong>: Remove from vending machines immediately</li>
            <li>🟡 <strong>Items expiring within 7 days</strong>: Consider discounting or prioritizing sales</li>
            <li>🟢 <strong>Other items</strong>: Monitor and plan accordingly</li>
          </ul>
          
          <p>Log into PEEV to update your inventory or record sales: <a href="https://your-peev-domain.com">Open PEEV</a></p>
        </div>
        
        <div class="footer">
          <p>This alert was generated on ${today} by PEEV (Profit & Expense Evaluator for Vendors)</p>
          <p>Manage your vending machine inventory smarter with automated alerts</p>
        </div>
      </div>
    </body>
    </html>
  `
}
