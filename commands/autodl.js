const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

// API endpoints
const FB_API = "https://yin-api.vercel.app/downloader/fbdl";
const TIKTOK_API = "https://markdevs-last-api-p2y6.onrender.com/api/tiktokdl";
const IG_API = "https://yin-api.vercel.app/downloader/ig-dl";

module.exports = {
    name: ['download', 'dl'],
    usage: 'download <link>',
    version: '2.0.0',
    author: 'AutoPageBot',
    category: 'downloader',
    cooldown: 2,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {

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

        // Detect platform
        let platform = '';
        let platformName = '';
        let apiUrl = '';
        let videoUrl = '';

        if (
            url.includes('facebook.com') ||
            url.includes('fb.watch') ||
            url.includes('fb.com')
        ) {

            platform = 'facebook';
            platformName = 'Facebook';
            apiUrl = `${FB_API}?url=${encodeURIComponent(url)}`;

        }

        else if (
            url.includes('tiktok.com') ||
            url.includes('vt.tiktok') ||
            url.includes('vm.tiktok')
        ) {

            platform = 'tiktok';
            platformName = 'TikTok';
            apiUrl = `${TIKTOK_API}?link=${encodeURIComponent(url)}`;

        }

        else if (
            url.includes('instagram.com') ||
            url.includes('instagr.am') ||
            url.includes('reel')
        ) {

            platform = 'instagram';
            platformName = 'Instagram';
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

            // Processing
            await sendMessage(senderId, {
                text: `⏳ Downloading ${platformName} video...`
            }, pageAccessToken);

            // Fetch API
            const response = await axios.get(apiUrl, {
                timeout: 30000
            });

            const data = response.data;

            if (!data) {
                return sendMessage(senderId, {
                    text: '❌ Failed to process link'
                }, pageAccessToken);
            }

            // Handle API responses
            if (platform === 'facebook') {

                if (!data.answer || !data.answer.url) {
                    throw new Error('Invalid Facebook API response');
                }

                videoUrl = data.answer.url;
            }

            else if (platform === 'tiktok') {

                if (!data.url) {
                    throw new Error('Invalid TikTok API response');
                }

                videoUrl = data.url;
            }

            else if (platform === 'instagram') {

                if (!data.answer || !data.answer.videoUrl) {
                    throw new Error('Invalid Instagram API response');
                }

                videoUrl = data.answer.videoUrl;
            }

            // No video found
            if (!videoUrl) {

                return sendMessage(senderId, {
                    text: '❌ No video found'
                }, pageAccessToken);
            }

            // Download + send
            await downloadAndSendVideo(
                senderId,
                videoUrl,
                platformName,
                pageAccessToken
            );

        } catch (error) {

            console.error('Download Error:', error.message);

            await sendMessage(senderId, {
                text: '❌ Failed to download video'
            }, pageAccessToken);
        }
    }
};

// DOWNLOAD + SEND VIDEO
async function downloadAndSendVideo(
    senderId,
    videoUrl,
    platform,
    pageAccessToken
) {

    const tempDir = path.join(__dirname, '../temp');

    const tempFile = path.join(
        tempDir,
        `video_${Date.now()}.mp4`
    );

    await fs.mkdir(tempDir, { recursive: true });

    try {

        // Download video
        const videoResponse = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
        });

        await fs.writeFile(
            tempFile,
            Buffer.from(videoResponse.data)
        );

        // Upload to Facebook
        const form = new FormData();

        form.append('message', JSON.stringify({
            attachment: {
                type: 'video',
                payload: {
                    is_reusable: true
                }
            }
        }));

        form.append(
            'filedata',
            createReadStream(tempFile)
        );

        const uploadRes = await axios.post(
            `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
            form,
            {
                headers: form.getHeaders()
            }
        );

        // Send video
        await axios.post(
            `https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`,
            {
                recipient: {
                    id: senderId
                },

                message: {
                    attachment: {
                        type: 'video',
                        payload: {
                            attachment_id: uploadRes.data.attachment_id
                        }
                    }
                }
            }
        );

        // Cleanup
        try {
            unlinkSync(tempFile);
        } catch (e) {}

    } catch (error) {

        console.error('Send Video Error:', error.message);

        try {
            unlinkSync(tempFile);
        } catch (e) {}

        throw error;
    }
}