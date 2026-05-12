const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

// Cooldown storage (per user)
const userCooldowns = new Map();
const COOLDOWN_TIME = 180000; // 3 minutes (180,000 milliseconds)

module.exports = {
    name: ['smsbomb', 'smsbomber', 'bomb'],
    usage: 'smsbomb [phone] | [amount]',
    description: 'Send SMS bomber to a phone number (3 minute cooldown)',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'tools',
    cooldown: 180, // 180 seconds = 3 minutes

    async execute(senderId, args, pageAccessToken) {
        // Check cooldown first
        const lastUsed = userCooldowns.get(senderId);
        if (lastUsed && (Date.now() - lastUsed) < COOLDOWN_TIME) {
            const remainingSeconds = Math.ceil((COOLDOWN_TIME - (Date.now() - lastUsed)) / 1000);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            
            let timeText = '';
            if (minutes > 0) {
                timeText = `${minutes} minute${minutes > 1 ? 's' : ''} and ${seconds} second${seconds > 1 ? 's' : ''}`;
            } else {
                timeText = `${seconds} second${seconds > 1 ? 's' : ''}`;
            }
            
            await sendMessage(senderId, {
                text: `⏱️ *Cooldown Active*\n\n` +
                      `Please wait ${timeText} before using this command again.\n\n` +
                      `⏰ *Cooldown Period:* 3 minutes\n` +
                      `💡 This helps prevent abuse of the SMS bombing service.`
            }, pageAccessToken);
            return;
        }

        // Check if phone number and amount are provided
        if (args.length < 2) {
            await sendMessage(senderId, { 
                text: `📱 *SMS Bomber Tool*\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `⚠️ *Warning:* Use responsibly. This tool sends SMS messages to the target number.\n\n` +
                      `✨ *Usage:*\n` +
                      `smsbomb [phone] | [amount]\n\n` +
                      `📝 *Example:*\n` +
                      `smsbomb 09123456789 | 10\n\n` +
                      `📊 *Amount Range:* 1-100 messages\n` +
                      `⏱️ *Cooldown:* 3 minutes\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━\n` +
                      `💡 *Note:* Using this on numbers without consent may violate laws.`
            }, pageAccessToken);
            return;
        }

        // Parse args with | separator
        let phone, amount;
        const separatorIndex = args.findIndex(arg => arg === '|');

        if (separatorIndex !== -1) {
            phone = args.slice(0, separatorIndex).join(' ');
            amount = parseInt(args[separatorIndex + 1]);
        } else {
            // Fallback to traditional format
            phone = args[0];
            amount = parseInt(args[1]);
        }

        const apiKey = '79d08d76a3deae3fae1c7637141db818ec02faf1e3597e302c4ed9e1d5211d89';

        // Validate phone number
        if (!phone || phone.length < 10) {
            await sendMessage(senderId, { text: '❌ Invalid phone number. Please provide a valid phone number.' }, pageAccessToken);
            return;
        }

        // Validate amount
        if (isNaN(amount) || amount < 1 || amount > 100) {
            await sendMessage(senderId, { text: '❌ Amount must be between 1 and 100' }, pageAccessToken);
            return;
        }

        await sendMessage(senderId, { text: `🔄 Starting SMS bombing to ${phone} with ${amount} messages...\n\n⏱️ Please wait.` }, pageAccessToken);

        try {
            const response = await axios.get('https://haji-mix-api.gleeze.com/api/smsbomber', {
                params: {
                    phone: phone,
                    amount: amount,
                    api_key: apiKey
                },
                timeout: 30000
            });

            if (response.data && response.data.success) {
                // Set cooldown after successful execution
                userCooldowns.set(senderId, Date.now());
                
                const message = `✅ *SMS Bombing Initiated!*\n\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n\n` +
                              `📱 *Target Number:* ${phone}\n` +
                              `🔢 *Amount:* ${amount} messages\n` +
                              `📡 *Status:* ${response.data.message || 'Successfully sent'}\n\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n\n` +
                              `⚠️ *Disclaimer:* Use this tool responsibly.\n` +
                              `⏱️ *Next use available in 3 minutes*`;
                
                await sendMessage(senderId, { text: message }, pageAccessToken);
                console.log(`✅ SMS bomb sent to ${phone} (${amount} messages) by user ${senderId}`);
            } else {
                await sendMessage(senderId, { 
                    text: `❌ *Failed to Start SMS Bombing*\n\n` +
                          `Error: ${response.data?.message || 'Unknown error'}\n\n` +
                          `💡 Please check the phone number and try again later.`
                }, pageAccessToken);
            }
        } catch (error) {
            console.error('SMS Bomber Error:', error);
            
            let errorMessage = `❌ *Error Occurred*\n\n`;
            
            if (error.code === 'ECONNABORTED') {
                errorMessage += `Connection timeout. The server is taking too long to respond.\n\n`;
            } else if (error.response) {
                errorMessage += `API Error: ${error.response.status}\n`;
                errorMessage += `Message: ${error.response.data?.message || 'Unknown error'}\n\n`;
            } else if (error.request) {
                errorMessage += `No response from API server. Please try again later.\n\n`;
            } else {
                errorMessage += `${error.message}\n\n`;
            }
            
            errorMessage += `💡 Please check the phone number format and try again.\n` +
                           `📱 Example: smsbomb 09123456789 | 10`;
            
            await sendMessage(senderId, { text: errorMessage }, pageAccessToken);
        }
    }
};

// Clean up cooldowns periodically
setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of userCooldowns) {
        if (now - timestamp > COOLDOWN_TIME) {
            userCooldowns.delete(userId);
        }
    }
}, 60000); // Clean up every minute