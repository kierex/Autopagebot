const axios = require('axios');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Support both GET and POST
    let cookie, link, limit;
    
    if (req.method === 'GET') {
        cookie = req.query.cookie;
        link = req.query.link;
        limit = parseInt(req.query.limit);
    } else if (req.method === 'POST') {
        cookie = req.body.cookie;
        link = req.body.link;
        limit = parseInt(req.body.limit);
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Validate parameters
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie is required' });
    }
    
    if (!link) {
        return res.status(400).json({ error: 'Link is required' });
    }
    
    if (!limit || isNaN(limit) || limit < 1) {
        return res.status(400).json({ error: 'Valid limit is required (minimum 1)' });
    }
    
    // Validate Facebook link
    if (!link.includes('facebook.com') && !link.includes('fb.com')) {
        return res.status(400).json({ error: 'Invalid Facebook link. Please provide a valid Facebook post URL.' });
    }
    
    try {
        const encodedCookie = encodeURIComponent(cookie);
        const encodedLink = encodeURIComponent(link);
        
        const apiUrl = `https://vern-rest-api.vercel.app/api/share?cookie=${encodedCookie}&link=${encodedLink}&limit=${limit}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 300000, // 5 minutes timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.status === true) {
            return res.json({
                success: true,
                requested: limit,
                completed: response.data.success_count || 0,
                message: response.data.message || 'Auto share completed successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                error: response.data?.message || 'Share failed'
            });
        }
        
    } catch (error) {
        console.error('AutoShare API error:', error.message);
        
        let errorMessage = 'Share failed: ';
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage += 'Request timeout. The limit may be too high. Please try with a smaller limit.';
        } else if (error.response?.status === 400) {
            errorMessage += 'Invalid cookie or link. Please check your input.';
        } else if (error.response?.status === 401) {
            errorMessage += 'Authentication failed. Cookie may be expired.';
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            errorMessage += 'Network error. Please check your connection.';
        } else {
            errorMessage += error.message || 'Something went wrong.';
        }
        
        return res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
};