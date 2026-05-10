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
            return sendMessage(senderId, { text: '❌ 𝗣𝗿𝗼𝘃𝗶𝗱𝗲 𝗾𝘂𝗲𝗿𝘆.\nUsage: youtube <video name>' }, pageAccessToken);
        }

        await searchYouTubeVideo(senderId, args.join(' '), pageAccessToken);
    }
};

const searchYouTubeVideo = async (senderId, query, pageAccessToken) => {
    try {
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
            return sendMessage(senderId, { text: '⚠️ No video found.' }, pageAccessToken);
        }

        const { title, url, thumbnail, author, duration, views, ago } = video;

        const downloadRes = await axios.get(DOWNLOAD_URL, {
            params: {
                url: url,
                stream: false,
                api_key: API_KEY
            }
        });

        if (!downloadRes.data?.success || !downloadRes.data?.url) {
            return sendMessage(senderId, { text: '⚠️ No valid video format found.' }, pageAccessToken);
        }

        const videoUrl = downloadRes.data.url;

        // Send template with video info
        await sendMessage(senderId, {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: [{
                        title: `🎬 ${title}`,
                        image_url: thumbnail,
                        subtitle: `👤 ${author.name}\n⏱️ ${duration.timestamp}\n👁️ ${formatViews(views)}\n📅 ${ago}`,
                        default_action: {
                            type: 'web_url',
                            url: url,
                            webview_height_ratio: 'tall'
                        }
                    }]
                }
            }
        }, pageAccessToken);

        // Send the actual video
        await sendMessage(senderId, {
            attachment: {
                type: 'video',
                payload: {
                    url: videoUrl,
                    is_reusable: true
                }
            }
        }, pageAccessToken);

    } catch (error) {
        console.error('Error fetching YouTube video:', error);
        sendMessage(senderId, { text: '❌ Error: Unexpected error occurred.' }, pageAccessToken);
    }
};

const formatViews = (views) => {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
};