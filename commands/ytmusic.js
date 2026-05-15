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
            const videoUrl = `https://www.youtube.com/watch?v=${song.id}`;

            // Fetch audio download
            const downloadResponse = await axios.get(DOWNLOAD_URL, {
                params: {
                    url: videoUrl
                }
            });

            const { download, quality, fileSize, title } = downloadResponse.data;

            if (!download) {
                return sendMessage(senderId, { text: '❌ 𝖥𝖺𝗂𝗅𝖾𝖽 𝗍𝗈 𝗀𝖾𝗇𝖾𝗋𝖺𝗍𝖾 𝖺𝗎𝖽𝗂𝗈 𝗅𝗂𝗇𝗄.' }, pageAccessToken);
            }

            // Send only the audio file - no duplicate messages
            await sendMessage(senderId, {
                attachment: {
                    type: 'audio',
                    payload: {
                        url: download
                    }
                }
            }, pageAccessToken);

        } catch (error) {
            console.error('Error:', error);
            sendMessage(senderId, { text: '❌ 𝖤𝗋𝗋𝗈𝗋: 𝖴𝗇𝖾𝗑𝗉𝖾𝖼𝗍𝖾𝖽 𝖾𝗋𝗋𝗈𝗋 𝗈𝖼𝖼𝗎𝗋𝗋𝖾𝖽. 𝖯𝗅𝖾𝖺𝗌𝖾 𝗍𝗋𝗒 𝖺𝗀𝖺𝗂𝗇 𝗅𝖺𝗍𝖾𝗋.' }, pageAccessToken);
        }
    }
};