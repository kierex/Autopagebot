const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

// API endpoints
const SEARCH_URL = "https://betadash-api-swordslush-production.up.railway.app/yt";
const DOWNLOAD_URL = "https://deku-api.giize.com/download/youtube";
const API_KEY = "ac735b0bf96a5acd049c5db6c68c8fdd";

module.exports = {
    name: ['ytvideo', 'ytm'],
    usage: 'ytvideo [video name or URL]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'search',
    cooldown: 15,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎬 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗩𝗶𝗱𝗲𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿

📝 𝗨𝘀𝗮𝗴𝗲: ytvideo [video name or URL]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• ytvideo Misteryoso Cup of Joe
• ytvideo https://youtu.be/Svm0vY91oN0
• ytvideo https://www.youtube.com/watch?v=GpQ63UI7mQc

🎵 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Search YouTube videos
• Download videos (360p, 720p, 1080p)
• Extract audio only (MP3)
• High quality downloads

💡 Tip: Use exact video name for better results!`
            }, pageAccessToken);
        }

        const query = args.join(' ');
        
        // Check if input is a YouTube URL
        const isUrl = query.includes('youtube.com') || query.includes('youtu.be');
        
        if (isUrl) {
            // Direct download from URL
            await downloadVideo(senderId, query, pageAccessToken);
        } else {
            // Search and download
            await searchAndDownload(senderId, query, pageAccessToken);
        }
    }
};

async function searchAndDownload(senderId, query, pageAccessToken) {
    try {
        // Send loading message
        await sendMessage(senderId, { 
            text: `🔍 Searching YouTube for "${query}"...` 
        }, pageAccessToken);

        // Search for video
        const searchRes = await axios.get(SEARCH_URL, { 
            params: { search: query },
            timeout: 15000
        });
        
        const results = searchRes.data?.results?.items;
        
        if (!results || results.length === 0) {
            return sendMessage(senderId, { 
                text: `❌ No videos found for "${query}".\n\nPlease try a different search term.` 
            }, pageAccessToken);
        }

        // Get the first result
        const video = results[0];
        const videoUrl = video.url;
        const title = video.title;
        const duration = video.duration;
        const thumbnail = video.thumbnail;

        // Send video info
        await sendMessage(senderId, {
            text: `🎬 𝗩𝗶𝗱𝗲𝗼 𝗙𝗼𝘂𝗻𝗱!\n\n📌 Title: ${title}\n⏱️ Duration: ${duration}\n\n⬇️ Downloading video...`
        }, pageAccessToken);

        // Download video
        await downloadVideo(senderId, videoUrl, pageAccessToken, title);

    } catch (error) {
        console.error('Search Error:', error.message);
        await sendMessage(senderId, { 
            text: `❌ Failed to search for "${query}".\n\nPlease try again later.` 
        }, pageAccessToken);
    }
}

async function downloadVideo(senderId, url, pageAccessToken, title = null) {
    const tempDir = path.join(__dirname, '../temp');
    const tempFile = path.join(tempDir, `video_${Date.now()}.mp4`);
    
    await fs.mkdir(tempDir, { recursive: true });

    try {
        // Get download info from API
        const downloadRes = await axios.get(DOWNLOAD_URL, {
            params: { 
                url: url,
                apikey: API_KEY
            },
            timeout: 30000
        });

        const data = downloadRes.data;
        
        if (!data || !data.status || !data.result || !data.result.medias) {
            throw new Error('Failed to get download URL');
        }

        // Find best quality video (1080p > 720p > 360p)
        const medias = data.result.medias;
        const videoQuality = medias.find(m => m.label === 'mp4 (1080p)') ||
                            medias.find(m => m.label === 'mp4 (720p)') ||
                            medias.find(m => m.label === 'mp4 (360p)') ||
                            medias.find(m => m.type === 'video');
        
        if (!videoQuality || !videoQuality.url) {
            throw new Error('No downloadable video found');
        }

        const videoTitle = title || data.result.title || 'YouTube Video';
        const downloadUrl = videoQuality.url;
        const quality = videoQuality.label || 'mp4';
        const duration = data.result.duration;

        // Send loading message
        await sendMessage(senderId, { 
            text: `📥 Downloading "${videoTitle}" (${quality})...\n⏱️ Duration: ${duration}s\n\nPlease wait...` 
        }, pageAccessToken);

        // Download video
        const videoResponse = await axios.get(downloadUrl, { 
            responseType: 'arraybuffer',
            timeout: 120000
        });
        
        await fs.writeFile(tempFile, Buffer.from(videoResponse.data));
        
        // Upload to Facebook
        const form = new FormData();
        form.append('message', JSON.stringify({
            attachment: { type: 'video', payload: { is_reusable: true } }
        }));
        form.append('filedata', createReadStream(tempFile));
        
        const uploadRes = await axios.post(
            `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
            form,
            { headers: form.getHeaders() }
        );
        
        // Send video
        await axios.post(
            `https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`,
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
        
        // Send success message
        const phTime = new Date().toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        await sendMessage(senderId, {
            text: `✅ Video downloaded successfully!\n\n🎬 Title: ${videoTitle}\n📦 Quality: ${quality}\n⏱️ Duration: ${duration}s\n📅 ${phTime}\n\n💡 Try: ytvideo [another video]`
        }, pageAccessToken);
        
        // Cleanup
        try { unlinkSync(tempFile); } catch(e) {}
        
    } catch (error) {
        console.error('Download Error:', error.message);
        
        // Cleanup on error
        try { unlinkSync(tempFile); } catch(e) {}
        
        await sendMessage(senderId, {
            text: `❌ Failed to download video.\n\n📝 Tips:\n• Check the video URL\n• Try a different video\n• Make sure the video is public\n\n💡 Example: ytvideo Misteryoso Cup of Joe`
        }, pageAccessToken);
    }
}