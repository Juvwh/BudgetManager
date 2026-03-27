const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    // Ensure output directories exist
    const videoDir = '/home/jules/verification/videos';
    const screenshotDir = '/home/jules/verification/screenshots';
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        recordVideo: {
            dir: videoDir,
            size: { width: 1280, height: 720 }
        }
    });
    const page = await context.newPage();

    // Navigate to the local server
    await page.goto('http://localhost:8000/index.html');
    await page.waitForTimeout(500);

    // Bypass login and initialize empty data
    await page.evaluate(() => {
        window.isAuthenticated = true;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        window.appData = {
            transactions: [],
            subscriptions: [],
            categories: [],
            tags: [],
            spendingGoal: 600, // Set goal to 600
            monthlyGoals: {}
        };
        window.updateDashboard();
    });
    await page.waitForTimeout(1000);

    // Inject an expense to make it overbudget (e.g. 620.06€)
    await page.evaluate(() => {
        const now = new Date();
        window.appData.transactions.push({
            id: Date.now().toString(),
            type: 'expense',
            amount: 620.06,
            date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
            category: 'general',
            note: 'Test overbudget',
            tags: []
        });
        window.updateDashboard();
    });

    await page.waitForTimeout(1000);

    // Inject another expense to make it more overbudget (e.g. 900€ total)
    await page.evaluate(() => {
        const now = new Date();
        window.appData.transactions.push({
            id: (Date.now()+1).toString(),
            type: 'expense',
            amount: 279.94, // 620.06 + 279.94 = 900
            date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
            category: 'general',
            note: 'Test overbudget 2',
            tags: []
        });
        window.updateDashboard();
    });

    await page.waitForTimeout(1000);

    // Inject another expense to make it 1300€ total (Scale should jump to 1800)
    await page.evaluate(() => {
        const now = new Date();
        window.appData.transactions.push({
            id: (Date.now()+2).toString(),
            type: 'expense',
            amount: 400.00, // 900 + 400 = 1300
            date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
            category: 'general',
            note: 'Test overbudget 3',
            tags: []
        });
        window.updateDashboard();
    });

    await page.waitForTimeout(1500);

    // Take final screenshot
    const screenshotPath = path.join(screenshotDir, 'final_verification.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Important: Close context to save the video file
    await context.close();
    await browser.close();

    console.log(`Verification complete. Screenshot saved to ${screenshotPath}`);
})();
