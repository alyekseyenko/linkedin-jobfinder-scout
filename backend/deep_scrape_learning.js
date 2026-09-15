const axios = require('axios');
const cheerio = require('cheerio');
const { addInformation, initVectorEngine } = require('./vector_engine');

const PROJECT_URLS = process.env.PORTFOLIO_URLS ? process.env.PORTFOLIO_URLS.split(',') : [];

async function scrapeAndLearn() {
    console.log('🧠 Starting Deep Neural Scrape for Candidate Portfolio...');
    if (PROJECT_URLS.length === 0) {
        console.log('⚠️ No PORTFOLIO_URLS defined in environment variables. Skipping scrape.');
        process.exit(0);
    }
    await initVectorEngine();

    for (const url of PROJECT_URLS) {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) continue;
        try {
            console.log(`🌐 Scraping: ${trimmedUrl}...`);
            const response = await axios.get(trimmedUrl, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(response.data);
            
            // Remove junk
            $('script, style, nav, footer, iframe, noscript, .header, .footer').remove();
            
            const title = $('title').text() || $('h1').text();
            const content = $('body').text().replace(/\s+/g, ' ').trim();
            
            if (content.length > 100) {
                console.log(`✨ Learning from: ${title} (${content.length} chars)`);
                await addInformation(content, `Website: ${trimmedUrl}`);
            }
        } catch (err) {
            console.error(`❌ Failed to scrape ${trimmedUrl}:`, err.message);
        }
    }

    console.log('✅ Deep Neural Scrape Complete. AI knowledge updated.');
    process.exit(0);
}

scrapeAndLearn();
