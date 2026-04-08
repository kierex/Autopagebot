const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['shoti'],
    usage: 'shoti',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'fun',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        const apiKey = 'shipazu';
        const apiUrl = `https://betadash-shoti-yazky.vercel.app/shotizxx?apikey=${apiKey}`;

        // Send loading message
        await sendMessage(senderId, { text: '🎬 Fetching Shoti video... Please wait.' }, pageAccessToken);

        try {
            const response = await axios.get(apiUrl, { timeout: 30000 });
            const data = response.data;
            
            const username = data.username;
            const profileUrl = username !== '—' 
                ? `https://www.tiktok.com/@${encodeURIComponent(username.replace(/^@/, ''))}` 
                : '#';

            // Send user info message
            const infoMessage = `🎥 𝗦𝗛𝗢𝗧𝗜 𝗩𝗜𝗗𝗘𝗢

👤 𝗨𝘀𝗲𝗿𝗻𝗮𝗺𝗲: ${username}
📛 𝗡𝗶𝗰𝗸𝗻𝗮𝗺𝗲: ${data.nickname}
🌍 𝗥𝗲𝗴𝗶𝗼𝗻: ${data.region}
🔗 𝗣𝗿𝗼𝗳𝗶𝗹𝗲: ${profileUrl}

📤 Sending video, please wait...`;

            await sendMessage(senderId, { text: infoMessage }, pageAccessToken);

            // Send video if available
            if (data.shotiurl) {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: data.shotiurl,
                            is_reusable: true
                        }
                    },
                    quick_replies: [
                        {
                            content_type: "text",
                            title: "More",
                            payload: "MORE_SHOTI"
                        },
                        {
                            content_type: "text",
                            title: "Help",
                            payload: "HELP"
                        }
                    ]
                }, pageAccessToken);
            } else {
                // Fallback video if no URL
                await sendMessage(senderId, {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: "https://i.imgur.com/1bPqMvK.mp4",
                            is_reusable: true
                        }
                    }
                }, pageAccessToken);
            }

        } catch (error) {
            console.error('Shoti Error:', error.message);
            await sendMessage(senderId, {
                text: '❌ Failed to fetch Shoti video. Please try again later.\n\n💡 Tip: Try again in a few seconds.'
            }, pageAccessToken);
        }
    }
};