const { sendMessage } = require('../handles/sendMessage');
const tokenManager = require('../handles/tokenManager');

module.exports = {
    name: ['config'],
    description: 'Add/Connect a Facebook page bot using Page Access Token. Also shows webhook config info and setup guide.',
    usage: 'config PAGE TOKEN | ADMIN NAME | PAGE NAME | config disconnect PAGE TOKEN | config guide',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'system',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Handle guide command
        if (args && args.length > 0 && args[0].toLowerCase() === 'guide') {
            await showSetupGuide(senderId, pageAccessToken);
            return;
        }

        // Handle disconnect command
        if (args && args.length > 0 && args[0].toLowerCase() === 'disconnect') {
            await handleDisconnect(senderId, args.slice(1), pageAccessToken);
            return;
        }

        // Check if command contains pipe separator
        const commandText = args.join(' ');
        if (commandText.includes('|')) {
            await handlePipedConfig(senderId, args, pageAccessToken);
            return;
        }

        // Handle basic config command (no pipe) - show webhook info
        if (!args || args.length === 0 || args[0].toLowerCase() === 'config') {
            await showWebhookConfig(senderId, pageAccessToken);
            return;
        }

        // Handle config with token only (no pipe)
        if (args.length >= 1 && args[0].length > 20) {
            await handleConnect(senderId, args, pageAccessToken);
            return;
        }

        // Default - show usage
        await showUsage(senderId, pageAccessToken);
    }
};

// Show complete setup guide tutorial
async function showSetupGuide(senderId, pageAccessToken) {
    try {
        const guideMessage = `AUTOPAGEBOT SETUP TUTORIAL

Complete guide to creating and deploying your Facebook Messenger bot

━━━━━━━━━━━━━━━━━━━━

STEP 1: INITIAL FACEBOOK SETUP

1. Open your web browser and log in to your Facebook account
2. Create a Facebook Page (if you don't have one already)
3. Navigate to developers.facebook.com/apps

━━━━━━━━━━━━━━━━━━━━

STEP 2: CREATE A FACEBOOK APP

1. Click on "Create App"
2. Select "Business" as the app type
3. Fill in the required details:
   · App Display Name
   · Contact Email
4. Click "Create App"

━━━━━━━━━━━━━━━━━━━━

STEP 3: ADD MESSENGER AND GENERATE ACCESS TOKEN

1. In your app dashboard, click "Add Product"
2. Find "Messenger" and click "Set Up"
3. Scroll to the "Access Tokens" section
4. Click "Add or Remove Pages" and connect your Facebook Page
5. Click "Generate Token" and copy the Page Access Token

⚠️ Save this token securely! You'll need it in the next step.

━━━━━━━━━━━━━━━━━━━━

STEP 4: CONFIGURE YOUR PROJECT AND DEPLOY

1. Go to your project repository (GitHub, GitLab, etc.)
2. Make sure your storage/tokens.json is properly configured or use the Connect Page section in the dashboard
3. Deploy your project to Render or Railway:
   · Render: Get the live link (e.g., https://your-app.onrender.com)
   · Railway: Get the public domain URL

💡 Make sure your deployment is successful and the app is running before proceeding!

━━━━━━━━━━━━━━━━━━━━

STEP 5: SET UP WEBHOOKS

1. Go back to your Facebook app dashboard
2. Navigate to Messenger API Settings → Webhooks
3. Click "Add Callback URL" or "Setup Webhooks"
4. Enter the following:
   · Callback URL: https://your-deployment-url.com/webhook
   · Verify Token: autopagebot
5. Subscribe to these fields:
   · messages
   · messaging_optins
   · messaging_postbacks
6. Click "Verify and Save"
7. Add your page subscription to complete the webhook setup

━━━━━━━━━━━━━━━━━━━━

STEP 6: CONFIGURE PRIVACY POLICY (Required for Public App)

1. Go to Free Privacy Policy Generator
2. Generate your free privacy policy
3. Copy the privacy policy URL
4. In your Facebook app dashboard, go to App Settings → Basic
5. Scroll to "Privacy Policy URL" and paste your privacy policy link
6. Save the changes

━━━━━━━━━━━━━━━━━━━━

STEP 7: MAKE YOUR APP LIVE

1. In your app dashboard, look for the toggle to make your app "Live"
2. Switch your app from "Development" mode to "Live" mode
3. After making it live, generate a new Page Access Token
4. Update your connection using the Connect Page section in this dashboard
5. Redeploy your project if necessary

━━━━━━━━━━━━━━━━━━━━

STEP 8: TEST YOUR MESSENGER BOT

1. Go to your Facebook Page
2. Send a message to your page (e.g., type "help" to see available commands)
3. Check if the bot responds correctly

✅ SUCCESS! If your bot responds, congratulations! Your Messenger bot is now live and working!

━━━━━━━━━━━━━━━━━━━━

📌 QUICK COMMANDS:

• config PAGE_TOKEN - Connect your bot
• config PAGE_TOKEN | ADMIN_NAME - Connect with admin name
• config PAGE_TOKEN | ADMIN_NAME | PAGE_NAME - Connect with both
• config disconnect PAGE_TOKEN - Disconnect bot
• config - Show webhook info
• config guide - Show this tutorial again`;

        await sendMessage(senderId, { text: guideMessage }, pageAccessToken);

    } catch (error) {
        console.error('Error showing setup guide:', error);
        await sendMessage(senderId, { text: `❌ Failed to show guide: ${error.message}` }, pageAccessToken);
    }
}

