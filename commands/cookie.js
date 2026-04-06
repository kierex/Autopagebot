const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['fbcookie'],
    usage: 'fbcookie [email] [password]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'tools',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        // EDUCATIONAL WARNING
        const warning = `⚠️ 𝗘𝗗𝗨𝗖𝗔𝗧𝗜𝗢𝗡𝗔𝗟 𝗣𝗨𝗥𝗣𝗢𝗦𝗘 𝗢𝗡𝗟𝗬 ⚠️

This tool is for learning about:
• How cookies work
• Facebook authentication
• Web security vulnerabilities

❌ DO NOT use for:
• Stealing accounts
• Unauthorized access
• Malicious activities

✅ USE ONLY ON YOUR OWN ACCOUNTS

━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        await sendMessage(senderId, { text: warning }, pageAccessToken);

        if (args.length < 2) {
            return sendMessage(senderId, {
                text: `🍪 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗖𝗢𝗢𝗞𝗜𝗘 𝗚𝗘𝗧𝗧𝗘𝗥 (Educational)

📝 𝗨𝘀𝗮𝗴𝗲: fbcookie [email/uid] [password]

⚠️ 𝗘𝗗𝗨𝗖𝗔𝗧𝗜𝗢𝗡𝗔𝗟 𝗣𝗨𝗥𝗣𝗢𝗦𝗘 𝗢𝗡𝗟𝗬

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲:
• fbcookie user@example.com password123

🔒 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆 𝗡𝗼𝘁𝗲:
• Never share your credentials
• Use only on your own accounts
• This is for learning how cookies work

💡 Learn about:
• Session management
• Cookie authentication
• Web security best practices`
            }, pageAccessToken);
        }

        const email = args[0];
        const password = args.slice(1).join(' ');

        // Send loading message
        await sendMessage(senderId, { 
            text: '🍪 Attempting to get cookies (Educational purpose only)...' 
        }, pageAccessToken);

        try {
            // Step 1: Get initial cookies and lsd token
            const initialResponse = await axios.get('https://mbasic.facebook.com/', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // Extract lsd token
            const lsdMatch = initialResponse.data.match(/name="lsd" value="([^"]+)"/);
            const lsd = lsdMatch ? lsdMatch[1] : '';

            // Extract initial cookies
            const cookies = initialResponse.headers['set-cookie'];
            
            // Step 2: Login request
            const loginData = new URLSearchParams();
            loginData.append('lsd', lsd);
            loginData.append('email', email);
            loginData.append('pass', password);
            loginData.append('login', 'Log In');

            const loginResponse = await axios.post('https://mbasic.facebook.com/login/device-based/validate/confirm/', loginData, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookies ? cookies.join('; ') : ''
                },
                maxRedirects: 0,
                validateStatus: status => status >= 200 && status < 400
            });

            // Get final cookies
            const finalCookies = loginResponse.headers['set-cookie'] || [];
            
            if (finalCookies.length === 0) {
                throw new Error('Login failed - Invalid credentials');
            }

            // Extract important cookies
            let c_user = '';
            let xs = '';
            let fr = '';
            let datr = '';
            
            for (const cookie of finalCookies) {
                if (cookie.includes('c_user=')) {
                    c_user = cookie.split('c_user=')[1].split(';')[0];
                }
                if (cookie.includes('xs=')) {
                    xs = cookie.split('xs=')[1].split(';')[0];
                }
                if (cookie.includes('fr=')) {
                    fr = cookie.split('fr=')[1].split(';')[0];
                }
                if (cookie.includes('datr=')) {
                    datr = cookie.split('datr=')[1].split(';')[0];
                }
            }

            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            const message = `🍪 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗖𝗢𝗢𝗞𝗜𝗘𝗦 (Educational)

📧 Email: ${email}
🆔 c_user: ${c_user}
🔐 xs: ${xs}
🍪 fr: ${fr}
📅 datr: ${datr}

━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 𝗖𝗼𝗼𝗸𝗶𝗲 𝗦𝘁𝗿𝗶𝗻𝗴:
c_user=${c_user}; xs=${xs}; fr=${fr}; datr=${datr}

━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️ Time: ${phTime}

⚠️ 𝗘𝗗𝗨𝗖𝗔𝗧𝗜𝗢𝗡𝗔𝗟 𝗨𝗦𝗘 𝗢𝗡𝗟𝗬

💡 Learn about:
• How cookies authenticate users
• Session management
• Web security

❌ Never use to access others' accounts
✅ Use for learning and testing your own accounts

🔒 Always log out and clear cookies after testing`;

            await sendMessage(senderId, { text: message }, pageAccessToken);

        } catch (error) {
            console.error('Cookie Error:', error.message);
            
            await sendMessage(senderId, {
                text: `❌ Failed to get cookies.\n\nPossible reasons:\n• Invalid email/password\n• Two-factor authentication enabled\n• Facebook security check required\n\n📚 Educational purpose only - Test with your own account.\n\n💡 If 2FA is enabled, this method will not work.`
            }, pageAccessToken);
        }
    }
};