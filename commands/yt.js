const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const SEARCH_URL = 'https://haji-mix-api.gleeze.com/api/youtube';
const DOWNLOAD_URL = 'https://haji-mix-api.gleeze.com/api/autodl';
const API_KEY = '79d08d76a3deae3fae1c7637141db818ec02faf1e3597e302c4ed9e1d5211d89';

module.exports = {
    name: ['youtube', 'yt'],
    usage: 'youtube <search query>',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'search',
    cooldown: 0,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, { text: '❌ Please provide a search query.\nUsage: youtube <song/video name>' }, pageAccessToken);
        }

        const query = args.join(' ');

        try {
            // Search for video (limit 1)
            const searchRes = await axios.get(SEARCH_URL, {
                params: {
                    search: query,
                    stream: false,
                    limit: 1,
                    api_key: API_KEY
                }
            });

            const video = searchRes.data?.[0];
            if (!video) {
                return sendMessage(senderId, { text: `❌ No results found for "${query}".` }, pageAccessToken);
            }

            // Get download link
            const downloadRes = await axios.get(DOWNLOAD_URL, {
                params: {
                    url: video.url,
                    stream: false,
                    api_key: API_KEY
                }
            });

            if (!downloadRes.data?.success || !downloadRes.data?.url) {
                return sendMessage(senderId, { text: '❌ Failed to get video download link.' }, pageAccessToken);
            }

            // Send video info as text
            const infoMessage = `🎧 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗩𝗶𝗱𝗲𝗼 𝗥𝗲𝘀𝘂𝗹𝘁 𝗳𝗼𝗿: "${query}"\n\n` +
                `🎬 ${video.title}\n` +
                `👤 ${video.author.name}\n` +
                `⏱️ ${video.duration.timestamp}\n` +
                `👁️ ${formatViews(video.views)}\n` +
                `📅 ${video.ago}\n` +
                `🔗 ${video.url}`;

            await sendMessage(senderId, { text: infoMessage }, pageAccessToken);

            // Send the video
            await sendMessage(senderId, {
                attachment: {
                    type: 'video',
                    payload: {
                        url: downloadRes.data.url,
                        is_reusable: true
                    }
                }
            }, pageAccessToken);

        } catch (error) {
            console.error('YouTube Error:', error.response?.data || error.message);
            await sendMessage(senderId, { text: '❌ Failed to fetch video. Try again!' }, pageAccessToken);
        }
    }
};

const formatViews = (views) => {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
};