const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

async function getAudioUrl(permalinkUrl) {
    try {
        const res = await axios.get(
            `https://betadash-search-download.vercel.app/scdl?url=${encodeURIComponent(permalinkUrl)}`,
            { timeout: 10000 }
        );
        return res.data.results?.audioUrl || null;
    } catch {
        return null;
    }
}

module.exports = {
    name: ['soundcloud', 'sc'],
    usage: 'soundcloud [song name]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'music',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        const query = args.join(' ');
        
        if (!query) {
            return sendMessage(senderId, {
                text: `🎵 𝗦𝗼𝘂𝗻𝗱𝗖𝗹𝗼𝘂𝗱 𝗠𝘂𝘀𝗶𝗰 𝗦𝗲𝗮𝗿𝗰𝗵

📝 𝗨𝘀𝗮𝗴𝗲: soundcloud [song name]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• soundcloud Alan Walker Faded
• sc Marshmello Alone
• soundcloud NCS - Cartoon

🎵 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Search SoundCloud songs
• Get audio preview
• Download option available
• Fast response

💡 Tip: Use exact song name for better results!`
            }, pageAccessToken);
        }

        await sendMessage(senderId, { 
            text: `🔍 Searching SoundCloud for "${query}", please wait...` 
        }, pageAccessToken);

        try {
            const searchRes = await axios.get(
                `https://betadash-search-download.vercel.app/sc?search=${encodeURIComponent(query)}`,
                { timeout: 15000 }
            );

            const results = searchRes.data.results;
            if (!results || results.length === 0) {
                return sendMessage(senderId, { text: '❌ No results found.' }, pageAccessToken);
            }

            const top10 = results.slice(0, 10);

            // Get audio URLs for all results
            const audioUrls = await Promise.all(
                top10.map(item => getAudioUrl(item.data.permalink_url))
            );

            // Build template elements
            const elements = top10.map((item, i) => {
                const track = item.data;
                const duration = formatDuration(track.duration);
                const likes = formatCount(track.likes_count);
                const plays = formatCount(track.playback_count);
                const audioUrl = audioUrls[i];

                const subtitle = `Duration: ${duration}\nLikes: ${likes}\n${plays} Plays`;

                const buttons = [
                    {
                        type: 'web_url',
                        url: track.permalink_url,
                        title: '🎧 Listen'
                    }
                ];

                if (audioUrl) {
                    buttons.push({
                        type: 'web_url',
                        url: audioUrl,
                        title: '⬇️ Download Audio'
                    });
                }

                return {
                    title: track.title,
                    image_url: track.artwork_url || 'https://i1.sndcdn.com/artworks-default.jpg',
                    subtitle: subtitle,
                    default_action: {
                        type: 'web_url',
                        url: track.permalink_url,
                        webview_height_ratio: 'compact'
                    },
                    buttons: buttons
                };
            });

            // Send search results template
            await sendMessage(senderId, {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements: elements.slice(0, 5) // Limit to 5 results
                    }
                }
            }, pageAccessToken);

            // Send audio preview of first result
            const firstAudioUrl = audioUrls[0];
            const firstTrack = top10[0].data;

            if (!firstAudioUrl) {
                return sendMessage(senderId, { 
                    text: `❌ Could not get audio for "${firstTrack.title}"` 
                }, pageAccessToken);
            }

            // Check file size
            try {
                const headRes = await axios.head(firstAudioUrl, { timeout: 8000 });
                const fileSize = parseInt(headRes.headers['content-length'], 10);

                if (!isNaN(fileSize) && fileSize > 25 * 1024 * 1024) {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'template',
                            payload: {
                                template_type: 'button',
                                text: `🎵 ${firstTrack.title}\n\n📦 File too large (${(fileSize / 1024 / 1024).toFixed(2)}MB) to send directly.`,
                                buttons: [{
                                    type: 'web_url',
                                    url: firstAudioUrl,
                                    title: '⬇️ Download Audio'
                                }]
                            }
                        }
                    }, pageAccessToken);
                } else {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'audio',
                            payload: { url: firstAudioUrl, is_reusable: true }
                        }
                    }, pageAccessToken);
                }
            } catch {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'audio',
                        payload: { url: firstAudioUrl, is_reusable: true }
                    }
                }, pageAccessToken);
            }

        } catch (error) {
            console.error('SoundCloud Error:', error.message);
            await sendMessage(senderId, { 
                text: `❌ Error: ${error.message}\n\nPlease try again later.` 
            }, pageAccessToken);
        }
    }
};