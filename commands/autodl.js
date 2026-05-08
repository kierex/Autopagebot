const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

// APIs
const FB_API = "https://yin-api.vercel.app/downloader/fbdl";
const TIKTOK_API = "https://markdevs-last-api-p2y6.onrender.com/api/tiktokdl";
const IG_API = "https://yin-api.vercel.app/downloader/ig-dl";

module.exports = {
    name: ['download', 'dl'],
    usage: 'download <link>',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'downloader',
    cooldown: 2,

    async execute(senderId, args, pageAccessToken) {

        // Check link
        if (!args[0]) {

            return sendMessage(senderId, {
                text:
`❌ Please provide a link

Example:
download https://facebook.com/reel/xxxxx`
            }, pageAccessToken);
        }

        const url = args[0];

        let platform = '';
        let apiUrl = '';

        // FACEBOOK
        if (
            url.includes('facebook.com') ||
            url.includes('fb.watch') ||
            url.includes('fb.com')
        ) {

            platform = 'Facebook';
            apiUrl = `${FB_API}?url=${encodeURIComponent(url)}`;

        }

        // TIKTOK
        else if (
            url.includes('tiktok.com') ||
            url.includes('vt.tiktok') ||
            url.includes('vm.tiktok')
        ) {

            platform = 'TikTok';
            apiUrl = `${TIKTOK_API}?link=${encodeURIComponent(url)}`;

        }

        // INSTAGRAM
        else if (
            url.includes('instagram.com') ||
            url.includes('instagr.am')
        ) {

            platform = 'Instagram';
            apiUrl = `${IG_API}?url=${encodeURIComponent(url)}`;

        }

        else {

            return sendMessage(senderId, {
                text:
`❌ Unsupported platform

Supported:
• Facebook
• TikTok
• Instagram`
            }, pageAccessToken);
        }

        try {

            // Processing message
            await sendMessage(senderId, {
                text: `⏳ Downloading ${platform} video...`
            }, pageAccessToken);

            // Request API
            const response = await axios.get(apiUrl, {
                timeout: 30000
            });

            const data = response.data;

            let downloadUrl = null;

            // FACEBOOK
            if (platform === 'Facebook') {
                downloadUrl = data?.answer?.url;
            }

            // TIKTOK
            else if (platform === 'TikTok') {
                downloadUrl = data?.url;
            }

            // INSTAGRAM
            else if (platform === 'Instagram') {
                downloadUrl = data?.answer?.videoUrl;
            }

            // No video
            if (!downloadUrl) {

                return sendMessage(senderId, {
                    text: `❌ Failed to fetch ${platform} video`
                }, pageAccessToken);
            }

            // Send download link
            await sendMessage(senderId, {
                text:
`✅ ${platform} Download Ready

🔗 ${downloadUrl}`
            }, pageAccessToken);

        } catch (error) {

            console.error('Download Error:', error.message);

            await sendMessage(senderId, {
                text: '❌ Failed to process link'
            }, pageAccessToken);
        }
    }
};