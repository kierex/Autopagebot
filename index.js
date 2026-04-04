const express = require('express');
const { readFile, watch } = require('fs/promises');
const { join } = require('path');
const { handleMessage } = require('./handles/handleMessage');
const { handlePostback } = require('./handles/handlePostback');
const tokenManager = require('./handles/tokenManager');
const session = require('express-session');

const app = express();
const VERIFY_TOKEN = 'bot';
const COMMANDS_PATH = join(__dirname, 'commands');
const GRAPH_API = 'https://graph.facebook.com/v23.0/me';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'auto-pagebot-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use(express.static('public'));

// API: Get all online sessions
app.get('/api/sessions', async (req, res) => {
  const sessions = await tokenManager.getAllSessions();
  res.json({ sessions, count: sessions.length });
});

// API: Add new page token
app.post('/api/connect', async (req, res) => {
  const { pageToken, pageName, userName } = req.body;
  
  if (!pageToken) {
    return res.status(400).json({ error: 'Page token is required' });
  }

  try {
    // Verify token and get page info
    const response = await fetch(`https://graph.facebook.com/v23.0/me?access_token=${pageToken}`);
    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ error: 'Invalid token: ' + data.error.message });
    }

    const pageId = data.id;
    const name = pageName || data.name || 'Unnamed Page';
    const username = data.username || pageId;
    
    // Store token
    await tokenManager.addToken(pageId, {
      token: pageToken,
      name: name,
      username: username,
      owner: userName || 'Unknown',
      connectedAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    });

    // Setup webhook for this page
    await setupPageWebhook(pageId, pageToken);
    
    res.json({ 
      success: true, 
      page: { id: pageId, name, username },
      message: 'Page connected successfully!'
    });
  } catch (error) {
    console.error('Connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Disconnect page
app.post('/api/disconnect', async (req, res) => {
  const { pageId } = req.body;
  
  if (!pageId) {
    return res.status(400).json({ error: 'Page ID required' });
  }

  await tokenManager.removeToken(pageId);
  res.json({ success: true, message: 'Page disconnected' });
});

// API: Get page insights
app.get('/api/insights/:pageId', async (req, res) => {
  const { pageId } = req.params;
  const tokenData = await tokenManager.getToken(pageId);
  
  if (!tokenData) {
    return res.status(404).json({ error: 'Page not found' });
  }

  try {
    // Get conversation stats
    const convResponse = await fetch(
      `https://graph.facebook.com/v23.0/${pageId}/conversations?limit=1&access_token=${tokenData.token}`
    );
    const convData = await convResponse.json();
    
    res.json({
      pageId,
      name: tokenData.name,
      conversations: convData.summary || { total_count: 0 },
      lastActive: tokenData.lastActive
    });
  } catch (error) {
    res.json({ pageId, name: tokenData.name, error: 'Could not fetch insights' });
  }
});

// Setup webhook for a page
const setupPageWebhook = async (pageId, pageToken) => {
  const webhookUrl = `https://${req.get('host')}/webhook`;
  
  try {
    await fetch(`https://graph.facebook.com/v23.0/${pageId}/subscribed_apps?access_token=${pageToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Webhook configured for page ${pageId}`);
  } catch (error) {
    console.error(`Failed to setup webhook for ${pageId}:`, error.message);
  }
};

// Webhook handler (supports multiple tokens)
app.get('/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  if (req.body.object !== 'page') return res.sendStatus(404);
  
  for (const entry of req.body.entry || []) {
    const pageId = entry.id;
    const tokenData = await tokenManager.getToken(pageId);
    
    if (!tokenData) {
      console.log(`❌ No token found for page ${pageId}`);
      continue;
    }
    
    for (const event of entry.messaging || []) {
      if (event.message) {
        await handleMessage(event, tokenData.token, pageId);
      } else if (event.postback) {
        await handlePostback(event, tokenData.token, pageId);
      }
    }
  }
  
  res.status(200).send('EVENT_RECEIVED');
});

// Start server
const start = async () => {
  await tokenManager.loadTokens();
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Dashboard: http://localhost:${PORT}`);
  });
};

start();