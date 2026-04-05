const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['pastebin', 'paste', 'pb'],
    usage: 'pastebin [text]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'tools',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `📝 𝗣𝗔𝗦𝗧𝗘𝗕𝗜𝗡 𝗦𝗘𝗥𝗩𝗜𝗖𝗘

📌 𝗨𝘀𝗮𝗴𝗲: pastebin [your text]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• pastebin Hello World
• pastebin This is my code
• pastebin Long text that needs sharing

🔗 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Share long text easily
• Get a permanent link
• Perfect for code or notes

💡 Aliases: pastebin, paste, pb`
            }, pageAccessToken);
        }

        const text = args.join(' ');

        // Send loading message
        await sendMessage(senderId, { 
            text: '📝 Creating your pastebin link...' 
        }, pageAccessToken);

        try {
            const apiUrl = `https://yin-api.vercel.app/tools/pastebin?text=${encodeURIComponent(text)}`;
            const response = await axios.get(apiUrl);
            
            const data = response.data;
            
            if (!data || !data.answer) {
                throw new Error('API error');
            }
            
            const pasteUrl = data.answer;
            
            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            const message = `✅ 𝗣𝗮𝘀𝘁𝗲𝗯𝗶𝗻 𝗰𝗿𝗲𝗮𝘁𝗲𝗱!

📝 𝗧𝗲𝘅𝘁: ${text.length > 50 ? text.substring(0, 50) + '...' : text}
📊 𝗟𝗲𝗻𝗴𝘁𝗵: ${text.length} characters
🔗 𝗟𝗶𝗻𝗸: ${pasteUrl}
📅 𝗖𝗿𝗲𝗮𝘁𝗲𝗱: ${phTime}

💡 Share this link anywhere!`;
            
            await sendMessage(senderId, { text: message }, pageAccessToken);
            
        } catch (error) {
            console.error('Pastebin Error:', error.message);
            
            await sendMessage(senderId, {
                text: '❌ Failed to create pastebin link. Please try again later.'
            }, pageAccessToken);
        }
    }
};