const { readFile, writeFile } = require('fs/promises');
const path = require('path');

const TOKENS_FILE = path.join(__dirname, '../tokens.json');
let pageTokens = new Map();

const loadTokens = async () => {
  try {
    const data = await readFile(TOKENS_FILE, 'utf8').catch(() => '{}');
    const tokens = JSON.parse(data);
    
    for (const [pageId, tokenData] of Object.entries(tokens)) {
      pageTokens.set(pageId, tokenData);
    }
    
    console.log(`✅ Loaded ${pageTokens.size} page tokens`);
    return pageTokens;
  } catch (error) {
    console.error('Error loading tokens:', error.message);
    return new Map();
  }
};

const saveTokens = async () => {
  const tokens = Object.fromEntries(pageTokens);
  await writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
};

const addToken = async (pageId, tokenData) => {
  pageTokens.set(pageId, tokenData);
  await saveTokens();
  console.log(`✅ Added token for page: ${tokenData.name} (${pageId})`);
};

const getToken = async (pageId) => {
  return pageTokens.get(pageId);
};

const removeToken = async (pageId) => {
  const deleted = pageTokens.delete(pageId);
  if (deleted) await saveTokens();
  return deleted;
};

const getAllSessions = async () => {
  const sessions = [];
  for (const [pageId, data] of pageTokens.entries()) {
    sessions.push({
      id: pageId,
      name: data.name,
      username: data.username,
      owner: data.owner,
      lastActive: data.lastActive,
      connectedAt: data.connectedAt,
      messengerLink: `https://m.me/${pageId}`
    });
  }
  return sessions;
};

const updateLastActive = async (pageId) => {
  const token = pageTokens.get(pageId);
  if (token) {
    token.lastActive = new Date().toISOString();
    pageTokens.set(pageId, token);
    await saveTokens();
  }
};

module.exports = {
  loadTokens,
  addToken,
  getToken,
  removeToken,
  getAllSessions,
  updateLastActive
};