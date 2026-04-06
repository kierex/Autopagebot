const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

function splitMessage(text) {
  const maxLength = 1900;
  const chunks = [];

  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }

  return chunks;
}

module.exports = {
    name: ['lyrics', 'lyric', 'songlyrics'],
    usage: 'lyrics [artist] | [song]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'music',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎵 𝗟𝗬𝗥𝗜𝗖𝗦 𝗙𝗜𝗡𝗗𝗘𝗥

📝 𝗨𝘀𝗮𝗴𝗲: lyrics [artist] | [song]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• lyrics Taylor Swift | Crazier
• lyrics Ed Sheeran | Perfect
• lyrics Adele | Someone Like You
• lyrics Bruno Mars | Just The Way You Are

💡 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Get full song lyrics
• Artist and song search
• Fast response
• Clean formatting

📌 Use the | symbol to separate artist and song`
            }, pageAccessToken);
        }

        const input = args.join(' ');
        
        // Parse artist and song from input
        let artist = '';
        let song = '';
        
        if (input.includes('|')) {
            const parts = input.split('|');
            artist = parts[0].trim();
            song = parts[1].trim();
        } else {
            // If no pipe, try to guess (last word as song, rest as artist)
            const words = input.split(' ');
            if (words.length >= 2) {
                song = words[words.length - 1];
                artist = words.slice(0, -1).join(' ');
            } else {
                artist = input;
                song = '';
            }
        }

        if (!artist || !song) {
            return sendMessage(senderId, {
                text: `❌ Invalid format!

📝 Correct format: lyrics [artist] | [song]

✨ Examples:
• lyrics Taylor Swift | Crazier
• lyrics Ed Sheeran | Perfect

💡 Use the | symbol to separate artist and song`
            }, pageAccessToken);
        }

        // Send loading message
        await sendMessage(senderId, { 
            text: `🎵 Searching for lyrics of "${song}" by ${artist}...` 
        }, pageAccessToken);

        try {
            const apiUrl = `https://yin-api.vercel.app/search/lyrics?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(song)}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            
            const data = response.data;
            
            if (!data || !data.answer) {
                throw new Error('No lyrics found');
            }
            
            const lyrics = data.answer;
            const responseTime = data.responseTime || 'N/A';
            const timestamp = data.timestamp;
            
            const date = new Date(timestamp);
            const phTime = date.toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            const header = `🎵 𝗟𝗬𝗥𝗜𝗖𝗦\n📌 ${song.toUpperCase()} - ${artist.toUpperCase()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            const footer = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 ${phTime}\n💡 Try: lyrics [artist] | [song]`;
            
            let fullMessage = header + lyrics + footer;
            
            // Split if too long
            const chunks = splitMessage(fullMessage);
            
            for (const chunk of chunks) {
                await sendMessage(senderId, { text: chunk }, pageAccessToken);
            }
            
        } catch (error) {
            console.error('Lyrics Error:', error.message);
            
            let errorMessage = `❌ No lyrics found for "${song}" by ${artist}.

📝 Tips:
• Check the spelling of artist name
• Check the song title
• Try using the format: lyrics [artist] | [song]

✨ Example: lyrics Taylor Swift | Crazier

💡 Make sure the song exists and is popular enough.`;
            
            // Try alternative format if artist and song are swapped
            if (!input.includes('|')) {
                errorMessage += `\n\n💡 Try using the | symbol: lyrics ${song} | ${artist}`;
            }
            
            await sendMessage(senderId, { text: errorMessage }, pageAccessToken);
        }
    }
};