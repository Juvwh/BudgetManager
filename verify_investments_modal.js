
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:8000/index.html');
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
        window.isAuthenticated = true;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        window.appData = {
            transactions: [],
            subscriptions: [],
            categories: [],
            tags: [],
            investmentsEnabled: true,
            investments: [
                {
                    id: 'inv-1',
                    name: 'Assurance Vie Boursorama',
                    type: 'epargne',
                    acquisitionDate: '2022-01-01',
                    status: 'active',
                    valueHistory: [
                        { id: 'vh-1', date: '2022-01-01', value: 5000 },
                        { id: 'vh-2', date: '2023-01-01', value: 5200 },
                        { id: 'vh-3', date: '2024-01-01', value: 5500 }
                    ]
                }
            ],
            spendingGoal: 600,
            monthlyGoals: {}
        };

        // Add fake transactions to give them invested amount
        window.appData.transactions.push({
            id: 't-1', type: 'investment_transfer', amount: 5000, date: '2022-01-01', investmentId: 'inv-1'
        });

        window.updateNavigationVisibility();
        document.dispatchEvent(new CustomEvent('viewChanged', { detail: 'investments' }));
    });

    await page.waitForTimeout(1000);

    // Click on details
    await page.evaluate(() => {
        openInvestmentDetail('inv-1');
    });

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'investments_modal.png', fullPage: true });

    await browser.close();
})();
