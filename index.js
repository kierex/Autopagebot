const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const { handleMessage } = require('./handles/handleMessage');
const { handlePostback } = require('./handles/handlePostback');
const tokenManager = require('./handles/tokenManager');

const app = express();
const VERIFY_TOKEN = 'bot';
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'autopagebot-secure-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'strict'
    }
}));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Serve static files
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        sessions: tokenManager.getSessionCount(),
        version: '2.1',
        verifyToken: VERIFY_TOKEN
    });
});

// API: Get all sessions with uptime
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await tokenManager.getAllSessions();
        const sessionsWithDetails = sessions.map(s => ({
            id: s.id,
            name: s.name,
            username: s.username,
            owner: s.owner,
            connectedAt: s.connectedAt,
            lastActive: s.lastActive,
            messengerLink: s.messengerLink,
            uptime: s.connectedAt ? Math.floor((Date.now() - new Date(s.connectedAt).getTime()) / 1000) : 0
        }));
        
        res.json({ 
            sessions: sessionsWithDetails, 
            count: sessionsWithDetails.length,
            serverTime: new Date().toISOString(),
            serverUptime: Math.floor(process.uptime())
        });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// API: Get single page info
app.get('/api/page/:pageId', async (req, res) => {
    const { pageId } = req.params;
    const tokenData = await tokenManager.getToken(pageId);
    
    if (!tokenData) {
        return res.status(404).json({ error: 'Page not found' });
    }
    
    res.json({
        id: pageId,
        name: tokenData.name,
        owner: tokenData.owner,
        connectedAt: tokenData.connectedAt,
        lastActive: tokenData.lastActive,
        uptime: Math.floor((Date.now() - new Date(tokenData.connectedAt).getTime()) / 1000)
    });
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
        
        // Check if page already exists
        const existing = await tokenManager.getToken(pageId);
        if (existing) {
            return res.status(400).json({ error: 'Page already connected!' });
        }
        
        // Store token with owner info
        await tokenManager.addToken(pageId, {
            token: pageToken,
            name: name,
            username: username,
            owner: userName || 'Anonymous',
            connectedAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            sessionId: req.sessionID,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });

        // Setup webhook for this page
        const webhookUrl = `${req.protocol}://${req.get('host')}/webhook`;
        await setupPageWebhook(pageId, pageToken, webhookUrl);
        
        console.log(`✅ Page connected: ${name} (${pageId}) by ${userName || 'Anonymous'}`);
        
        res.json({ 
            success: true, 
            page: { id: pageId, name, username },
            message: 'Page connected successfully!'
        });
    } catch (error) {
        console.error('Connection error:', error);
        res.status(500).json({ error: 'Connection failed. Please try again.' });
    }
});

// Setup webhook for a page
const setupPageWebhook = async (pageId, pageToken, webhookUrl) => {
    try {
        // Subscribe app to page
        const subscribeRes = await fetch(`https://graph.facebook.com/v23.0/${pageId}/subscribed_apps?access_token=${pageToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (subscribeRes.ok) {
            console.log(`✅ Webhook configured for page ${pageId}`);
        } else {
            console.log(`⚠️ Webhook subscription issue for page ${pageId}`);
        }
        
        // Set webhook fields (optional but recommended)
        const fieldsRes = await fetch(`https://graph.facebook.com/v23.0/me/messenger_profile?access_token=${pageToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                webhook: {
                    url: webhookUrl,
                    verify_token: 'bot'
                },
                fields: ['messages', 'messaging_postbacks', 'messaging_optins']
            })
        }).catch(() => null);
        
    } catch (error) {
        console.error(`Failed to setup webhook for ${pageId}:`, error.message);
    }
};

// Webhook verification
app.get('/webhook', (req, res) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    
    console.log(`Webhook verification - Mode: ${mode}, Token: ${token}`);
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Webhook verification failed');
        res.sendStatus(403);
    }
});

// Webhook handler (supports multiple tokens)
app.post('/webhook', async (req, res) => {
    if (req.body.object !== 'page') {
        return res.sendStatus(404);
    }
    
    console.log(`📨 Webhook received: ${req.body.entry?.length || 0} entries`);
    
    for (const entry of req.body.entry || []) {
        const pageId = entry.id;
        const tokenData = await tokenManager.getToken(pageId);
        
        if (!tokenData) {
            console.log(`❌ No token found for page ${pageId}`);
            continue;
        }
        
        // Update last active
        await tokenManager.updateLastActive(pageId);
        
        // Process each messaging event
        for (const event of entry.messaging || []) {
            try {
                if (event.message) {
                    await handleMessage(event, tokenData.token, pageId);
                } else if (event.postback) {
                    await handlePostback(event, tokenData.token, pageId);
                }
            } catch (error) {
                console.error(`Error processing event for ${pageId}:`, error.message);
            }
        }
    }
    
    res.status(200).send('EVENT_RECEIVED');
});

// API: Get tutorial info
app.get('/api/tutorial', (req, res) => {
    res.json({
        webhookUrl: `${req.protocol}://${req.get('host')}/webhook`,
        verifyToken: VERIFY_TOKEN,
        apiVersion: 'v23.0',
        docsUrl: 'https://developers.facebook.com/docs/messenger-platform',
        supportEmail: 'support@autopagebot.com'
    });
});

// API: Get system stats
app.get('/api/stats', async (req, res) => {
    const sessions = await tokenManager.getAllSessions();
    const totalMessages = await tokenManager.getTotalMessages() || 0;
    
    res.json({
        activeSessions: sessions.length,
        totalPages: sessions.length,
        serverUptime: process.uptime(),
        startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        version: '2.1',
        totalMessages: totalMessages
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).sendFile(path.join(__dirname, 'public', '500.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Start server
const start = async () => {
    try {
        await tokenManager.loadTokens();
        
        // Create necessary directories if not exists
        if (!fs.existsSync(path.join(__dirname, 'public'))) {
            fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
        }
        
        if (!fs.existsSync(path.join(__dirname, 'commands'))) {
            fs.mkdirSync(path.join(__dirname, 'commands'), { recursive: true });
        }
        
        app.listen(PORT, () => {
            console.log(`\n🤖 AutoPageBot v2.1 Server Running`);
            console.log(`📡 URL: http://localhost:${PORT}`);
            console.log(`🔐 Verify Token: ${VERIFY_TOKEN}`);
            console.log(`📊 Active Sessions: ${tokenManager.getSessionCount()}`);
            console.log(`💡 Dashboard: http://localhost:${PORT}`);
            console.log(`📚 Tutorial: http://localhost:${PORT}#tutorial\n`);
        });
    } catch (error) {
        console.error('Startup failed:', error.message);
        process.exit(1);
    }
};

start();