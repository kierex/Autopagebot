const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    try {
        const response = await axios.get(`https://jonell.ccprojects.gleeze.com/api/d/youtubedl?url=${encodeURIComponent(url)}`, {
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data) {
            return res.json({
                success: true,
                mp3: response.data.mp3,
                mp4: response.data.mp4,
                title: response.data.title,
                thumbnail: response.data.thumbnail
            });
        } else {
            return res.status(400).json({
                success: false,
                error: 'Failed to fetch YouTube video'
            });
        }
    } catch (error) {
        console.error('YouTube API error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};