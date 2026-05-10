const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendMessage } = require('../handles/sendMessage');

const API_URL = 'https://haji-mix-api.gleeze.com/api/youtube';
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
            await sendMessage(senderId, { text: '🔍 Please provide a search query.\nUsage: youtube <song/video name>' }, pageAccessToken);
            return;
        }

        const query = args.join(' ');
        
        try {
            const response = await axios.get(API_URL, {
                params: {
                    search: query,
                    stream: false,
                    limit: 1,
                    api_key: API_KEY
                }
            });

            const video = response.data[0];

            if (!video) {
                await sendMessage(senderId, { text: `❌ No results found for "${query}".` }, pageAccessToken);
                return;
            }

            // Download video from stream URL
            const videoStream = await axios({
                method: 'get',
                url: video.play,
                responseType: 'stream'
            });

            // Save video temporarily
            const videoPath = path.join(__dirname, `../temp/${video.videoId}.mp4`);
            const writer = fs.createWriteStream(videoPath);
            videoStream.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Upload to Facebook
            const formData = new FormData();
            formData.append('message', `🎬 ${video.title}\n👤 ${video.author.name}\n⏱️ ${video.duration.timestamp}\n🔗 ${video.url}`);
            formData.append('filedata', fs.createReadStream(videoPath));

            const uploadRes = await axios.post(
                `https://graph.facebook.com/v18.0/me/message_attachments?access_token=${pageAccessToken}`,
                formData,
                { headers: { ...formData.getHeaders() } }
            );

            // Send video with attachment_id
            await axios.post(
                `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
                {
                    recipient: { id: senderId },
                    message: {
                        attachment: {
                            type: 'video',
                            payload: { attachment_id: uploadRes.data.attachment_id }
                        }
                    }
                }
            );

            // Clean up temp file
            fs.unlinkSync(videoPath);

        } catch (error) {
            console.error('YouTube Error:', error.response?.data || error.message);
            
            // Fallback: send as text message if video fails
            try {
                const textResponse = await axios.get(API_URL, {
                    params: {
                        search: query,
                        stream: false,
                        limit: 1,
                        api_key: API_KEY
                    }
                });
                
                const fallbackVideo = textResponse.data[0];
                if (fallbackVideo) {
                    await sendMessage(senderId, { 
                        text: `📺 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗥𝗲𝘀𝘂𝗹𝘁\n\n🎬 ${fallbackVideo.title}\n👤 ${fallbackVideo.author.name}\n⏱️ ${fallbackVideo.duration.timestamp}\n👁️ ${formatViews(fallbackVideo.views)}\n🔗 ${fallbackVideo.url}` 
                    }, pageAccessToken);
                } else {
                    await sendMessage(senderId, { text: '❌ Failed to fetch video. Try again!' }, pageAccessToken);
                }
            } catch (fallbackError) {
                await sendMessage(senderId, { text: '❌ Failed to fetch video. Try again!' }, pageAccessToken);
            }
        }
    }
};

function formatViews(views) {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
}