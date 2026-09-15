const axios = require('axios');
const cheerio = require('cheerio');
const { addInformation, initVectorEngine } = require('./vector_engine');

const FAILED_URLS = process.env.PORTFOLIO_URLS ? process.env.PORTFOLIO_URLS.split(',') : [];

async function retryScrape() {
    console.log('🔄 Starting Memory Recovery (Retry) for portfolio links...');
    if (FAILED_URLS.length === 0) {
        console.log('⚠️ No PORTFOLIO_URLS defined in environment variables.');
        process.exit(0);
    }
    await initVectorEngine();

    for (const url of FAILED_URLS) {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) continue;
        try {
            console.log(`🌐 Retrying (60s timeout): ${trimmedUrl}...`);
            const response = await axios.get(trimmedUrl, { 
                timeout: 60000, 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } 
            });
            const $ = cheerio.load(response.data);
            
            $('script, style, nav, footer, iframe, noscript').remove();
            
            const title = $('title').text() || $('h1').text();
            const content = $('body').text().replace(/\s+/g, ' ').trim();
            
            if (content.length > 100) {
                console.log(`✨ Successfully recovered: ${title}`);
                await addInformation(content, `Website Recovery: ${trimmedUrl}`);
            }
        } catch (err) {
            console.error(`❌ Still failed ${trimmedUrl}:`, err.message);
        }
    }

    console.log('✅ Memory Recovery Complete.');
    process.exit(0);
}

retryScrape();
