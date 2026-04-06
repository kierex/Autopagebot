const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

// Store active temp emails per user
const activeEmails = new Map();

module.exports = {
    name: ['tempmail'],
    usage: 'tempmail gen or tempmail inbox [email]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'tools',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        const action = args[0]?.toLowerCase();

        // Handle generate
        if (action === 'gen' || action === 'generate' || action === 'new') {
            return await generateEmail(senderId, pageAccessToken);
        }

        // Handle inbox
        if (action === 'inbox') {
            const email = args[1];
            if (!email) {
                // Check if user has stored email
                const stored = activeEmails.get(senderId);
                if (stored) {
                    return await checkInbox(senderId, stored.email, pageAccessToken);
                }
                return sendMessage(senderId, {
                    text: `📧 Please provide an email address!\n\n📝 Usage: tempmail inbox [email]\n\n✨ Example: tempmail inbox abc123@temp-mail.org`
                }, pageAccessToken);
            }
            return await checkInbox(senderId, email, pageAccessToken);
        }

        // Default - show help
        return sendMessage(senderId, {
            text: `📧 𝗧𝗘𝗠𝗣 𝗠𝗔𝗜𝗟 𝗠𝗔𝗡𝗔𝗚𝗘𝗥

📝 𝗨𝘀𝗮𝗴𝗲:
• Generate email: tempmail gen
• Check inbox: tempmail inbox [email]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• tempmail gen
• tempmail inbox abc123@temp-mail.org

💡 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Generate temporary email
• Check inbox for messages
• No registration needed
• Perfect for temporary registrations`
        }, pageAccessToken);
    }
};

async function generateEmail(senderId, pageAccessToken) {
    await sendMessage(senderId, { text: '📧 Generating temporary email...' }, pageAccessToken);

    try {
        const response = await axios.post('https://api.internal.temp-mail.io/api/v3/email/new');
        const email = response.data.email;

        if (!email) {
            throw new Error('Failed to generate email');
        }

        // Store email for user
        activeEmails.set(senderId, {
            email: email,
            createdAt: Date.now()
        });

        // Auto cleanup after 1 hour
        setTimeout(() => {
            if (activeEmails.has(senderId)) {
                activeEmails.delete(senderId);
            }
        }, 60 * 60 * 1000);

        const phTime = new Date().toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const message = `📧 𝗧𝗘𝗠𝗣𝗢𝗥𝗔𝗥𝗬 𝗘𝗠𝗔𝗜𝗟 𝗚𝗘𝗡𝗘𝗥𝗔𝗧𝗘𝗗

✅ Email: ${email}
⏱️ Expires in: 1 hour

━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 𝗛𝗼𝘄 𝘁𝗼 𝘂𝘀𝗲:
• Check inbox: tempmail inbox ${email}
• Generate new: tempmail gen

━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Generated: ${phTime}

💡 Use this email for temporary registrations!`;

        await sendMessage(senderId, { text: message }, pageAccessToken);

    } catch (error) {
        console.error('TempMail Generate Error:', error.message);
        await sendMessage(senderId, {
            text: '❌ Failed to generate temporary email. Please try again later.'
        }, pageAccessToken);
    }
}

async function checkInbox(senderId, email, pageAccessToken) {
    await sendMessage(senderId, { text: `📬 Checking inbox for ${email}...` }, pageAccessToken);

    try {
        const response = await axios.get(`https://api.internal.temp-mail.io/api/v3/email/${email}/messages`);
        const messages = response.data;

        if (!messages || messages.length === 0) {
            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            return sendMessage(senderId, {
                text: `📭 𝗜𝗡𝗕𝗢𝗫 𝗜𝗦 𝗘𝗠𝗣𝗧𝗬

📧 Email: ${email}
📅 Checked: ${phTime}

No messages yet.

💡 Try again later or send a test email!`
            }, pageAccessToken);
        }

        // Get latest messages (up to 5)
        const latestMessages = messages.slice(0, 5);
        
        let inboxMessage = `📬 𝗜𝗡𝗕𝗢𝗫 𝗙𝗢𝗥: ${email}\n`;
        inboxMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        inboxMessage += `📊 Total messages: ${messages.length}\n\n`;

        for (let i = 0; i < latestMessages.length; i++) {
            const msg = latestMessages[i];
            const receivedDate = new Date(msg.received_at * 1000).toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            inboxMessage += `📧 𝗠𝗲𝘀𝘀𝗮𝗴𝗲 #${i + 1}\n`;
            inboxMessage += `📌 From: ${msg.from || 'Unknown'}\n`;
            inboxMessage += `📝 Subject: ${msg.subject || 'No Subject'}\n`;
            inboxMessage += `📅 Received: ${receivedDate}\n`;
            
            if (msg.body_text) {
                const preview = msg.body_text.length > 200 ? msg.body_text.substring(0, 200) + '...' : msg.body_text;
                inboxMessage += `📄 Preview: ${preview}\n`;
            }
            
            inboxMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        }

        inboxMessage += `💡 Type -tempmail gen to generate a new email\n`;
        inboxMessage += `📬 Check again: tempmail inbox ${email}`;

        await sendMessage(senderId, { text: inboxMessage }, pageAccessToken);

    } catch (error) {
        console.error('TempMail Inbox Error:', error.message);
        
        // Check if email is invalid
        if (error.response?.status === 404) {
            await sendMessage(senderId, {
                text: `❌ Email not found: ${email}\n\nPlease check the email address or generate a new one with: tempmail gen`
            }, pageAccessToken);
        } else {
            await sendMessage(senderId, {
                text: `❌ Failed to fetch inbox for: ${email}\n\nPlease try again later.`
            }, pageAccessToken);
        }
    }
}