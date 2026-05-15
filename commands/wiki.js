const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['wiki', 'wikipedia'],
    description: 'Search Wikipedia for articles and get summaries',
    usage: 'wiki <search term>',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'search',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        if (!args || args.length === 0) {
            await sendMessage(senderId, {
                text: `📚 Wikipedia Search

━━━━━━━━━━━━━━━━━━━━

Usage:
wiki <search term>

Examples:
wiki agriculture
wiki Albert Einstein
wiki Philippines

Tip: Search for any topic to get a summary from Wikipedia.`
            }, pageAccessToken);
            return;
        }

        const searchQuery = args.join(' ');

        try {
            await sendMessage(senderId, { text: `🔍 Searching Wikipedia for "${searchQuery}"...` }, pageAccessToken);

            const response = await axios.get(`https://jonell.ccprojects.gleeze.com/api/wiki`, {
                params: { q: searchQuery },
                timeout: 10000
            });

            const data = response.data;

            if (!data || !data.title) {
                await sendMessage(senderId, { text: `❌ No results found for "${searchQuery}". Please try a different search term.` }, pageAccessToken);
                return;
            }

            // Clean up the title (remove HTML tags if any)
            const title = data.title || searchQuery;
            
            // Get description (use description field or fallback to extract preview)
            let description = data.description || '';
            if (!description && data.extract) {
                description = data.extract.substring(0, 200);
            }
            
            // Get the extract/summary
            let extract = data.extract || '';
            if (extract.length > 800) {
                extract = extract.substring(0, 800) + '...';
            }
            
            // Get thumbnail URL if available
            let thumbnailUrl = '';
            let thumbnailSent = false;
            if (data.thumbnail && data.thumbnail.source) {
                thumbnailUrl = data.thumbnail.source;
            } else if (data.originalimage && data.originalimage.source) {
                thumbnailUrl = data.originalimage.source;
            }

            // Build the message
            let message = `📖 ${title}\n\n`;
            
            if (description) {
                message += `📝 ${description}\n\n`;
            }
            
            message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            message += `${extract}\n\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            // Add read more link
            if (data.content_urls && data.content_urls.mobile && data.content_urls.mobile.page) {
                message += `🔗 Read more: ${data.content_urls.mobile.page}`;
            } else if (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) {
                message += `🔗 Read more: ${data.content_urls.desktop.page}`;
            } else {
                message += `🔗 Wikipedia: https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
            }

            // Send the text message first
            await sendMessage(senderId, { text: message }, pageAccessToken);
            
            // Send thumbnail if available
            if (thumbnailUrl && !thumbnailSent) {
                try {
                    await sendMessage(senderId, {
                        attachment: {
                            type: 'image',
                            payload: {
                                url: thumbnailUrl,
                                is_reusable: true
                            }
                        }
                    }, pageAccessToken);
                } catch (imgError) {
                    console.error('Failed to send thumbnail:', imgError.message);
                    // Silent fail - image is optional
                }
            }

        } catch (error) {
            console.error('Wikipedia API Error:', error.message);
            
            let errorMessage = `❌ Failed to fetch Wikipedia article.\n\n`;
            
            if (error.code === 'ECONNABORTED') {
                errorMessage += `Connection timeout. Please try again later.`;
            } else if (error.response && error.response.status === 404) {
                errorMessage += `No results found for "${searchQuery}". Please try a different search term.`;
            } else if (error.response && error.response.status === 429) {
                errorMessage += `Too many requests. Please wait a moment and try again.`;
            } else {
                errorMessage += `Error: ${error.message}`;
            }
            
            await sendMessage(senderId, { text: errorMessage }, pageAccessToken);
        }
    }
};