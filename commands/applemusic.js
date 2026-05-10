const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const BASE_URL = 'https://betadash-api-swordslush-production.up.railway.app/shazam';

module.exports = {
    name: ['applemusic'],
    usage: 'applemusic <song name>',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'music',
    cooldown: 0,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, { text: '𝖯𝗅𝖾𝖺𝗌𝖾 𝗉𝗋𝗈𝗏𝗂𝖽𝖾 𝗌𝗈𝗇𝗀 𝗍𝗂𝗍𝗅𝖾.' }, pageAccessToken);
        }

        try {
            const response = await axios.get(BASE_URL, {
                params: {
                    title: args.join(' '),
                    limit: 1
                }
            });

            const track = response.data?.results?.[0];

            if (!track) {
                return sendMessage(senderId, { text: '❌ Error: No song found.' }, pageAccessToken);
            }

            const { 
                title, 
                albumName, 
                thumbnail, 
                artistName, 
                genreNames, 
                durationInMillis, 
                releaseDate, 
                appleMusicUrl, 
                previewUrl 
            } = track;

            // Format duration from milliseconds to mm:ss
            const durationMinutes = Math.floor(durationInMillis / 60000);
            const durationSeconds = ((durationInMillis % 60000) / 1000).toFixed(0);
            const formattedDuration = `${durationMinutes}:${durationSeconds.padStart(2, '0')}`;

            // Format release date
            const formattedReleaseDate = new Date(releaseDate).toLocaleDateString();

            // Send the template with song info
            await sendMessage(senderId, {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements: [{
                            title: `🎵 ${title}`,
                            image_url: thumbnail,
                            subtitle: `Artist: ${artistName}\nAlbum: ${albumName}\nDuration: ${formattedDuration}\nGenre: ${genreNames.join(', ')}\nRelease: ${formattedReleaseDate}`,
                            buttons: [{
                                type: 'web_url',
                                url: appleMusicUrl,
                                title: 'Listen on Apple Music'
                            }]
                        }]
                    }
                }
            }, pageAccessToken);

            // Send the preview audio
            if (previewUrl) {
                await sendMessage(senderId, {
                    attachment: { type: 'audio', payload: { url: previewUrl } }
                }, pageAccessToken);
            } else {
                sendMessage(senderId, { text: '⚠️ No audio preview available.' }, pageAccessToken);
            }
        } catch (error) {
            console.error('Error fetching song:', error);
            sendMessage(senderId, { text: '❌ Error: Unexpected error occurred. Please try again later.' }, pageAccessToken);
        }
    }
};