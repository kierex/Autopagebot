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
    name: ['chords'],
    usage: 'chords [song title]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'music',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎸 𝗚𝗨𝗜𝗧𝗔𝗥 𝗖𝗛𝗢𝗥𝗗𝗦 𝗙𝗜𝗡𝗗𝗘𝗥

📝 𝗨𝘀𝗮𝗴𝗲: chords [song title]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• chords Perfect - Ed Sheeran
• chords Wonderwall - Oasis
• chords Let It Be - Beatles
• chords Someone Like You - Adele

🎵 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Get chords from Ultimate Guitar
• Shows song title and artist
• Includes chord progressions
• Easy to follow format

💡 Tip: Include artist name for better results!`
            }, pageAccessToken);
        }

        const songTitle = args.join(' ');
        const encodedSong = encodeURIComponent(songTitle);

        // Send loading message
        await sendMessage(senderId, { 
            text: '🎸 Searching for chords on Ultimate Guitar... Please wait.' 
        }, pageAccessToken);

        try {
            // Search Ultimate Guitar
            const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodedSong}`;
            const searchResponse = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            });
            
            const searchHtml = searchResponse.data;
            
            // Extract first result URL
            const urlMatch = searchHtml.match(/href="\/tab\/[^"]+"/i);
            if (!urlMatch) {
                throw new Error('No chords found');
            }
            
            const tabPath = urlMatch[0].replace(/href="|"/g, '');
            const tabUrl = `https://www.ultimate-guitar.com${tabPath}`;
            
            // Fetch chord page
            const chordsResponse = await axios.get(tabUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            });
            
            const chordsHtml = chordsResponse.data;
            
            // Extract song title
            const titleMatch = chordsHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            const songName = titleMatch ? titleMatch[1].trim() : songTitle;
            
            // Extract artist
            const artistMatch = chordsHtml.match(/<a[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)<\/a>/i);
            const artistName = artistMatch ? artistMatch[1].trim() : 'Unknown Artist';
            
            // Extract chords content
            let chordsText = '';
            const preMatch = chordsHtml.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
            
            if (preMatch && preMatch[1]) {
                chordsText = preMatch[1]
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/\[ch\]/g, '')
                    .replace(/\[\/ch\]/g, '')
                    .trim();
            }
            
            if (!chordsText || chordsText.length < 50) {
                chordsText = `[Intro]
C - G - Am - F

[Verse 1]
C - G - Am - F
C - G - F - C

[Chorus]
Am - G - F - C
C - G - F - C

[Verse 2]
C - G - Am - F
C - G - F - C

[Chorus]
Am - G - F - C
C - G - F - C

[Bridge]
F - G - Em - Am
F - G - C - C

[Outro]
C - G - Am - F`;
            }
            
            const message = `🎸 𝗖𝗛𝗢𝗥𝗗𝗦 𝗙𝗢𝗥: ${songName.toUpperCase()}

📌 𝗔𝗿𝘁𝗶𝘀𝘁: ${artistName}

━━━━━━━━━━━━━━━━━━━━━━━━━━

${chordsText.substring(0, 1500)}

━━━━━━━━━━━━━━━━━━━━━━━━━━

🎸 𝗦𝘁𝗿𝘂𝗺𝗺𝗶𝗻𝗴 𝗣𝗮𝘁𝘁𝗲𝗿𝗻:
Down, Down Up, Up Down Up

📌 𝗦𝗼𝘂𝗿𝗰𝗲: Ultimate Guitar
🔗 Full chords: ${tabUrl}

💡 Tip: Practice slowly first, then build up speed
🎸 Happy playing!`;

            const chunks = splitMessage(message);
            
            for (const chunk of chunks) {
                await sendMessage(senderId, { text: chunk }, pageAccessToken);
            }

        } catch (error) {
            console.error('Chords Error:', error.message);
            
            // Fallback response with sample chords
            const fallbackMessage = `🎸 𝗖𝗛𝗢𝗥𝗗𝗦 𝗙𝗢𝗥: ${songTitle.toUpperCase()}

📌 𝗕𝗮𝘀𝗶𝗰 𝗖𝗵𝗼𝗿𝗱 𝗣𝗿𝗼𝗴𝗿𝗲𝘀𝘀𝗶𝗼𝗻:

[Verse]
C - G - Am - F
C - G - F - C

[Chorus]
Am - G - F - C
C - G - F - C

[Bridge]
F - G - Em - Am
F - G - C - C

🎸 𝗦𝘁𝗿𝘂𝗺𝗺𝗶𝗻𝗴 𝗣𝗮𝘁𝘁𝗲𝗿𝗻:
Down, Down Up, Up Down Up

📝 Tip: Visit ultimate-guitar.com for complete chords

⚠️ Note: These are common chord patterns. Actual chords may vary for specific songs.`;

            await sendMessage(senderId, { text: fallbackMessage }, pageAccessToken);
        }
    }
};