const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['imagesearch', 'img', 'photo'],
    usage: 'imagesearch [query]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'search',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: '🖼️ Please provide an image search query!\n\n📝 Usage: imagesearch [query]\n✨ Example: imagesearch beautiful sunset'
            }, pageAccessToken);
        }

        const query = encodeURIComponent(args.join(' '));
        
        try {
            const response = await axios.get(`https://api.popcat.xyz/image-search?q=${query}`);
            const images = response.data;
            
            if (!images || images.length === 0) {
                return sendMessage(senderId, { text: '❌ No images found.' }, pageAccessToken);
            }
            
            // Send first 3 images
            for (let i = 0; i < Math.min(3, images.length); i++) {
                await sendMessage(senderId, {
                    attachment: {
                        type: 'image',
                        payload: { url: images[i].url }
                    }
                }, pageAccessToken);
            }
            
            await sendMessage(senderId, {
                text: `🖼️ 𝗜𝗠𝗔𝗚𝗘 𝗦𝗘𝗔𝗥𝗖𝗛\n📝 Query: ${args.join(' ')}\n📸 Found: ${images.length} images\n\n💡 Try: -imagesearch ${args.join(' ')} wallpaper`
            }, pageAccessToken);
            
        } catch (error) {
            console.error('Image Search Error:', error.message);
            await sendMessage(senderId, { text: '❌ Image search failed. Please try again.' }, pageAccessToken);
        }
    }
};