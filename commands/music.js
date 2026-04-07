const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

// API endpoints
const SEARCH_API = "https://api.jonell-hutchin-api-ccprojects.kozow.com/api/ytsearch";
const DOWNLOAD_API = "https://api.jonell-hutchin-api-ccprojects.kozow.com/api/music";

module.exports = {
    name: ['music', 'song'],
    usage: 'music [song name]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'music',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎵 𝗠𝘂𝘀𝗶𝗰 𝗔𝘂𝗱𝗶𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿

📝 𝗨𝘀𝗮𝗴𝗲: music [song name]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• music Kumpas fingerstyle
• music Shape of You
• music Blinding Lights

🎵 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Search YouTube songs
• Download as MP3 audio
• High quality audio
• Fast response

💡 Tip: Use exact song name for better results!`
            }, pageAccessToken);
        }

        const query = args.join(' ');

        // Send loading message
        await sendMessage(senderId, { 
            text: `🔍 Searching for "${query}"...` 
        }, pageAccessToken);

        try {
            // Search for video
            const searchRes = await axios.get(SEARCH_API, { 
                params: { title: query },
                timeout: 15000
            });
            
            const results = searchRes.data?.results;
            
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
            const author = video.author;
            const thumbnail = video.thumbnail;

            // Send song info
            await sendMessage(senderId, {
                text: `🎵 𝗦𝗼𝗻𝗴 𝗙𝗼𝘂𝗻𝗱!\n\n📌 Title: ${title}\n👤 Artist: ${author}\n⏱️ Duration: ${duration}\n\n⬇️ Converting to audio...`
            }, pageAccessToken);

            await downloadAudio(senderId, videoUrl, pageAccessToken, title, author);

        } catch (error) {
            console.error('Search Error:', error.message);
            await sendMessage(senderId, { 
                text: `❌ Failed to search for "${query}".\n\nPlease try again later.` 
            }, pageAccessToken);
        }
    }
};

async function downloadAudio(senderId, url, pageAccessToken, title, author) {
    const tempDir = path.join(__dirname, '../temp');
    const tempFile = path.join(tempDir, `music_${Date.now()}.mp3`);
    
    await fs.mkdir(tempDir, { recursive: true });

    try {
        // Get download URL from API
        const downloadRes = await axios.get(DOWNLOAD_API, {
            params: { url: url },
            timeout: 30000
        });

        const data = downloadRes.data;
        
        if (!data || !data.data || !data.data.link) {
            throw new Error('Failed to get download URL');
        }

        const audioUrl = data.data.link;
        const duration = data.data.duration || 'Unknown';
        const fileSize = data.data.filesize ? (data.data.filesize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown';

        // Download audio
        const audioResponse = await axios.get(audioUrl, { 
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
            text: `✅ Audio ready!\n\n🎵 ${title}\n👤 ${author}\n⏱️ Duration: ${duration}\n📦 Size: ${fileSize}\n📅 ${phTime}\n\n🎧 Enjoy listening!`
        }, pageAccessToken);
        
        // Cleanup
        try { unlinkSync(tempFile); } catch(e) {}
        
    } catch (error) {
        console.error('Download Error:', error.message);
        
        // Cleanup on error
        try { unlinkSync(tempFile); } catch(e) {}
        
        await sendMessage(senderId, {
            text: `❌ Failed to download audio.\n\n📝 Tips:\n• Check the song name\n• Try a different song\n• Make sure the video exists\n\n💡 Example: music Kumpas fingerstyle`
        }, pageAccessToken);
    }
}