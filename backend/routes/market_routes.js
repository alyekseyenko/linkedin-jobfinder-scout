const express = require('express');
const router = express.Router();
const marketService = require('../services/market_service');

/**
 * GET /api/market/recommendations
 * Returns real-time market intelligence and job positions recommended for the user's CV
 */
router.get('/recommendations', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const data = await marketService.generateMarketRecommendations(forceRefresh);
        res.json(data);
    } catch (err) {
        console.error('[MARKET ROUTE ERROR]', err);
        res.status(500).json({ error: 'Failed to generate market recommendations', details: err.message });
    }
});

/**
 * POST /api/market/refresh
 * Forces a fresh live AI scan of current market opportunities
 */
router.post('/refresh', async (req, res) => {
    try {
        const data = await marketService.generateMarketRecommendations(true);
        res.json(data);
    } catch (err) {
        console.error('[MARKET ROUTE REFRESH ERROR]', err);
        res.status(500).json({ error: 'Failed to refresh market recommendations', details: err.message });
    }
});

module.exports = router;
