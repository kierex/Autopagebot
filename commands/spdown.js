const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

module.exports = {
    name: ['spdownload', 'spotifydl', 'spdl'],
    description: 'Download tracks from Spotify using direct links',
    usage: 'spdownload <spotify_track_url>',
    version: '1.0.0',
    author: 'System',
    category: 'downloader',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Check if URL is provided
        if (!args || args.length === 0) {
            await sendMessage(senderId, { 
                text: `🎵 Spotify Downloader\n\n` +
                      `📌 Usage:\n` +
                      `spdownload <spotify_track_url>\n\n` +
                      `📝 Example:\n` +
                      `spdownload https://open.spotify.com/track/7vkINABNJgMl0K7xRUrIhp\n\n` +
                      `⚠️ Note: Only works for Spotify track links.`
            }, pageAccessToken);
            return;
        }

        const spotifyUrl = args[0];
        
        // Validate Spotify URL
        if (!spotifyUrl.includes('spotify.com/track/')) {
            await sendMessage(senderId, { 
                text: `❌ Invalid Spotify URL\n\n` +
                      `Please provide a valid Spotify track link.\n` +
                      `Example: https://open.spotify.com/track/7vkINABNJgMl0K7xRUrIhp`
            }, pageAccessToken);
            return;
        }

        // Send processing message
        await sendMessage(senderId, { 
            text: `🎵 Processing Spotify Track...\n\n` +
                  `🔄 Fetching track information and download link...\n` +
                  `⏳ Please wait a moment.`
        }, pageAccessToken);

        try {
            // Extract track ID from URL
            const trackId = extractTrackId(spotifyUrl);
            
            if (!trackId) {
                await sendMessage(senderId, { 
                    text: `❌ Failed to extract track ID\n\n` +
                          `Please make sure you're using a valid Spotify track link.`
                }, pageAccessToken);
                return;
            }

            // Call the download API
            const apiUrl = `https://api.dlapi.app/spotify/track?id=${trackId}`;
            const response = await axios.get(apiUrl);
            
            if (!response.data || !response.data.success) {
                throw new Error('API returned unsuccessful response');
            }

            const trackData = response.data.data;
            
            if (!trackData.download || !trackData.download.url) {
                throw new Error('Download URL not found in response');
            }

            const downloadUrl = trackData.download.url;
            const trackName = trackData.track.name;
            const artists = trackData.track.artists;
            const duration = trackData.track.duration;
            const albumImage = trackData.track.albumImage;
            const expires = trackData.download.expires ? new Date(trackData.download.expires).toLocaleString() : 'Unknown';

            // Format the response message without asterisks
            const responseMessage = `🎵 ${trackName}\n` +
                                   `👤 Artist: ${artists}\n` +
                                   `⏱️ Duration: ${duration}\n` +
                                   `📅 Link Expires: ${expires}\n\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n\n` +
                                   `📥 CLICK TO DOWNLOAD YOUR FILE DIRECTLY\n\n` +
                                   `${downloadUrl}\n\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n\n` +
                                   `💡 Note: The link is temporary. Please download it before it expires!\n` +
                                   `🔗 Spotify Link: ${trackData.track.spotifyUrl}`;

            // Send the download link
            await sendMessage(senderId, { text: responseMessage }, pageAccessToken);

            // Optionally send album art as attachment
            if (albumImage) {
                try {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'image',
                            payload: {
                                url: albumImage,
                                is_reusable: true
                            }
                        }
                    }, pageAccessToken);
                } catch (imageError) {
                    console.error('Failed to send album art:', imageError);
                    // Continue even if image fails
                }
            }

            console.log(`✅ Spotify download sent for: ${trackName} by ${artists}`);

        } catch (error) {
            console.error('Spotify Download Error:', error);
            
            let errorMessage = `❌ Download Failed\n\n`;
            
            if (error.response) {
                if (error.response.status === 404) {
                    errorMessage += `Track not found. Please check the Spotify URL and try again.\n\n` +
                                   `💡 Tips:\n` +
                                   `• Make sure the track is publicly available\n` +
                                   `• Check if the track ID is correct\n` +
                                   `• Try a different Spotify track`;
                } else if (error.response.status === 429) {
                    errorMessage += `Rate limit exceeded. Please wait a moment and try again.`;
                } else {
                    errorMessage += `Server error: ${error.response.status}\n\nPlease try again later.`;
                }
            } else if (error.request) {
                errorMessage += `Network error. Please check your connection and try again.`;
            } else {
                errorMessage += `${error.message}\n\nPlease verify the Spotify URL and try again.`;
            }
            
            await sendMessage(senderId, { text: errorMessage }, pageAccessToken);
        }
    }
};

// Helper function to extract track ID from Spotify URL
function extractTrackId(url) {
    // Match Spotify track ID patterns
    const patterns = [
        /spotify\.com\/track\/([a-zA-Z0-9]+)/,
        /spotify:track:([a-zA-Z0-9]+)/,
        /track\/([a-zA-Z0-9]+)(?:\?|$)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}