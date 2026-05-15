const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const SEARCH_URL = 'https://betadash-api-swordslush-production.up.railway.app/yt';
const DOWNLOAD_URL = 'https://jonell.ccprojects.gleeze.com/api/d/ytmusicv2';

module.exports = {
    name: ['ytmusic'],
    usage: 'ytmusic <song name>',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'music',
    cooldown: 0,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, { text: '🎵 𝖯𝗅𝖾𝖺𝗌𝖾 𝗉𝗋𝗈𝗏𝗂𝖽𝖾 𝗌𝗈𝗇𝗀 𝗇𝖺𝗆𝖾 𝗍𝗈 𝗌𝖾𝖺𝗋𝖼𝗁.' }, pageAccessToken);
        }

        try {
            // Send typing indicator
            await sendMessage(senderId, { text: '🔍 𝖲𝖾𝖺𝗋𝖼𝗁𝗂𝗇𝗀 𝗌𝗈𝗇𝗀...' }, pageAccessToken);

            // Search for the song
            const searchResponse = await axios.get(SEARCH_URL, {
                params: {
                    search: args.join(' ')
                }
            });

            const items = searchResponse.data?.results?.items;

            if (!items || items.length === 0) {
                return sendMessage(senderId, { text: '❌ 𝖭𝗈 𝗌𝗈𝗇𝗀𝗌 𝖿𝗈𝗎𝗇𝖽. 𝖯𝗅𝖾𝖺𝗌𝖾 𝗍𝗋𝗒 𝖺 𝖽𝗂𝖿𝖿𝖾𝗋𝖾𝗇𝗍 𝗌𝖾𝖺𝗋𝖼𝗁.' }, pageAccessToken);
            }

            // Get the first result
            const song = items[0];
            const videoId = song.id;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            // Send song info with buttons
            await sendMessage(senderId, {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements: [{
                            title: `🎵 ${song.title.substring(0, 80)}`,
                            image_url: song.thumbnail,
                            subtitle: `⏱️ Duration: ${song.duration}\n📺 Author: ${searchResponse.data?.author || 'YouTube'}`,
                            buttons: [
                                {
                                    type: 'web_url',
                                    url: song.url,
                                    title: '▶️ Watch on YouTube'
                                },
                                {
                                    type: 'web_url',
                                    url: `https://jonell.ccprojects.gleeze.com/api/d/ytmusicv2?url=${encodeURIComponent(videoUrl)}`,
                                    title: '⬇️ Download Audio'
                                }
                            ]
                        }]
                    }
                }
            }, pageAccessToken);

            // Try to send direct audio
            try {
                await sendMessage(senderId, { text: '⬇️ 𝖥𝖾𝗍𝖼𝗁𝗂𝗇𝗀 𝖺𝗎𝖽𝗂𝗈, 𝗉𝗅𝖾𝖺𝗌𝖾 𝗐𝖺𝗂𝗍...' }, pageAccessToken);
                
                const downloadResponse = await axios.get(DOWNLOAD_URL, {
                    params: {
                        url: videoUrl
                    }
                });

                const { download, quality, fileSize, title: songTitle } = downloadResponse.data;

                if (download) {
                    // Send audio file
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'audio',
                            payload: {
                                url: download
                            }
                        }
                    }, pageAccessToken);

                    // Send download info
                    await sendMessage(senderId, { 
                        text: `✅ 𝖣𝗈𝗐𝗇𝗅𝗈𝖺𝖽𝖾𝖽: ${songTitle}\n🎵 𝖰𝗎𝖺𝗅𝗂𝗍𝗒: ${quality}\n💾 𝖲𝗂𝗓𝖾: ${fileSize}\n\n📥 𝖣𝗂𝗋𝖾𝖼𝗍 𝗅𝗂𝗇𝗄: ${download}` 
                    }, pageAccessToken);
                } else {
                    await sendMessage(senderId, { text: '⚠️ 𝖠𝗎𝖽𝗂𝗈 𝖽𝗈𝗐𝗇𝗅𝗈𝖺𝖽 𝗅𝗂𝗇𝗄 𝗇𝗈𝗍 𝖺𝗏𝖺𝗂𝗅𝖺𝖻𝗅𝖾.' }, pageAccessToken);
                }
            } catch (downloadError) {
                console.error('Download error:', downloadError);
                await sendMessage(senderId, { text: '⚠️ 𝖢𝗈𝗎𝗅𝖽 𝗇𝗈𝗍 𝖿𝖾𝗍𝖼𝗁 𝖺𝗎𝖽𝗂𝗈 𝖽𝗂𝗋𝖾𝖼𝗍𝗅𝗒. 𝖴𝗌𝖾 𝗍𝗁𝖾 𝖣𝗈𝗐𝗇𝗅𝗈𝖺𝖽 𝖠𝗎𝖽𝗂𝗈 𝖻𝗎𝗍𝗍𝗈𝗇 𝖺𝖻𝗈𝗏𝖾.' }, pageAccessToken);
            }

        } catch (error) {
            console.error('Error fetching song:', error);
            sendMessage(senderId, { text: '❌ 𝖤𝗋𝗋𝗈𝗋: 𝖴𝗇𝖾𝗑𝗉𝖾𝖼𝗍𝖾𝖽 𝖾𝗋𝗋𝗈𝗋 𝗈𝖼𝖼𝗎𝗋𝗋𝖾𝖽. 𝖯𝗅𝖾𝖺𝗌𝖾 𝗍𝗋𝗒 𝖺𝗀𝖺𝗂𝗇 𝗅𝖺𝗍𝖾𝗋.' }, pageAccessToken);
        }
    }
};