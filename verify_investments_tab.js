
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
                },
                {
                    id: 'inv-2',
                    name: 'Bitcoin',
                    type: 'crypto',
                    acquisitionDate: '2021-05-10',
                    status: 'active',
                    valueHistory: [
                        { id: 'vh-4', date: '2021-05-10', value: 1000 }
                    ]
                },
                {
                    id: 'inv-3',
                    name: 'Livret A (Clos)',
                    type: 'epargne',
                    acquisitionDate: '2020-01-01',
                    status: 'closed',
                    valueHistory: [
                        { id: 'vh-5', date: '2020-01-01', value: 2000 },
                        { id: 'vh-6', date: '2021-01-01', value: 0 }
                    ]
                }
            ],
            spendingGoal: 600,
            monthlyGoals: {}
        };

        // Add fake transactions to give them invested amount
        window.appData.transactions.push({
            id: 't-1', type: 'investment_transfer', amount: 5000, date: '2022-01-01', investmentId: 'inv-1'
        }, {
            id: 't-2', type: 'investment_transfer', amount: 1000, date: '2021-05-10', investmentId: 'inv-2'
        }, {
            id: 't-3', type: 'investment_transfer', amount: 2000, date: '2020-01-01', investmentId: 'inv-3'
        }, {
            id: 't-4', type: 'investment_return', amount: 2000, date: '2021-01-01', investmentId: 'inv-3'
        });

        window.updateNavigationVisibility();
        document.dispatchEvent(new CustomEvent('viewChanged', { detail: 'investments' }));
    });

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'investments_tab.png', fullPage: true });

    await browser.close();
})();
