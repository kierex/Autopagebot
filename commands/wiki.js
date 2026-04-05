const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['wikipedia', 'wiki'],
    usage: 'wikipedia [query]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'search',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: '📚 Please provide a search query!\n\n📝 Usage: wikipedia [topic]\n✨ Example: wikipedia Albert Einstein'
            }, pageAccessToken);
        }

        const query = encodeURIComponent(args.join(' '));
        
        try {
            const response = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${query}`);
            const data = response.data;
            
            if (!data || !data.title) {
                return sendMessage(senderId, { text: '❌ No Wikipedia page found.' }, pageAccessToken);
            }
            
            const message = `📚 𝗪𝗜𝗞𝗜𝗣𝗘𝗗𝗜𝗔\n📖 ${data.title}\n\n${data.extract?.substring(0, 1500) || 'No description available.'}\n\n🔗 Read more: ${data.content_urls?.desktop?.page || 'https://en.wikipedia.org'}`;
            
            await sendMessage(senderId, { text: message }, pageAccessToken);
            
        } catch (error) {
            console.error('Wikipedia Error:', error.message);
            await sendMessage(senderId, { text: '❌ Wikipedia search failed. Please try another query.' }, pageAccessToken);
        }
    }
};