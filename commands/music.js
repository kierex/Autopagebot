const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

// Kohi Download API
const DOWNLOAD_API = "https://api-library-kohi.onrender.com/api/alldl";

module.exports = {
    name: ['spotify', 'sp', 'sptfy', 'spotifydl', 'spdl'],
    usage: 'spotify [song name or Spotify URL]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'music',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎵 𝗦𝗽𝗼𝘁𝗶𝗳𝘆 𝗠𝘂𝘀𝗶𝗰 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿

📝 𝗨𝘀𝗮𝗴𝗲: spotify [song name or Spotify URL]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• spotify Wake Me Up When September Ends
• spotify https://open.spotify.com/track/1P2Yy7790QFzV5tbOd4cBN

🎵 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Search Spotify songs
• Download as audio
• High quality MP3

💡 Tip: Use exact song name for better results!`
            }, pageAccessToken);
        }

        const query = args.join(' ');
        
        // Check if input is a Spotify URL
        const isUrl = query.includes('spotify.com/track/') || query.includes('open.spotify.com');
        
        if (isUrl) {
            await downloadFromUrl(senderId, query, pageAccessToken);
        } else {
            await searchAndDownload(senderId, query, pageAccessToken);
        }
    }
};

async function searchAndDownload(senderId, query, pageAccessToken) {
    try {
        // Send loading message
        await sendMessage(senderId, { 
            text: `🔍 Searching Spotify for "${query}"...` 
        }, pageAccessToken);

        // Scrape Spotify search results
        const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}/tracks`;
        
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://open.spotify.com/',
                'DNT': '1'
            },
            timeout: 15000
        });

        const html = response.data;
        const $ = cheerio.load(html);
        
        // Extract track URLs from the page
        const trackUrls = [];
        
        // Find all links that look like Spotify track URLs
        $('a[href^="/track/"]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && href.startsWith('/track/')) {
                const trackUrl = `https://open.spotify.com${href}`;
                if (!trackUrls.includes(trackUrl)) {
                    trackUrls.push(trackUrl);
                }
            }
        });

        // Also look for track links in data attributes
        $('[data-testid="track-link"]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && href.includes('/track/')) {
                const trackUrl = href.startsWith('http') ? href : `https://open.spotify.com${href}`;
                if (!trackUrls.includes(trackUrl)) {
                    trackUrls.push(trackUrl);
                }
            }
        });

        if (trackUrls.length === 0) {
            return sendMessage(senderId, {
                text: `❌ No results found for "${query}".\n\nPlease try a different song name or use a Spotify URL.`
            }, pageAccessToken);
        }

        // Get the first track URL
        const firstTrackUrl = trackUrls[0];
        
        // Get track title for display
        let trackTitle = query;
        $('a[href^="/track/"]').each((i, elem) => {
            if (i === 0) {
                const titleElem = $(elem).find('div[dir="auto"]');
                if (titleElem.length) {
                    trackTitle = titleElem.first().text().trim() || query;
                }
            }
        });

        await sendMessage(senderId, {
            text: `🎵 Found: ${trackTitle}\n\n⬇️ Downloading audio...`
        }, pageAccessToken);

        await downloadFromUrl(senderId, firstTrackUrl, pageAccessToken, trackTitle);

    } catch (error) {
        console.error('Search Error:', error.message);
        
        // Fallback: Use direct search with known track
        await sendMessage(senderId, {
            text: `❌ Failed to search for "${query}".\n\nPlease try:\n• Use a Spotify URL directly\n• Check the song name spelling\n• Try: spotify https://open.spotify.com/track/...`
        }, pageAccessToken);
    }
}

async function downloadFromUrl(senderId, url, pageAccessToken, title = null) {
    const tempDir = path.join(__dirname, '../temp');
    const tempFile = path.join(tempDir, `spotify_${Date.now()}.mp3`);
    
    await fs.mkdir(tempDir, { recursive: true });

    try {
        // Send loading message
        await sendMessage(senderId, { 
            text: `📥 Fetching audio from Spotify...` 
        }, pageAccessToken);

        // Get download URL from Kohi API
        const downloadRes = await axios.get(DOWNLOAD_API, {
            params: { url: url },
            timeout: 30000
        });

        const data = downloadRes.data;
        
        if (!data || !data.status || !data.data || !data.data.videoUrl) {
            throw new Error('Failed to get download URL');
        }

        const audioUrl = data.data.videoUrl;
        const songTitle = title || data.data.title || 'Spotify Track';
        const artist = data.data.artist || 'Unknown Artist';
        const duration = data.data.duration || 'Unknown';

        // Send song info
        await sendMessage(senderId, {
            text: `🎵 Title: ${songTitle}\n👤 Artist: ${artist}\n⏱️ Duration: ${duration}s\n\n⬇️ Downloading audio...`
        }, pageAccessToken);

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
            text: `✅ Audio ready!\n\n🎵 ${songTitle}\n👤 ${artist}\n⏱️ ${duration}s\n📅 ${phTime}\n\n🎧 Enjoy!`
        }, pageAccessToken);
        
        // Cleanup
        try { unlinkSync(tempFile); } catch(e) {}
        
    } catch (error) {
        console.error('Download Error:', error.message);
        
        // Cleanup on error
        try { unlinkSync(tempFile); } catch(e) {}
        
        await sendMessage(senderId, {
            text: `❌ Failed to download audio.\n\n📝 Tips:\n• Check the Spotify URL\n• Try a different song\n• Make sure the track is available\n\n💡 Example: spotify https://open.spotify.com/track/...`
        }, pageAccessToken);
    }
}