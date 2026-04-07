const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

const API_ENDPOINT = "https://hiroshi-api.onrender.com/canvas/fbcoverv2";

module.exports = {
    name: ['fbcover', 'fbcoverv2', 'cover', 'facebookcover', 'fb'],
    usage: 'fbcover [name] | [color] | [address] | [email] | [subname] | [sdt] | [uid]',
    version: '1.0.0',
    author: 'Ry',
    category: 'canvas',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Parse input with | separator
        const input = args.join(" ").split("|").map(item => item.trim());

        if (input.length < 7) {
            return sendMessage(senderId, {
                text: `🎨 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 𝗖𝗼𝘃𝗲𝗿 𝗠𝗮𝗸𝗲𝗿

📝 𝗨𝘀𝗮𝗴𝗲: fbcover [name] | [color] | [address] | [email] | [subname] | [sdt] | [uid]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲:
fbcover Mark | red | Bacolod | hello@email.com | Hello | 132 | 4

🎨 𝗔𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲 𝗖𝗼𝗹𝗼𝗿𝘀:
red, blue, green, yellow, purple, pink, orange, black, white

📝 𝗣𝗮𝗿𝗮𝗺𝗲𝘁𝗲𝗿𝘀 (All Required):
• name - Your name
• color - Cover color
• address - Your address
• email - Your email
• subname - Subtitle name
• sdt - Additional text
• uid - User ID

💡 Use | (pipe) to separate all 7 parameters!`
            }, pageAccessToken);
        }

        const [name, color, address, email, subname, sdt, uid] = input;

        // Validate that none of the parameters are empty
        if (!name || !color || !address || !email || !subname || !sdt || !uid) {
            return sendMessage(senderId, {
                text: `❌ All fields must contain valid text.

📝 Correct format:
fbcover [name] | [color] | [address] | [email] | [subname] | [sdt] | [uid]

✨ Example:
fbcover Mark | red | Bacolod | hello@email.com | Hello | 132 | 4`
            }, pageAccessToken);
        }

        // Validate color
        const validColors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'black', 'white'];
        if (!validColors.includes(color.toLowerCase())) {
            return sendMessage(senderId, {
                text: `❌ Invalid color: "${color}"

🎨 Available colors: red, blue, green, yellow, purple, pink, orange, black, white

✨ Example: fbcover Mark | red | Bacolod | hello@email.com | Hello | 132 | 4`
            }, pageAccessToken);
        }

        // Validate email
        if (!email.includes('@')) {
            return sendMessage(senderId, {
                text: `❌ Invalid email format: "${email}"

✨ Example: fbcover Mark | red | Bacolod | hello@email.com | Hello | 132 | 4`
            }, pageAccessToken);
        }

        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `fbcover_${Date.now()}.png`);
        
        await fs.mkdir(tempDir, { recursive: true });

        // Send loading reaction (using message since no reaction in Messenger API)
        await sendMessage(senderId, { 
            text: '⏳ Generating Facebook cover... Please wait.' 
        }, pageAccessToken);

        try {
            // Construct API URL with all parameters
            const fullApiUrl = `${API_ENDPOINT}?name=${encodeURIComponent(name)}&color=${encodeURIComponent(color)}&address=${encodeURIComponent(address)}&email=${encodeURIComponent(email)}&subname=${encodeURIComponent(subname)}&sdt=${encodeURIComponent(sdt)}&uid=${encodeURIComponent(uid)}`;
            
            console.log('API URL:', fullApiUrl); // Debug log

            const response = await axios.get(fullApiUrl, { 
                responseType: 'arraybuffer',
                timeout: 60000
            });

            // Check if response is an error
            const responseString = response.data.toString();
            if (responseString.includes('error') || responseString.includes('Could not process')) {
                throw new Error('API returned error');
            }

            await fs.writeFile(tempFile, Buffer.from(response.data));

            // Upload to Facebook
            const form = new FormData();
            form.append('message', JSON.stringify({
                attachment: { type: 'image', payload: { is_reusable: true } }
            }));
            form.append('filedata', createReadStream(tempFile));

            const uploadRes = await axios.post(
                `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
                form,
                { headers: form.getHeaders() }
            );

            // Send image
            await axios.post(
                `https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`,
                {
                    recipient: { id: senderId },
                    message: {
                        attachment: {
                            type: 'image',
                            payload: { attachment_id: uploadRes.data.attachment_id }
                        }
                    }
                }
            );

            // Send success message with details
            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            const details = `✅ 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 𝗰𝗼𝘃𝗲𝗿 𝗴𝗲𝗻𝗲𝗿𝗮𝘁𝗲𝗱 𝘀𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆!

━━━━━━━━━━━━━━━━━━━━━━━━━━

📛 𝗡𝗮𝗺𝗲: ${name}
🎨 𝗖𝗼𝗹𝗼𝗿: ${color}
📍 𝗔𝗱𝗱𝗿𝗲𝘀𝘀: ${address}
📧 𝗘𝗺𝗮𝗶𝗹: ${email}
📝 𝗦𝘂𝗯𝗻𝗮𝗺𝗲: ${subname}
🔢 𝗦𝗗𝗧: ${sdt}
🆔 𝗨𝗜𝗗: ${uid}

━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 ${phTime}

💡 Try: fbcover [name] | [color] | [address] | [email] | [subname] | [sdt] | [uid]`;

            await sendMessage(senderId, { text: details }, pageAccessToken);

            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}

        } catch (error) {
            console.error('FBCover Error:', error.message);

            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}

            let errorMessage = "An error occurred during cover generation.";

            if (error.response) {
                if (error.response.status === 404) {
                    errorMessage = "API Endpoint not found (404).";
                } else {
                    errorMessage = `HTTP Error: ${error.response.status}`;
                }
            } else if (error.code === 'ETIMEDOUT') {
                errorMessage = "Generation timed out. Please try again.";
            } else if (error.message) {
                errorMessage = error.message;
            }

            await sendMessage(senderId, {
                text: `❌ ${errorMessage}

📝 Correct format:
fbcover [name] | [color] | [address] | [email] | [subname] | [sdt] | [uid]

✨ Example:
fbcover Mark | red | Bacolod | hello@email.com | Hello | 132 | 4

🎨 Colors: red, blue, green, yellow, purple, pink, orange, black, white`
            }, pageAccessToken);
        }
    }
};