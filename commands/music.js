const axios = require("axios");
const { sendMessage } = require("../handles/sendMessage");

const SEARCH_URL = "https://api.jonell-hutchin-api-ccprojects.kozow.com/api/ytsearch";
const DOWNLOAD_URL = "https://api-library-kohi.onrender.com/api/alldl";

module.exports = {
  name: "music",
  description: "Search and download YouTube videos.",
  usage: "ytvideo <video name>",
  category: 'search',
  author: "Ry",

  async execute(senderId, args, pageAccessToken) {
    if (!args.length) {
      return sendMessage(senderId, { text: "❌ 𝖯𝗅𝖾𝖺𝗌𝖾 𝗉𝗋𝗈𝗏𝗂𝖽𝖾 𝖺 𝗌𝖾𝖺𝗋𝖼𝗁 𝗊𝗎𝖾𝗋𝗒.." }, pageAccessToken);
    }

    const query = args.join(" ");
    await searchAndDownload(senderId, query, pageAccessToken);
  },
};

const searchAndDownload = async (senderId, query, pageAccessToken) => {
  try {
    // 🔍 Step 1: Search video
    const searchRes = await axios.get(SEARCH_URL, { params: { title: query } });
    const video = searchRes.data?.results?.[0];

    if (!video) {
      return sendMessage(senderId, { text: "⚠️ No video found for your search." }, pageAccessToken);
    }

    const { title, author, duration, views, publishedAgo, url } = video;

    // ⬇️ Step 2: Get download info
    const dlRes = await axios.get(DOWNLOAD_URL, { params: { url: url } });
    const data = dlRes.data;

    if (!data || !data.status || !data.data?.videoUrl) {
      return sendMessage(senderId, { text: "⚠️ Download link not available." }, pageAccessToken);
    }

    const videoUrl = data.data.videoUrl;

    // 🎥 Step 3: Send video with details
    await sendMessage(
      senderId,
      {
        text: `🎬 𝗧𝗶𝘁𝗹𝗲: ${title}\n👤 𝗔𝘂𝘁𝗵𝗼𝗿: ${author}\n⏱️ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻: ${duration}\n👁️ 𝗩𝗶𝗲𝘄𝘀: ${views.toLocaleString()}\n📅 𝗨𝗽𝗹𝗼𝗮𝗱𝗲𝗱: ${publishedAgo}\n\n🎞️ Downloading video...`,
      },
      pageAccessToken
    );

    // 🎞️ Step 4: Send the actual video file
    await sendMessage(
      senderId,
      {
        attachment: {
          type: "video",
          payload: { url: videoUrl, is_reusable: true },
        },
      },
      pageAccessToken
    );
  } catch (error) {
    console.error("❌ YouTube command error:", error.response?.data || error.message);
    sendMessage(senderId, { text: "⚠️ Error: Unable to fetch video." }, pageAccessToken);
  }
};