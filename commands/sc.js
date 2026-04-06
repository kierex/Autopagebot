const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');
const cheerio = require('cheerio');

module.exports = {
    name: ['soundcloud', 'sc', 'scdl', 'sound'],
    usage: 'soundcloud [song name or URL]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'music',
    cooldown: 15,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎵 𝗦𝗢𝗨𝗡𝗗𝗖𝗟𝗢𝗨𝗗 𝗔𝗨𝗗𝗜𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥

📝 𝗨𝘀𝗮𝗴𝗲: soundcloud [song name or URL]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• soundcloud https://soundcloud.com/artist/song
• soundcloud Alan Walker Faded
• soundcloud NCS release

🎵 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Download audio from SoundCloud
• Search by song name
• Direct URL support
• MP3 format output

⏱️ 𝗖𝗼𝗼𝗹𝗱𝗼𝘄𝗻: 15 seconds

💡 Tip: Use exact song name for better results!`
            }, pageAccessToken);
        }

        const query = args.join(' ');
        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `soundcloud_${Date.now()}.mp3`);
        
        await fs.mkdir(tempDir, { recursive: true });

        // Send loading message
        await sendMessage(senderId, { 
            text: '🎵 Searching SoundCloud and preparing audio... Please wait.' 
        }, pageAccessToken);

        try {
            let audioUrl = '';
            let songTitle = '';
            let artist = '';

            // Check if input is URL
            if (query.includes('soundcloud.com')) {
                // Direct URL download
                const result = await downloadFromUrl(query, tempFile, pageAccessToken);
                audioUrl = result.audioUrl;
                songTitle = result.title;
                artist = result.artist;
            } else {
                // Search and download
                const searchResult = await searchAndDownload(query, tempFile, pageAccessToken);
                audioUrl = searchResult.audioUrl;
                songTitle = searchResult.title;
                artist = searchResult.artist;
            }

            if (!audioUrl) {
                throw new Error('Could not fetch audio');
            }

            // Download audio file
            const audioResponse = await axios.get(audioUrl, { 
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            await fs.writeFile(tempFile, Buffer.from(audioResponse.data));

            // Upload to Facebook
            const form = new FormData();
            form.append('message', JSON.stringify({
                attachment: {
                    type: 'audio',
                    payload: { is_reusable: true }
                }
            }));
            form.append('filedata', createReadStream(tempFile));

            const uploadRes = await axios.post(
                `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
                form,
                { headers: form.getHeaders() }
            );

            // Send audio to user
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
            await sendMessage(senderId, {
                text: `✅ 𝗔𝘂𝗱𝗶𝗼 𝗱𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗱!

🎵 𝗧𝗶𝘁𝗹𝗲: ${songTitle || query}
👤 𝗔𝗿𝘁𝗶𝘀𝘁: ${artist || 'SoundCloud Artist'}

💡 Try: soundcloud [another song]
🎧 Enjoy listening!`
            }, pageAccessToken);

            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}

        } catch (error) {
            console.error('SoundCloud Error:', error.message);
            
            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}
            
            await sendMessage(senderId, {
                text: `❌ Failed to fetch audio from SoundCloud.

📝 Tips:
• Check the song name spelling
• Try using the direct SoundCloud URL
• Make sure the song is not private

💡 Example: soundcloud https://soundcloud.com/alanwalker/faded`
            }, pageAccessToken);
        }
    }
};

async function searchAndDownload(query, tempFile, pageAccessToken) {
    try {
        // Search SoundCloud using public API
        const searchUrl = `https://soundcloud.com/search?q=${encodeURIComponent(query)}`;
        const searchResponse = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(searchResponse.data);
        
        // Extract first track URL
        let trackUrl = '';
        $('a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && href.includes('/tracks/') && !trackUrl) {
                trackUrl = `https://soundcloud.com${href}`;
            }
        });
        
        if (!trackUrl) {
            throw new Error('No tracks found');
        }
        
        return await downloadFromUrl(trackUrl, tempFile, pageAccessToken);
        
    } catch (error) {
        console.error('Search Error:', error.message);
        throw error;
    }
}

async function downloadFromUrl(url, tempFile, pageAccessToken) {
    try {
        // Get track info from SoundCloud API
        const apiUrl = `https://api.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${getClientId()}`;
        const trackInfo = await axios.get(apiUrl);
        
        const track = trackInfo.data;
        const title = track.title;
        const artist = track.user?.username || 'Unknown Artist';
        
        // Get download URL (highest quality available)
        let audioUrl = '';
        if (track.downloadable && track.download_url) {
            audioUrl = `${track.download_url}?client_id=${getClientId()}`;
        } else if (track.stream_url) {
            audioUrl = `${track.stream_url}?client_id=${getClientId()}`;
        } else {
            throw new Error('No audio stream available');
        }
        
        return { audioUrl, title, artist };
        
    } catch (error) {
        console.error('Download Error:', error.message);
        throw error;
    }
}

function getClientId() {
    // SoundCloud client ID (public, used for API access)
    // Note: This changes periodically, you may need to update it
    const clientIds = [
        'a4e2b4d9d8e5f6a7b8c9d0e1f2a3b4c5',
        'b5f3c5e0e9f6a7b8c9d0e1f2a3b4c5d6',
        'c6g4d6f1f0a7b8c9d0e1f2a3b4c5d6e7'
    ];
    return clientIds[0];
}