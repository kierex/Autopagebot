const axios = require("axios");
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: "wiki",
  usage: "wiki [search term]",
  author: "AutoPageBot",
  version: "1.0.0",
  category: "search",
  cooldown: 3,

  async execute(senderId, args, pageAccessToken, event) {
    const query = args.join(" ");

    if (!query) {
      return sendMessage(
        senderId,
        { text: `🌐 𝗪𝗶𝗸𝗶𝗽𝗲𝗱𝗶𝗮 𝗦𝗲𝗮𝗿𝗰𝗵\n━━━━━━━━━━━━━━━━━━\nℹ️ Search articles from Wikipedia.\n\n📝 Usage:\nwiki [search term]\n\n📌 Examples:\n• wiki Philippines\n• wiki Albert Einstein\n• wiki Artificial Intelligence` },
        pageAccessToken
      );
    }

    try {
      await sendMessage(
        senderId,
        { text: `🔍 Searching Wikipedia for "${query}"...` },
        pageAccessToken
      );

      // Search for article
      const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, { timeout: 15000 });

      if (response.data.type === "disambiguation") {
        return sendMessage(
          senderId,
          { text: `❌ "${query}" is ambiguous. Please be more specific.\n\n💡 Try: wiki ${response.data.title.split('(')[0].trim()}` },
          pageAccessToken
        );
      }

      if (!response.data.extract) {
        return sendMessage(
          senderId,
          { text: `❌ No article found for "${query}".\n\n💡 Try a different search term.` },
          pageAccessToken
        );
      }

      // Trim long text
      let summary = response.data.extract.length > 1500 
        ? response.data.extract.substring(0, 1500) + "..." 
        : response.data.extract;

      const result = `🌐 𝗪𝗶𝗸𝗶𝗽𝗲𝗱𝗶𝗮\n━━━━━━━━━━━━━━━━━━\n📌 ${response.data.title}\n\n${summary}\n\n🔗 ${response.data.content_urls.desktop.page}\n━━━━━━━━━━━━━━━━━━`;
      
      await sendMessage(senderId, { text: result }, pageAccessToken);

    } catch (error) {
      console.error("Wikipedia Error:", error.message);
      
      if (error.response?.status === 404) {
        await sendMessage(
          senderId,
          { text: `❌ No article found for "${query}".\n\n💡 Try a different search term.` },
          pageAccessToken
        );
      } else {
        await sendMessage(
          senderId,
          { text: `❌ Search failed: ${error.message}` },
          pageAccessToken
        );
      }
    }
  }
};