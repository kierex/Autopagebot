const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const SEARCH_URL = 'https://api.jonell-hutchin-api-ccprojects.kozow.com/api/ytsearch';
const DOWNLOAD_URL = 'https://api.jonell-hutchin-api-ccprojects.kozow.com/api/music';

module.exports = {
    name: ['ytmusic', 'ytm', 'musicdl', 'ytaudio'],
    usage: 'ytmusic [song name]',
    version: '1.0.0',
    author: 'Ry',
    category: 'music',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, { 
                text: `🎵 𝗬𝗧 𝗠𝘂𝘀𝗶𝗰 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿

📝 𝗨𝘀𝗮𝗴𝗲: ytmusic [song name]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• ytmusic Kumpas fingerstyle
• ytmusic Shape of You
• ytmusic Blinding Lights

🎵 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Search YouTube songs
• Download as MP3 audio
• High quality audio

💡 Tip: Use exact song name for better results!` 
            }, pageAccessToken);
        }

        await searchYouTubeMusic(senderId, args.join(' '), pageAccessToken);
    }
};

const searchYouTubeMusic = async (senderId, songName, pageAccessToken) => {
    try {
        // Search for the song
        const searchRes = await axios.get(SEARCH_URL, {
            params: {
                title: songName
            },
            timeout: 15000
        });

        const results = searchRes.data?.results;
        if (!results || results.length === 0) {
            return sendMessage(senderId, { text: '❌ No song found. Please try a different name.' }, pageAccessToken);
        }

        // Get the first result
        const item = results[0];
        const { title, url, thumbnail, duration, author, views } = item;

        // Send loading message
        await sendMessage(senderId, { 
            text: `🎵 Found: ${title}\n\n⬇️ Converting to audio...` 
        }, pageAccessToken);

        // Download the audio
        const downloadRes = await axios.get(DOWNLOAD_URL, {
            params: {
                url: url
            },
            timeout: 30000
        });

        const downloadData = downloadRes.data?.data;
        if (!downloadData || downloadData.status !== 'ok') {
            return sendMessage(senderId, { text: '❌ Failed to get download link.' }, pageAccessToken);
        }

        const { link: download_url, filesize, duration: audioDuration } = downloadData;
        
        // Format filesize
        const formattedSize = filesize ? `${(filesize / 1024 / 1024).toFixed(2)} MB` : 'Unknown';
        
        // Send template message
        await sendMessage(senderId, {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: [{
                        title: `🎵 ${title.substring(0, 80)}`,
                        image_url: thumbnail,
                        subtitle: `🎤 ${author} | ⏱️ ${duration || formatDuration(audioDuration)} | 👁️ ${formatViews(views)} | 💾 ${formattedSize}`,
                        buttons: [
                            {
                                type: 'web_url',
                                url: url,
                                title: '🎬 Watch on YouTube'
                            },
                            {
                                type: 'web_url',
                                url: download_url,
                                title: '⬇️ Download MP3'
                            }
                        ]
                    }]
                }
            }
        }, pageAccessToken);

        // Send audio preview
        await sendMessage(senderId, {
            attachment: {
                type: 'audio',
                payload: {
                    url: download_url,
                    is_reusable: true
                }
            }
        }, pageAccessToken);

        // Send success message
        const phTime = new Date().toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        await sendMessage(senderId, {
            text: `✅ Audio ready!\n\n🎵 ${title}\n🎤 ${author}\n📦 ${formattedSize}\n📅 ${phTime}\n\n🎧 Enjoy!`
        }, pageAccessToken);

    } catch (error) {
        console.error('Error fetching YouTube music:', error.message);
        sendMessage(senderId, { text: '❌ Unexpected error occurred. Please try again later.' }, pageAccessToken);
    }
};

// Helper function to format view count
function formatViews(views) {
    if (!views) return 'Unknown';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
}

// Helper function to format duration from seconds
function formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}