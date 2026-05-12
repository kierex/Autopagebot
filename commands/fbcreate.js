const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');
const crypto = require('crypto');

// ========== ENHANCED STORAGE SYSTEMS ==========
const userCooldowns = new Map();
const rateLimits = new Map();

// Configuration
const REQUEST_LIMIT = 3; // Max requests per minute per user
const REQUEST_WINDOW = 60000; // 1 minute window
const MAX_RETRIES = 3;

// Multiple API endpoints for redundancy
const API_ENDPOINTS = [
    "https://b-api.facebook.com/method/user.register",
    "https://b-graph.facebook.com/method/user.register",
    "https://graph.facebook.com/v1.0/method/user.register",
    "https://api.facebook.com/method/user.register"
];

// Rotating User Agents
const USER_AGENTS = [
    "[FBAN/FB4A;FBAV/35.0.0.48.273;FBDM/{density=1.33125,width=800,height=1205};FBLC/en_US;FBCR/;FBPN/com.facebook.katana;FBDV/Nexus 7;FBSV/4.1.1;FBBK/0;]",
    "[FBAN/FB4A;FBAV/38.0.0.45.171;FBDM/{density=2.0,width=720,height=1280};FBLC/en_US;FBCR/;FBPN/com.facebook.katana;FBDV/XT1562;FBSV/6.0.1;FBBK/0;]",
    "[FBAN/FB4A;FBAV/40.0.0.56.234;FBDM/{density=1.5,width=1080,height=1920};FBLC/en_US;FBCR/;FBPN/com.facebook.katana;FBDV/Redmi Note 4;FBSV/7.0;FBBK/0;]",
    "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
];

// Filipino Names Database
const filipinoFirstNames = [
    "Jake", "John", "Mark", "Michael", "Ryan", "Arvin", "Kevin", "Ian", "Carlo", "Jeffrey",
    "Joshua", "Bryan", "Jericho", "Christian", "Vincent", "Angelo", "Francis", "Patrick",
    "Emmanuel", "Gerald", "Marvin", "Ronald", "Albert", "Roderick", "Raymart", "Jay-ar",
    "Maria", "Ana", "Lisa", "Jennifer", "Christine", "Catherine", "Jocelyn", "Marilyn",
    "Angel", "Princess", "Mary Joy", "Rose Ann", "Liezl", "Aileen", "Darlene", "Shiela",
    "Jose", "Manuel", "Ricardo", "Fernando", "Gregorio", "Hernando", "Leonardo", "Miguel",
    "Rafael", "Salvador", "Tomas", "Victor", "Alberto", "Benigno", "Carlito", "Danilo"
];

const filipinoSurnames = [
    "Dela Cruz", "Santos", "Reyes", "Garcia", "Mendoza", "Flores", "Gonzales", "Lopez",
    "Cruz", "Perez", "Fernandez", "Villanueva", "Ramos", "Aquino", "Castro", "Rivera",
    "Bautista", "Martinez", "De Guzman", "Francisco", "Alvarez", "Domingo", "Mercado",
    "Torres", "Gutierrez", "Ramirez", "Delos Santos", "Tolentino", "Javier", "Hernandez",
    "Acosta", "Agustin", "Andres", "Beltran", "Bernardo", "Buenaventura", "Cabrera"
];

class FacebookCreator {
    constructor() {
        this.api_key = "882a8490361da98702bf97a021ddc14d";
        this.secret = "62f8ce9f74b12f84c123cc23437a4a32";
        this.currentEndpoint = 0;
    }

    checkRateLimit(userId) {
        const now = Date.now();
        const userLimit = rateLimits.get(userId);
        
        if (userLimit) {
            const validRequests = userLimit.filter(time => now - time < REQUEST_WINDOW);
            if (validRequests.length >= REQUEST_LIMIT) {
                const oldestRequest = validRequests[0];
                const waitTime = Math.ceil((oldestRequest + REQUEST_WINDOW - now) / 1000);
                return { allowed: false, waitTime };
            }
            rateLimits.set(userId, validRequests);
        }
        return { allowed: true };
    }

