const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['soundcloudv2]',
    usage: 'soundcloud [song name]',
    version: '1.0.0',
    author: 'yazky',
    category: 'music',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        const query = args.join(' ');
        
        if (!query) {
            return sendMessage(senderId, {
                text: `🎵 SoundCloud Music\n\nUsage: soundcloud [song name]\nExample: soundcloud Alan Walker Faded`
            }, pageAccessToken);
        }

        await sendMessage(senderId, { text: `🔍 Searching...` }, pageAccessToken);

        try {
            const searchRes = await axios.get(
                `https://betadash-search-download.vercel.app/sc?search=${encodeURIComponent(query)}`
            );

            const firstResult = searchRes.data.results?.[0];
            if (!firstResult) throw new Error('No results');

            const audioRes = await axios.get(
                `https://betadash-search-download.vercel.app/scdl?url=${encodeURIComponent(firstResult.data.permalink_url)}`
            );

            const audioUrl = audioRes.data.results?.audioUrl;
            if (!audioUrl) throw new Error('No audio URL');

            await sendMessage(senderId, {
                attachment: {
                    type: 'audio',
                    payload: { url: audioUrl, is_reusable: true }
                }
            }, pageAccessToken);

        } catch (error) {
            await sendMessage(senderId, { text: '❌ Failed to get audio' }, pageAccessToken);
        }
    }
};