const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const BASE_URL = 'https://betadash-search-download.vercel.app/sc';

module.exports = {
    name: ['soundcloud', 'sc', 'sound', 'scdl'],
    usage: 'soundcloud [song name]',
    version: '1.0.0',
    author: 'Kyu',
    category: 'music',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎵 𝗦𝗢𝗨𝗡𝗗𝗖𝗟𝗢𝗨𝗗 𝗠𝗨𝗦𝗜𝗖 𝗦𝗘𝗔𝗥𝗖𝗛

📝 𝗨𝘀𝗮𝗴𝗲: soundcloud [song name]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• soundcloud Alan Walker Faded
• soundcloud NCS - Cartoon
• sc Marshmello Alone

🎵 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Search SoundCloud songs
• Get audio preview
• Download option for large files
• Fast response

💡 Tip: Use exact song name for better results!`
            }, pageAccessToken);
        }

        const query = args.join(' ');
        await searchSoundCloud(senderId, query, pageAccessToken);
    }
};

async function searchSoundCloud(senderId, query, pageAccessToken) {
    try {
        const url = `${BASE_URL}?search=${encodeURIComponent(query)}`;
        
        // Send loading message
        await sendMessage(senderId, { 
            text: `🎵 Searching SoundCloud for "${query}"...` 
        }, pageAccessToken);
        
        // Check file size
        const headResponse = await axios.head(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/json',
            },
            timeout: 15000
        });

        const fileSize = parseInt(headResponse.headers['content-length'], 10);
        const isTooLarge = fileSize > 25 * 1024 * 1024; // 25MB limit
        
        // Format file size
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        
        // Thumbnail image
        const thumbnail = 'https://i.imgur.com/sVpNeaG.jpeg';
        
        const phTime = new Date().toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const title = `🎵 ${query.toUpperCase()}`;
        const subtitle = isTooLarge
            ? `⚠️ File size: ${fileSizeMB}MB (exceeds 25MB limit). Use download button.`
            : `📥 File size: ${fileSizeMB}MB | Click to listen or download`;

        // Send as template with button
        await sendMessage(senderId, {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: [{
                        title: title,
                        image_url: thumbnail,
                        subtitle: subtitle,
                        buttons: [
                            {
                                type: 'web_url',
                                url: url,
                                title: isTooLarge ? '📥 Download File' : '🎧 Listen Now'
                            }
                        ]
                    }]
                }
            }
        }, pageAccessToken);

        // If file is not too large, send as audio directly
        if (!isTooLarge) {
            await sendMessage(senderId, {
                text: `🎵 Playing: ${query}\n📅 ${phTime}`
            }, pageAccessToken);
            
            await sendMessage(senderId, {
                attachment: {
                    type: 'audio',
                    payload: {
                        url: url,
                        is_reusable: true
                    }
                }
            }, pageAccessToken);
        } else {
            await sendMessage(senderId, {
                text: `⚠️ File too large (${fileSizeMB}MB) to send directly.\n\n💡 Use the download button to save the file.\n\n🎵 Song: ${query}`
            }, pageAccessToken);
        }

    } catch (error) {
        console.error('SoundCloud Error:', error.message);
        
        // Try alternative method
        try {
            const altUrl = `${BASE_URL}?search=${encodeURIComponent(query)}`;
            
            await sendMessage(senderId, {
                attachment: {
                    type: 'audio',
                    payload: {
                        url: altUrl,
                        is_reusable: true
                    }
                }
            }, pageAccessToken);
            
        } catch (altError) {
            await sendMessage(senderId, {
                text: `❌ Music not found or request failed.\n\n📝 Tips:\n• Check the song name spelling\n• Try a different song\n• Use -sc [artist] [song name]\n\n💡 Example: soundcloud Alan Walker Faded`
            }, pageAccessToken);
        }
    }
}