const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to the local server
    await page.goto('http://localhost:8000/index.html');

    // Wait for the page to load
    await page.waitForTimeout(1000);

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
    });

    // Take screenshot before adding a transaction
    await page.screenshot({ path: 'before_overbudget.png', fullPage: true });

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
        // Force UI update
        window.updateDashboard();
    });

    // Wait for UI to update and animation to complete
    await page.waitForTimeout(1000);

    // Take screenshot after making it overbudget
    await page.screenshot({ path: 'after_overbudget_620.png', fullPage: true });

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
        // Force UI update
        window.updateDashboard();
    });

    // Wait for UI to update and animation to complete
    await page.waitForTimeout(1000);

    // Take screenshot after making it overbudget 900 (should be at 75% visual width in 1200 scale)
    await page.screenshot({ path: 'after_overbudget_900.png', fullPage: true });


    await browser.close();
})();