    recordRequest(userId) {
        const now = Date.now();
        const userLimit = rateLimits.get(userId) || [];
        userLimit.push(now);
        rateLimits.set(userId, userLimit);
    }

    generateRandomString(length) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateRandomPassword(length = 12) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let password = "";
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    getRandomDate(start = new Date(1976, 0, 1), end = new Date(2004, 0, 1)) {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }

    getRandomName() {
        return {
            firstName: filipinoFirstNames[Math.floor(Math.random() * filipinoFirstNames.length)],
            lastName: filipinoSurnames[Math.floor(Math.random() * filipinoSurnames.length)]
        };
    }

    getRandomUserAgent() {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    }

    getNextEndpoint() {
        this.currentEndpoint = (this.currentEndpoint + 1) % API_ENDPOINTS.length;
        return API_ENDPOINTS[this.currentEndpoint];
    }

    async createAccountWithRetry(options, retryCount = 0) {
        try {
            const result = await this.createAccount(options);
            if (result.success) {
                return result;
            } else if (retryCount < MAX_RETRIES) {
                const delay = 3000 * (retryCount + 1);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.createAccountWithRetry(options, retryCount + 1);
            }
            return result;
        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                const delay = 3000 * (retryCount + 1);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.createAccountWithRetry(options, retryCount + 1);
            }
            return { success: false, error: error.message };
        }
    }

    async createAccount(options = {}) {
        try {
            const {
                firstName,
                lastName,
                email,
                password,
                gender,
                birthday = this.getRandomDate()
            } = options;

            if (!email || !firstName || !lastName || !password || !gender) {
                throw new Error('Missing required fields');
            }

            const birthYear = birthday.getFullYear();
            const birthMonth = String(birthday.getMonth() + 1).padStart(2, '0');
            const birthDay = String(birthday.getDate()).padStart(2, '0');
            const formattedBirthday = `${birthYear}-${birthMonth}-${birthDay}`;

            const req = {
                api_key: this.api_key,
                attempt_login: true,
                birthday: formattedBirthday,
                client_country_code: "EN",
                fb_api_caller_class: "com.facebook.registration.protocol.RegisterAccountMethod",
                fb_api_req_friendly_name: "registerAccount",
                firstname: firstName,
                format: "json",
                gender: gender === "male" ? "M" : "F",
                lastname: lastName,
                email: email,
                locale: "en_US",
                method: "user.register",
                password: password,
                reg_instance: this.generateRandomString(32),
                return_multiple_errors: true
            };

            const sigString = Object.keys(req)
                .sort()
                .map(key => `${key}=${req[key]}`)
                .join('') + this.secret;

            req.sig = crypto.createHash('md5').update(sigString).digest('hex');

            const apiUrl = this.getNextEndpoint();
            const userAgent = this.getRandomUserAgent();

            const response = await axios.post(apiUrl,
                new URLSearchParams(req), {
                    headers: {
                        "User-Agent": userAgent,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "*/*"
                    },
                    timeout: 30000
                });

            if (response.data && response.data.session_key) {
                const userId = response.data.new_user_id || response.data.uid || this.generateRandomString(14);
                return {
                    success: true,
                    account: {
                        email: email,
                        password: password,
                        firstName: firstName,
                        lastName: lastName,
                        birthday: formattedBirthday,
                        userId: userId,
                        profileLink: `https://facebook.com/profile.php?id=${userId}`,
                        gender: gender === "male" ? "Male" : "Female"
                    }
                };
            } else if (response.data && !response.data.error) {
                const userId = response.data.new_user_id || response.data.uid;
                return {
                    success: true,
                    account: {
                        email: email,
                        password: password,
                        firstName: firstName,
                        lastName: lastName,
                        birthday: formattedBirthday,
                        userId: userId,
                        profileLink: `https://facebook.com/profile.php?id=${userId}`,
                        gender: gender === "male" ? "Male" : "Female"
                    }
                };
            } else {
                return {
                    success: false,
                    error: response.data.error_msg || response.data.message || 'Registration failed'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Network error'
            };
        }
    }
}

