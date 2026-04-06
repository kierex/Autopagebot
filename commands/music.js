const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ytSearch = require('yt-search');
const { sendMessage } = require('../handles/sendMessage');

const CONFIG_URL = 'https://raw.githubusercontent.com/aryannix/stuffs/master/raw/apis.json';

async function downloadSong(baseApi, url, senderId, pageAccessToken, title = null) {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    try {
        const apiUrl = `${baseApi}/play?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (!data.status || !data.downloadUrl) throw new Error('API failed');

        const songTitle = title || data.title;
        const fileName = `${songTitle.replace(/[\\/:"*?<>|]/g, '')}.mp3`;
        const filePath = path.join(tempDir, fileName);

        const songData = await axios.get(data.downloadUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(filePath, Buffer.from(songData.data));

        await sendMessage(senderId, {
            attachment: {
                type: 'audio',
                payload: { url: filePath, is_reusable: true }
            }
        }, pageAccessToken);

        fs.unlinkSync(filePath);

    } catch (error) {
        console.error('Download Error:', error.message);
        await sendMessage(senderId, { text: `❌ Failed: ${error.message}` }, pageAccessToken);
    }
}

module.exports = {
    name: ['music'],
    usage: 'song [song name]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'music',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎵 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗠𝘂𝘀𝗶𝗰\n\nUsage: song [song name]\nExample: song Shape of You`
            }, pageAccessToken);
        }

        let baseApi;
        try {
            const configRes = await axios.get(CONFIG_URL);
            baseApi = configRes.data?.api;
            if (!baseApi) throw new Error();
        } catch (error) {
            return sendMessage(senderId, { text: '❌ API config error' }, pageAccessToken);
        }

        const query = args.join(' ');

        if (query.startsWith('http')) {
            return await downloadSong(baseApi, query, senderId, pageAccessToken);
        }

        await sendMessage(senderId, { text: `🔍 Searching "${query}"...` }, pageAccessToken);

        try {
            const searchRes = await ytSearch(query);
            const results = searchRes.videos.slice(0, 3);

            if (!results.length) {
                return sendMessage(senderId, { text: '❌ No results found' }, pageAccessToken);
            }

            // Download the first result directly
            await downloadSong(baseApi, results[0].url, senderId, pageAccessToken, results[0].title);

        } catch (error) {
            console.error('Error:', error.message);
            await sendMessage(senderId, { text: '❌ Search failed' }, pageAccessToken);
        }
    }
};