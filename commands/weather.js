const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['weather', 'forecast', 'temp'],
    usage: 'weather [city]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'search',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: '🌤️ Please provide a city name!\n\n📝 Usage: weather [city]\n✨ Example: weather Manila\n✨ Example: weather Tokyo'
            }, pageAccessToken);
        }

        const city = encodeURIComponent(args.join(' '));
        
        try {
            const response = await axios.get(`https://wttr.in/${city}?format=j1`);
            const data = response.data;
            
            const current = data.current_condition[0];
            const location = data.nearest_area[0];
            
            const temp = current.temp_C;
            const feelsLike = current.FeelsLikeC;
            const humidity = current.humidity;
            const wind = current.windspeedKmph;
            const condition = current.weatherDesc[0].value;
            
            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            const weatherEmoji = {
                'Sunny': '☀️', 'Clear': '🌙', 'Cloudy': '☁️', 'Partly cloudy': '⛅',
                'Rain': '🌧️', 'Thunder': '⛈️', 'Snow': '❄️', 'Fog': '🌫️'
            };
            
            const emoji = weatherEmoji[condition] || '🌡️';
            
            const message = `🌤️ 𝗪𝗘𝗔𝗧𝗛𝗘𝗥 𝗙𝗢𝗥𝗘𝗖𝗔𝗦𝗧
📍 ${location.areaName[0]?.value || city}, ${location.country[0]?.value || 'Earth'}

${emoji} 𝗖𝗼𝗻𝗱𝗶𝘁𝗶𝗼𝗻: ${condition}
🌡️ 𝗧𝗲𝗺𝗽𝗲𝗿𝗮𝘁𝘂𝗿𝗲: ${temp}°C (Feels like ${feelsLike}°C)
💧 𝗛𝘂𝗺𝗶𝗱𝗶𝘁𝘆: ${humidity}%
💨 𝗪𝗶𝗻𝗱: ${wind} km/h

📅 Last updated: ${phTime}

💡 Tip: Try -weather [other city]`;

            await sendMessage(senderId, { text: message }, pageAccessToken);
            
        } catch (error) {
            console.error('Weather Error:', error.message);
            await sendMessage(senderId, { text: '❌ City not found. Please check the spelling or try another city.' }, pageAccessToken);
        }
    }
};