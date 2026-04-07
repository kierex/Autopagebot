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
    name: ['music'],
    usage: 'music [song name]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'music',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎵 𝗠𝘂𝘀𝗶𝗰 𝗔𝘂𝗱𝗶𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿

📝 𝗨𝘀𝗮𝗴𝗲: music [song name or URL]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• music Misteryoso Cup of Joe

🎵 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Search YouTube songs
• Download as MP3 audio
• High quality audio
• Fast response

💡 Tip: Use exact song name for better results!`
            }, pageAccessToken);
        }

        const query = args.join(' ');
        
        // Check if input is a YouTube URL
        const isUrl = query.includes('youtube.com') || query.includes('youtu.be');
        
        if (isUrl) {
            await downloadAudio(senderId, query, pageAccessToken);
        } else {
            await searchAndDownloadAudio(senderId, query, pageAccessToken);
        }
    }
};

async function searchAndDownloadAudio(senderId, query, pageAccessToken) {
    try {
        // Send loading message
        await sendMessage(senderId, { 
            text: `🔍 Searching "${query}"...` 
        }, pageAccessToken);

        // Search for video
        const searchRes = await axios.get(SEARCH_URL, { 
            params: { search: query },
            timeout: 15000
        });
        
        const results = searchRes.data?.results?.items;
        
        if (!results || results.length === 0) {
            return sendMessage(senderId, { 
                text: `❌ No results found for "${query}".\n\nPlease try a different song name.` 
            }, pageAccessToken);
        }

        // Get the first result
        const video = results[0];
        const videoUrl = video.url;
        const title = video.title;
        const duration = video.duration;

        // Send song info
        await sendMessage(senderId, {
            text: `🎵 𝗦𝗼𝗻𝗴 𝗙𝗼𝘂𝗻𝗱!\n\n📌 Title: ${title}\n⏱️ Duration: ${duration}\n\n⬇️ Converting to audio...`
        }, pageAccessToken);

        await downloadAudio(senderId, videoUrl, pageAccessToken, title);

    } catch (error) {
        console.error('Search Error:', error.message);
        await sendMessage(senderId, { 
            text: `❌ Failed to search for "${query}".\n\nPlease try again later.` 
        }, pageAccessToken);
    }
}

async function downloadAudio(senderId, url, pageAccessToken, title = null) {
    const tempDir = path.join(__dirname, '../temp');
    const tempFile = path.join(tempDir, `audio_${Date.now()}.mp3`);
    
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

        // Find best quality audio (opus > m4a > webm)
        const medias = data.result.medias;
        const audioQuality = medias.find(m => m.type === 'audio' && m.label.includes('opus')) ||
                            medias.find(m => m.type === 'audio' && m.label.includes('m4a')) ||
                            medias.find(m => m.type === 'audio');
        
        if (!audioQuality || !audioQuality.url) {
            throw new Error('No downloadable audio found');
        }

        const songTitle = title || data.result.title || 'YouTube Audio';
        const quality = audioQuality.label || 'audio';
        const duration = data.result.duration;

        // Send loading message
        await sendMessage(senderId, { 
            text: `📥 Converting "${songTitle}" to MP3...\n⏱️ Duration: ${duration}s\n\nPlease wait...` 
        }, pageAccessToken);

        // Download audio
        const audioResponse = await axios.get(audioQuality.url, { 
            responseType: 'arraybuffer',
            timeout: 120000
        });
        
        await fs.writeFile(tempFile, Buffer.from(audioResponse.data));
        
        // Upload to Facebook
        const form = new FormData();
        form.append('message', JSON.stringify({
            attachment: { type: 'audio', payload: { is_reusable: true } }
        }));
        form.append('filedata', createReadStream(tempFile));
        
        const uploadRes = await axios.post(
            `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
            form,
            { headers: form.getHeaders() }
        );
        
        // Send audio
        await axios.post(
            `https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`,
            {
                recipient: { id: senderId },
                message: {
                    attachment: {
                        type: 'audio',
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
            text: `✅ Audio ready!\n\n🎵 Title: ${songTitle}\n📦 Quality: ${quality}\n⏱️ Duration: ${duration}s\n📅 ${phTime}\n\n🎧 Enjoy listening!`
        }, pageAccessToken);
        
        // Cleanup
        try { unlinkSync(tempFile); } catch(e) {}
        
    } catch (error) {
        console.error('Audio Error:', error.message);
        
        // Cleanup on error
        try { unlinkSync(tempFile); } catch(e) {}
        
        await sendMessage(senderId, {
            text: `❌ Failed to convert audio.\n\n📝 Tips:\n• Check the song name\n• Try a different song\n• Make sure the video exists\n\n💡 Example: music Misteryoso Cup of Joe`
        }, pageAccessToken);
    }
}