// Handle piped config command: config PAGE TOKEN | ADMIN NAME | PAGE NAME
async function handlePipedConfig(senderId, args, pageAccessToken) {
    try {
        const commandText = args.join(' ');
        const parts = commandText.split('|').map(part => part.trim());
        
        // Remove 'config' from first part if present
        let pageToken = parts[0];
        if (pageToken.toLowerCase().startsWith('config ')) {
            pageToken = pageToken.substring(7).trim();
        } else if (pageToken.toLowerCase() === 'config') {
            pageToken = '';
        }
        
        const adminName = parts[1] || '';
        const pageName = parts[2] || '';

        if (!pageToken) {
            await sendMessage(senderId, { 
                text: `❌ Please provide a Page Token.\n\n📌 Usage:\nconfig PAGE_TOKEN | ADMIN_NAME | PAGE_NAME\n\nExample:\nconfig EAAH123456789 | John Doe | My Cool Page\n\nFor complete setup guide: config guide`
            }, pageAccessToken);
            return;
        }

        // Validate token format
        if (pageToken.length < 20) {
            await sendMessage(senderId, { text: '❌ Invalid Page Token. Please provide a valid Facebook Page Access Token.' }, pageAccessToken);
            return;
        }

        await sendMessage(senderId, { text: '🔄 Verifying token and connecting page...' }, pageAccessToken);

        // Verify token and get page info
        const response = await fetch(`https://graph.facebook.com/v23.0/me?access_token=${pageToken}`);
        const data = await response.json();

        if (data.error) {
            await sendMessage(senderId, { text: `❌ Invalid Token: ${data.error.message}\n\nPlease check your Page Access Token and try again.\n\nNeed help? Type: config guide` }, pageAccessToken);
            return;
        }

        const pageId = data.id;
        const name = pageName || data.name || 'Unnamed Page';
        const username = data.username || pageId;
        const finalAdminName = adminName || 'Connected via Command';

        // Check if page already connected
        const existing = await tokenManager.getToken(pageId);
        if (existing) {
            await sendMessage(senderId, { 
                text: `⚠️ Page "${existing.name}" is already connected!\n\n` +
                      `📄 Page ID: ${pageId}\n` +
                      `👤 Admin: ${existing.owner}\n` +
                      `📅 Connected at: ${new Date(existing.connectedAt).toLocaleString()}\n\n` +
                      `🔌 To disconnect, use: config disconnect ${pageToken.substring(0, 20)}...` 
            }, pageAccessToken);
            return;
        }

        // Add the token
        await tokenManager.addToken(pageId, {
            token: pageToken,
            name: name,
            username: username,
            owner: finalAdminName,
            connectedAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            connectedVia: 'command',
            connectedBy: senderId
        });

        // Setup webhook for the page
        try {
            await setupPageWebhook(pageId, pageToken);
        } catch (webhookError) {
            console.error('Webhook setup error:', webhookError);
        }

        // Send success message
        const successMessage = `✅ Bot Connected Successfully!\n\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n` +
                              `📄 Page Name: ${name}\n` +
                              `🆔 Page ID: ${pageId}\n` +
                              `👤 Admin: ${finalAdminName}\n` +
                              `🔗 Username: @${username}\n` +
                              `📅 Connected: ${new Date().toLocaleString()}\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n\n` +
                              `🔧 Webhook URL:\n` +
                              `https://automated-fbpagebot.onrender.com/webhook\n\n` +
                              `🔐 Verify Token: autopagebot\n\n` +
                              `💡 Messenger Link: m.me/${username}\n\n` +
                              `🔌 To disconnect: config disconnect ${pageToken.substring(0, 15)}...\n\n` +
                              `📚 For complete setup guide: config guide`;

        await sendMessage(senderId, { text: successMessage }, pageAccessToken);

        setTimeout(async () => {
            await sendMessage(senderId, { text: '🎉 Bot is now active! Make sure your webhook is properly configured in Facebook App.\n\nType "config guide" for the full setup tutorial if needed.' }, pageAccessToken);
        }, 2000);

        console.log(`✅ New bot connected: ${name} (${pageId}) by ${finalAdminName}`);

    } catch (error) {
        console.error('Error in handlePipedConfig:', error);
        await sendMessage(senderId, { text: `❌ Failed to connect page: ${error.message}\n\nType "config guide" for setup help.` }, pageAccessToken);
    }
}

