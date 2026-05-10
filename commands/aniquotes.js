const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['aniquotes'],
    usage: 'aniquotes',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'fun',
    cooldown: 3,

    async execute(senderId, args, pageAccessToken) {
        // Send typing indicator
        await sendMessage(senderId, { text: '🎭 Fetching an anime quote...' }, pageAccessToken);

        try {
            const apiUrl = 'https://kryptonite-api-library.vercel.app/api/animequotes';
            const response = await axios.get(apiUrl);
            const data = response.data;

            if (!data || !data.quote) {
                throw new Error('No quote found');
            }

            const character = data.character || 'Unknown Character';
            const quote = data.quote;
            const operator = data.operator || 'Krypton';

            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            const message = `🎭 𝗔𝗡𝗜𝗠𝗘 𝗤𝗨𝗢𝗧𝗘

━━━━━━━━━━━━━━━━━━━━

📖 "${quote}"

━━━━━━━━━━━━━━━━━━━━

👤 𝗖𝗵𝗮𝗿𝗮𝗰𝘁𝗲𝗿: ${character}

📅 ${phTime}

💡 Type -aniquotes for another quote!`;

            await sendMessage(senderId, { text: message }, pageAccessToken);

        } catch (error) {
            console.error('Anime Quotes Error:', error.message);
            
            // Fallback quotes
            const fallbackQuotes = [
                { character: 'Eren Yeager', quote: 'If you win, you live. If you lose, you die. If you don\'t fight, you can\'t win.' },
                { character: 'Goku', quote: 'Power comes in response to a need, not a desire.' },
                { character: 'Lelouch Lamperouge', quote: 'The only ones who should kill are those who are prepared to be killed.' },
                { character: 'Naruto Uzumaki', quote: 'Hard work is worthless for those that don\'t believe in themselves.' },
                { character: 'Monkey D. Luffy', quote: 'I don\'t want to conquer anything. I just think the man with the most freedom is the Pirate King!' },
                { character: 'Light Yagami', quote: 'I\'ll take a potato chip... and eat it!' },
                { character: 'Levi Ackerman', quote: 'Give up on your dreams and die.' },
                { character: 'Edward Elric', quote: 'A lesson without pain is meaningless.' }
            ];
            
            const random = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
            
            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            const fallbackMessage = `🎭 𝗔𝗡𝗜𝗠𝗘 𝗤𝗨𝗢𝗧𝗘 (Fallback)

━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 "${random.quote}"

━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 𝗖𝗵𝗮𝗿𝗮𝗰𝘁𝗲𝗿: ${random.character}

📅 ${phTime}

💡 Type -aniquotes for another quote!`;

            await sendMessage(senderId, { text: fallbackMessage }, pageAccessToken);
        }
    }
};