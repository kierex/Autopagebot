const axios = require("axios");
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: "urban",
  usage: "urban [word/slang]",
  author: "AutoPageBot",
  version: "1.0.0",
  category: "search",
  cooldown: 2,

  async execute(senderId, args, pageAccessToken, event) {
    const query = args.join(" ");

    if (!query) {
      return sendMessage(
        senderId,
        { text: `📖 𝗨𝗿𝗯𝗮𝗻 𝗗𝗶𝗰𝘁𝗶𝗼𝗻𝗮𝗿𝘆\n━━━━━━━━━━━━━━━━━━\nℹ️ Search for slang words and phrases.\n\n📝 Usage:\nurban [word/slang]\n\n📌 Examples:\n• urban sus\n• urban cap\n• urban based` },
        pageAccessToken
      );
    }

    try {
      await sendMessage(
        senderId,
        { text: `🔍 Searching definition for "${query}"...` },
        pageAccessToken
      );

      const apiUrl = `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(query)}`;
      const response = await axios.get(apiUrl, { timeout: 15000 });

      if (!response.data.list || response.data.list.length === 0) {
        return sendMessage(
          senderId,
          { text: `❌ No definition found for "${query}".\n\n💡 Try a different word or phrase.` },
          pageAccessToken
        );
      }

      const definition = response.data.list[0];
      
      // Trim long text
      let meaning = definition.definition.length > 500 
        ? definition.definition.substring(0, 500) + "..." 
        : definition.definition;
      
      let example = definition.example.length > 300 
        ? definition.example.substring(0, 300) + "..." 
        : definition.example;

      const result = `📖 𝗨𝗿𝗯𝗮𝗻: ${query}\n━━━━━━━━━━━━━━━━━━\n📝 Definition:\n${meaning}\n\n💬 Example:\n${example || "No example provided"}\n\n👍 ${definition.thumbs_up} | 👎 ${definition.thumbs_down}\n━━━━━━━━━━━━━━━━━━`;
      
      await sendMessage(senderId, { text: result }, pageAccessToken);

    } catch (error) {
      console.error("Urban Error:", error.message);
      await sendMessage(
        senderId,
        { text: `❌ Search failed: ${error.message}` },
        pageAccessToken
      );
    }
  }
};