// Show webhook configuration information
async function showWebhookConfig(senderId, pageAccessToken) {
    try {
        const configMessage = `🔧 Facebook Webhook Configuration\n\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n\n` +
                              `📡 Webhook URL:\n` +
                              `https://automated-fbpagebot.onrender.com/webhook\n\n` +
                              `🔐 Verify Token:\n` +
                              `autopagebot\n\n` +
                              `📋 API Version:\n` +
                              `v23.0\n\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n\n` +
                              `How to configure your Facebook App:\n\n` +
                              `1️⃣ Go to developers.facebook.com/apps\n` +
                              `2️⃣ Select your app → Messenger → Settings\n` +
                              `3️⃣ Click "Add Callback URL"\n` +
                              `4️⃣ Paste the Webhook URL above\n` +
                              `5️⃣ Enter Verify Token: autopagebot\n` +
                              `6️⃣ Verify and save\n` +
                              `7️⃣ Subscribe to events: messages, messaging_postbacks\n\n` +
                              `⚠️ Important: Make sure your server is publicly accessible!\n` +
                              `💡 For local testing, use ngrok or similar tunneling service.\n\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n` +
                              `📌 Available Commands:\n\n` +
                              `• config PAGE_TOKEN - Connect your bot\n` +
                              `• config PAGE_TOKEN | ADMIN_NAME | PAGE_NAME - Connect with options\n` +
                              `• config disconnect PAGE_TOKEN - Disconnect bot\n` +
                              `• config guide - View complete setup tutorial`;

        await sendMessage(senderId, { text: configMessage }, pageAccessToken);

    } catch (error) {
        console.error('Error showing webhook config:', error);
        await sendMessage(senderId, { text: `❌ Failed to get webhook config: ${error.message}` }, pageAccessToken);
    }
}

