const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

// Store active temp emails per user
const activeEmails = new Map();

// Mail.tm API endpoints
const API_BASE = 'https://api.mail.tm';

module.exports = {
    name: ['tempmail'],
    usage: 'tempmail or tempmail inbox',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'tools',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        const action = args[0]?.toLowerCase();
        
        // Handle different actions
        if (action === 'inbox') {
            return await checkInbox(senderId, pageAccessToken);
        }
        
        if (action === 'delete') {
            return await handleDelete(senderId, pageAccessToken);
        }
        
        if (action === 'new') {
            return await handleNew(senderId, pageAccessToken);
        }
        
        // Check if user has an active temp mail
        if (activeEmails.has(senderId)) {
            const emailData = activeEmails.get(senderId);
            const minutesLeft = Math.max(0, 60 - Math.floor((Date.now() - emailData.created) / 60000));
            
            return sendMessage(senderId, {
                text: `📧 𝗔𝗖𝗧𝗜𝗩𝗘 𝗧𝗘𝗠𝗣𝗢𝗥𝗔𝗥𝗬 𝗘𝗠𝗔𝗜𝗟\n\n📧 Email: ${emailData.email}\n⏱️ Expires in: ${minutesLeft} minutes\n\n📝 Commands:\n• -tempmail inbox - Check messages\n• -tempmail delete - Delete email\n• -tempmail new - Create new email`
            }, pageAccessToken);
        }
        
        // Create new temporary email
        return await createTempMail(senderId, pageAccessToken);
    }
};

async function createTempMail(senderId, pageAccessToken) {
    try {
        // Step 1: Get available domains
        const domainsRes = await axios.get(`${API_BASE}/domains`);
        const domain = domainsRes.data['hydra:member'][0].domain;
        
        // Step 2: Generate random username
        const username = Math.random().toString(36).substring(2, 15);
        const email = `${username}@${domain}`;
        
        // Step 3: Create account
        const password = Math.random().toString(36).substring(2, 15);
        const accountData = {
            address: email,
            password: password
        };
        
        const createRes = await axios.post(`${API_BASE}/accounts`, accountData);
        
        if (!createRes.data || !createRes.data.id) {
            throw new Error('Failed to create email');
        }
        
        // Step 4: Get token for authentication
        const tokenRes = await axios.post(`${API_BASE}/token`, accountData);
        const token = tokenRes.data.token;
        
        activeEmails.set(senderId, {
            email: email,
            password: password,
            token: token,
            accountId: createRes.data.id,
            created: Date.now()
        });
        
        // Auto-delete after 60 minutes
        setTimeout(() => {
            if (activeEmails.has(senderId)) {
                activeEmails.delete(senderId);
            }
        }, 60 * 60 * 1000);
        
        const message = `📧 𝗧𝗘𝗠𝗣𝗢𝗥𝗔𝗥𝗬 𝗘𝗠𝗔𝗜𝗟 𝗖𝗥𝗘𝗔𝗧𝗘𝗗

✅ ${email}
⏱️ Expires in: 60 minutes

📝 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀:
• -tempmail inbox - Check messages
• -tempmail delete - Delete email
• -tempmail new - Create new email

💡 Use for temporary registrations!
📌 Powered by Mail.tm`;

        await sendMessage(senderId, { text: message }, pageAccessToken);
        
    } catch (error) {
        console.error('TempMail Create Error:', error.message);
        await sendMessage(senderId, { text: '❌ Failed to create temporary email. Please try again.' }, pageAccessToken);
    }
}

async function checkInbox(senderId, pageAccessToken) {
    const emailData = activeEmails.get(senderId);
    
    if (!emailData) {
        return sendMessage(senderId, {
            text: '❌ No active email! Create one: -tempmail'
        }, pageAccessToken);
    }
    
    try {
        // Get messages using token
        const messagesRes = await axios.get(`${API_BASE}/messages`, {
            headers: {
                'Authorization': `Bearer ${emailData.token}`
            }
        });
        
        const messages = messagesRes.data['hydra:member'] || [];
        
        if (messages.length === 0) {
            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            return sendMessage(senderId, {
                text: `📭 𝗜𝗡𝗕𝗢𝗫 𝗘𝗠𝗣𝗧𝗬

📧 ${emailData.email}
📅 Last checked: ${phTime}

No messages yet.

Check again: -tempmail inbox`
            }, pageAccessToken);
        }
        
        // Get latest message
        const latestMsg = messages[messages.length - 1];
        const msgRes = await axios.get(`${API_BASE}/messages/${latestMsg.id}`, {
            headers: {
                'Authorization': `Bearer ${emailData.token}`
            }
        });
        
        const msg = msgRes.data;
        const phTime = new Date().toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const message = `📬 𝗡𝗘𝗪 𝗘𝗠𝗔𝗜𝗟 𝗥𝗘𝗖𝗘𝗜𝗩𝗘𝗗!

📧 ${emailData.email}
📅 ${phTime}

━━━━━━━━━━━━━━━━

📌 𝗙𝗿𝗼𝗺: ${msg.from?.address || 'Unknown'}
📝 𝗦𝘂𝗯𝗷𝗲𝗰𝘁: ${msg.subject || 'No Subject'}

📄 𝗠𝗲𝘀𝘀𝗮𝗴𝗲:
${(msg.text || msg.html || 'No content').substring(0, 800)}

━━━━━━━━━━━━━━━━

📊 Total messages: ${messages.length}

💡 -tempmail inbox (check again)`;

        await sendMessage(senderId, { text: message }, pageAccessToken);
        
    } catch (error) {
        console.error('Inbox Error:', error.message);
        
        // Token might be expired, try to re-login
        if (error.response?.status === 401) {
            await sendMessage(senderId, { 
                text: '⚠️ Session expired. Please create a new email: -tempmail new' 
            }, pageAccessToken);
            activeEmails.delete(senderId);
        } else {
            await sendMessage(senderId, { text: '❌ Failed to fetch inbox. Please try again.' }, pageAccessToken);
        }
    }
}

async function handleDelete(senderId, pageAccessToken) {
    const emailData = activeEmails.get(senderId);
    
    if (!emailData) {
        return sendMessage(senderId, { 
            text: '❌ No active email found.' 
        }, pageAccessToken);
    }
    
    try {
        // Delete account from server
        await axios.delete(`${API_BASE}/accounts/${emailData.accountId}`, {
            headers: {
                'Authorization': `Bearer ${emailData.token}`
            }
        });
        
        activeEmails.delete(senderId);
        await sendMessage(senderId, { 
            text: '✅ Temporary email deleted successfully!\n\nCreate a new one: -tempmail' 
        }, pageAccessToken);
        
    } catch (error) {
        console.error('Delete Error:', error.message);
        // Still delete locally even if server delete fails
        activeEmails.delete(senderId);
        await sendMessage(senderId, { 
            text: '✅ Email removed from local storage.\n\nCreate a new one: -tempmail' 
        }, pageAccessToken);
    }
}

async function handleNew(senderId, pageAccessToken) {
    if (activeEmails.has(senderId)) {
        const emailData = activeEmails.get(senderId);
        try {
            await axios.delete(`${API_BASE}/accounts/${emailData.accountId}`, {
                headers: {
                    'Authorization': `Bearer ${emailData.token}`
                }
            });
        } catch(e) {}
        activeEmails.delete(senderId);
    }
    await createTempMail(senderId, pageAccessToken);
}