const fbCreator = new FacebookCreator();

// Cleanup intervals
setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamps] of rateLimits) {
        const valid = timestamps.filter(t => now - t < REQUEST_WINDOW);
        if (valid.length === 0) {
            rateLimits.delete(userId);
        } else {
            rateLimits.set(userId, valid);
        }
    }
    for (const [userId, timestamp] of userCooldowns) {
        if (now - timestamp > 60000) {
            userCooldowns.delete(userId);
        }
    }
}, 60000);

module.exports = {
    name: ['fbcreate', 'fbgen', 'createfb', 'facebook'],
    description: 'Create Facebook account with @yopmail.com domain',
    usage: 'fbcreate gen | fbcreate name|pass|gender <first> <last> <password> <male/female>',
    version: '2.0.0',
    author: 'AutoPageBot',
    category: 'tools',
    cooldown: 60,

    async execute(senderId, args, pageAccessToken) {
        // Check rate limit
        const rateCheck = fbCreator.checkRateLimit(senderId);
        if (!rateCheck.allowed) {
            await sendMessage(senderId, {
                text: `⏱️ *Rate Limit Active*\n\nPlease wait ${rateCheck.waitTime} seconds.\n\n📊 Limit: ${REQUEST_LIMIT} requests/minute`
            }, pageAccessToken);
            return;
        }

        // Check cooldown
        const lastUsed = userCooldowns.get(senderId);
        if (lastUsed && (Date.now() - lastUsed) < 60000) {
            const remaining = Math.ceil((60000 - (Date.now() - lastUsed)) / 1000);
            await sendMessage(senderId, {
                text: `⏱️ *Cooldown Active*\n\nPlease wait ${remaining} seconds before using this command again.`
            }, pageAccessToken);
            return;
        }

        if (!args || args.length === 0) {
            await sendMessage(senderId, {
                text: `📘 *Facebook Account Creator v2.0*\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `✨ *Command Modes:*\n\n` +
                      `🔹 *Random Generation:*\n` +
                      `   fbcreate gen\n` +
                      `   └ Random Filipino name\n` +
                      `   └ Random password\n` +
                      `   └ Random gender\n` +
                      `   └ Random birthday\n\n` +
                      `🔹 *Customized Creation:*\n` +
                      `   fbcreate name|pass|gender <first> <last> <password> <male/female>\n` +
                      `   └ Example: fbcreate name|pass|gender John Dela Cruz Pass123 male\n` +
                      `   └ Birthday is automatically randomized\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━\n` +
                      `📧 *Email Domain:* @yopmail.com\n` +
                      `🎂 *Birthday:* Random (1976-2004)\n` +
                      `⏱️ *Cooldown:* 1 minute\n` +
                      `📊 *Rate Limit:* ${REQUEST_LIMIT} requests/minute\n` +
                      `🔄 *Auto-Retry:* ${MAX_RETRIES} attempts on failure`
            }, pageAccessToken);
            return;
        }

        fbCreator.recordRequest(senderId);
        
        try {
            await sendMessage(senderId, { text: '🔄 Creating Facebook account... Please wait.' }, pageAccessToken);

            let options = {};
            let emailPrefix = '';
            const timestamp = Date.now();

            // Mode 1: Random Generation
            if (args[0].toLowerCase() === 'gen') {
                const randomName = fbCreator.getRandomName();
                const randomGender = Math.random() < 0.5 ? "male" : "female";
                const randomPassword = fbCreator.generateRandomPassword(12);
                
                options = {
                    firstName: randomName.firstName,
                    lastName: randomName.lastName,
                    password: randomPassword,
                    gender: randomGender
                };
                emailPrefix = `${options.firstName.toLowerCase()}.${options.lastName.toLowerCase()}.${timestamp}`;
                
                await sendMessage(senderId, { text: '🎲 Random mode selected. Generating account...' }, pageAccessToken);
            }
            // Mode 2: Customized Creation (name|pass|gender)
            else if (args[0].toLowerCase() === 'name|pass|gender') {
                if (args.length < 5) {
                    await sendMessage(senderId, { 
                        text: `❌ Invalid format!\n\nCorrect usage:\nfbcreate name|pass|gender <first> <last> <password> <male/female>\n\nExample:\nfbcreate name|pass|gender John Dela Cruz Pass123 male` 
                    }, pageAccessToken);
                    return;
                }
                
                const firstName = args[1];
                const lastName = args[2];
                const password = args[3];
                const gender = args[4].toLowerCase();
                
                if (gender !== 'male' && gender !== 'female') {
                    await sendMessage(senderId, { text: '❌ Gender must be "male" or "female".' }, pageAccessToken);
                    return;
                }
                
                if (password.length < 6) {
                    await sendMessage(senderId, { text: '❌ Password must be at least 6 characters.' }, pageAccessToken);
                    return;
                }
                
                options = {
                    firstName: firstName,
                    lastName: lastName,
                    password: password,
                    gender: gender
                };
                emailPrefix = `${options.firstName.toLowerCase()}.${options.lastName.toLowerCase()}.${timestamp}`;
                
                await sendMessage(senderId, { text: '✏️ Custom mode selected. Creating account with your specified details...' }, pageAccessToken);
            }
            else {
                await sendMessage(senderId, { 
                    text: `❌ Invalid command!\n\nUse:\n• fbcreate gen\n• fbcreate name|pass|gender <first> <last> <password> <male/female>` 
                }, pageAccessToken);
                return;
            }

            // Generate email with @yopmail.com domain
            const email = `${emailPrefix}@yopmail.com`;
            const birthday = fbCreator.getRandomDate();
            const birthYear = birthday.getFullYear();
            const birthMonth = String(birthday.getMonth() + 1).padStart(2, '0');
            const birthDay = String(birthday.getDate()).padStart(2, '0');
            const formattedBirthday = `${birthYear}-${birthMonth}-${birthDay}`;

            options.email = email;
            options.birthday = birthday;

            const result = await fbCreator.createAccountWithRetry(options);

            if (result.success) {
                userCooldowns.set(senderId, Date.now());
                const account = result.account;
                const genderIcon = account.gender === "Male" ? "👨" : "👩";

                const successMessage = `✅ *Facebook Account Created!*\n\n` +
                                      `━━━━━━━━━━━━━━━━━━━━\n\n` +
                                      `${genderIcon} *Name:* ${account.firstName} ${account.lastName}\n` +
                                      `📧 *Email:* ${account.email}\n` +
                                      `🔑 *Password:* ${account.password}\n` +
                                      `🎂 *Birthday:* ${account.birthday}\n` +
                                      `⚧ *Gender:* ${account.gender}\n` +
                                      `🆔 *User ID:* ${account.userId}\n` +
                                      `🔗 *Profile:* ${account.profileLink}\n\n` +
                                      `━━━━━━━━━━━━━━━━━━━━\n\n` +
                                      `📬 *Check email at:* https://yopmail.com\n` +
                                      `⚠️ *Note:* May require phone verification\n` +
                                      `⏱️ *Next use available in 1 minute*`;

                await sendMessage(senderId, { text: successMessage }, pageAccessToken);
                console.log(`✅ Account created: ${account.email} for user ${senderId}`);
            } else {
                await sendMessage(senderId, {
                    text: `❌ *Failed to Create Account*\n\nError: ${result.error}\n\n💡 Please try again in a few minutes.`
                }, pageAccessToken);
            }

        } catch (error) {
            console.error('Error in fbcreate:', error);
            await sendMessage(senderId, { text: `❌ Error: ${error.message}` }, pageAccessToken);
        }
    }
};