// Handle connecting a new page (without pipe)
async function handleConnect(senderId, args, pageAccessToken) {
    try {
        let pageToken = args[0];
        let pageName = '';
        let ownerName = '';

        // Parse optional arguments
        if (args.length > 1) {
            const fullArgs = args.join(' ');
            const match = fullArgs.match(/"([^"]+)"|'([^']+)'|(\S+)/g);

            if (match && match.length > 1) {
                let nameIndex = 1;
                if (match[1] && (match[1].startsWith('"') || match[1].startsWith("'"))) {
                    pageName = match[1].replace(/^["']|["']$/g, '');
                    nameIndex = 2;
                } else {
                    pageName = match[1];
                    nameIndex = 2;
                }

                if (match[nameIndex] && (match[nameIndex].startsWith('"') || match[nameIndex].startsWith("'"))) {
                    ownerName = match[nameIndex].replace(/^["']|["']$/g, '');
                } else if (match[nameIndex]) {
                    ownerName = match[nameIndex];
                }
            } else if (args.length > 1) {
                pageName = args[1];
                if (args.length > 2) ownerName = args[2];
            }
        }

        // Validate token format
        if (!pageToken || pageToken.length < 20) {
            await sendMessage(senderId, { text: '❌ Invalid Page Token. Please provide a valid Facebook Page Access Token.' }, pageAccessToken);
            return;
        }

        await sendMessage(senderId, { text: '🔄 Verifying token and connecting page...' }, pageAccessToken);

        // Verify token and get page info
        const response = await fetch(`https://graph.facebook.com/v23.0/me?access_token=${pageToken}`);
        const data = await response.json();

        if (data.error) {
            await sendMessage(senderId, { text: `❌ Invalid Token: ${data.error.message}\n\nPlease check your Page Access Token and try again.\n\nNeed help? Type: config guide` }, pageAccessToken);
            return;
        }

        const pageId = data.id;
        const name = pageName || data.name || 'Unnamed Page';
        const username = data.username || pageId;
        const finalOwnerName = ownerName || 'Connected via Command';

        // Check if page already connected
        const existing = await tokenManager.getToken(pageId);
        if (existing) {
            await sendMessage(senderId, { 
                text: `⚠️ Page "${existing.name}" is already connected!\n\n` +
                      `📄 Page ID: ${pageId}\n` +
                      `👤 Connected by: ${existing.owner}\n` +
                      `📅 Connected at: ${new Date(existing.connectedAt).toLocaleString()}\n\n` +
                      `🔌 To disconnect, use: config disconnect ${pageToken.substring(0, 20)}...` 
            }, pageAccessToken);
            return;
        }

        // Add the token
        await tokenManager.addToken(pageId, {
            token: pageToken,
            name: name,
            username: username,
            owner: finalOwnerName,
            connectedAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            connectedVia: 'command',
            connectedBy: senderId
        });

        // Setup webhook for the page
        try {
            await setupPageWebhook(pageId, pageToken);
        } catch (webhookError) {
            console.error('Webhook setup error:', webhookError);
        }

        // Send success message
        const successMessage = `✅ Bot Connected Successfully!\n\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n` +
                              `📄 Page Name: ${name}\n` +
                              `🆔 Page ID: ${pageId}\n` +
                              `👤 Owner: ${finalOwnerName}\n` +
                              `🔗 Username: @${username}\n` +
                              `📅 Connected: ${new Date().toLocaleString()}\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n\n` +
                              `🔧 Webhook URL:\n` +
                              `https://automated-fbpagebot.onrender.com/webhook\n\n` +
                              `🔐 Verify Token: autopagebot\n\n` +
                              `💡 Messenger Link: m.me/${username}\n\n` +
                              `🔌 To disconnect: config disconnect ${pageToken.substring(0, 15)}...\n\n` +
                              `📚 For complete setup guide: config guide`;

        await sendMessage(senderId, { text: successMessage }, pageAccessToken);

        setTimeout(async () => {
            await sendMessage(senderId, { text: '🎉 Bot is now active! Make sure your webhook is properly configured in Facebook App.' }, pageAccessToken);
        }, 2000);

        console.log(`✅ New bot connected: ${name} (${pageId}) by ${finalOwnerName}`);

    } catch (error) {
        console.error('Error in handleConnect:', error);
        await sendMessage(senderId, { text: `❌ Failed to connect page: ${error.message}\n\nType "config guide" for setup help.` }, pageAccessToken);
    }
}

// Handle disconnecting a page
async function handleDisconnect(senderId, args, pageAccessToken) {
    try {
        if (args.length === 0) {
            await sendMessage(senderId, { 
                text: `🔌 Disconnect Bot Usage\n\n` +
                      `To disconnect a bot, provide the Page Token:\n` +
                      `config disconnect PAGE_TOKEN\n\n` +
                      `📝 Example:\n` +
                      `config disconnect EAAH...\n\n` +
                      `📋 To see all connected pages, use: listsessions\n\n` +
                      `📚 For setup guide: config guide` 
            }, pageAccessToken);
            return;
        }

        const pageToken = args[0];

        if (!pageToken || pageToken.length < 10) {
            await sendMessage(senderId, { text: '❌ Please provide a valid Page Token to disconnect.' }, pageAccessToken);
            return;
        }

        await sendMessage(senderId, { text: '🔄 Verifying token and finding page...' }, pageAccessToken);

        // Verify token to get page ID
        const response = await fetch(`https://graph.facebook.com/v23.0/me?access_token=${pageToken}`);
        const data = await response.json();

        if (data.error) {
            await sendMessage(senderId, { text: `❌ Invalid Token: ${data.error.message}\n\nCannot identify page to disconnect.` }, pageAccessToken);
            return;
        }

        const pageId = data.id;
        const tokenData = await tokenManager.getToken(pageId);

        if (!tokenData) {
            await sendMessage(senderId, { text: `❌ No active session found for this token.\n\nPage ID: ${pageId}\nThis page is not connected to this bot.` }, pageAccessToken);
            return;
        }

        // Perform disconnect
        await tokenManager.removeToken(pageId);

        const successMessage = `✅ Page Disconnected Successfully!\n\n` +
                              `📄 Page: ${tokenData.name}\n` +
                              `🆔 ID: ${pageId}\n` +
                              `👤 Admin: ${tokenData.owner}\n` +
                              `📅 Connected until: ${new Date(tokenData.connectedAt).toLocaleString()}\n\n` +
                              `The bot will no longer respond to messages from this page.\n\n` +
                              `💡 To reconnect, use: config PAGE_TOKEN | ADMIN_NAME | PAGE_NAME\n\n` +
                              `📚 For setup guide: config guide`;

        await sendMessage(senderId, { text: successMessage }, pageAccessToken);
        console.log(`🔌 Page disconnected: ${tokenData.name} (${pageId}) by ${senderId}`);

    } catch (error) {
        console.error('Error in handleDisconnect:', error);
        await sendMessage(senderId, { text: `❌ Failed to disconnect: ${error.message}` }, pageAccessToken);
    }
}

// Show usage information
async function showUsage(senderId, pageAccessToken) {
    await sendMessage(senderId, { 
        text: `🤖 Bot Configuration Commands\n\n` +
              `━━━━━━━━━━━━━━━━━━━━\n\n` +
              `📌 To connect a page:\n` +
              `config PAGE_TOKEN\n\n` +
              `📌 With admin name (optional):\n` +
              `config PAGE_TOKEN | ADMIN_NAME\n\n` +
              `📌 With admin name and page name (both optional):\n` +
              `config PAGE_TOKEN | ADMIN_NAME | PAGE_NAME\n\n` +
              `📝 Examples:\n` +
              `• config EAAH123456789\n` +
              `• config EAAH123456789 | John Doe\n` +
              `• config EAAH123456789 | John Doe | My Cool Page\n\n` +
              `━━━━━━━━━━━━━━━━━━━━\n\n` +
              `🔌 To disconnect a page:\n` +
              `config disconnect PAGE_TOKEN\n\n` +
              `⚙️ To see webhook config:\n` +
              `config\n\n` +
              `📚 For complete setup tutorial:\n` +
              `config guide`
    }, pageAccessToken);
}

// Setup webhook for a page
async function setupPageWebhook(pageId, pageToken) {
    try {
        const webhookUrl = 'https://automated-fbpagebot.onrender.com/webhook';
        const verifyToken = 'autopagebot';

        // Subscribe app to page
        const subscribeRes = await fetch(`https://graph.facebook.com/v23.0/${pageId}/subscribed_apps?access_token=${pageToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (subscribeRes.ok) {
            console.log(`✅ Webhook subscription configured for page ${pageId}`);
        }

        // Set up messenger profile webhook
        await fetch(`https://graph.facebook.com/v23.0/me/messenger_profile?access_token=${pageToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                webhook: {
                    url: webhookUrl,
                    verify_token: verifyToken
                },
                fields: ['messages', 'messaging_postbacks', 'messaging_optins']
            })
        }).catch(() => null);

    } catch (error) {
        console.error(`Failed to setup webhook for ${pageId}:`, error.message);
    }
}