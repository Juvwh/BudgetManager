const { test, expect, chromium } = require('@playwright/test');

test('Rolling 30 and 365 days filters', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('http://localhost:8000/index.html');

    await page.evaluate(() => {
        window.isAuthenticated = true;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';

        const now = new Date();
        const date15DaysAgo = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        const date40DaysAgo = new Date(now.getTime() - (40 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        const date200DaysAgo = new Date(now.getTime() - (200 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        const date400DaysAgo = new Date(now.getTime() - (400 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

        window.appData = {
            transactions: [
                {id: "t1", amount: 10, type: "expense", categoryId: "c1", date: date15DaysAgo},   // Within 30 days
                {id: "t2", amount: 20, type: "expense", categoryId: "c1", date: date40DaysAgo},   // Within 365, outside 30
                {id: "t3", amount: 30, type: "expense", categoryId: "c1", date: date200DaysAgo},  // Within 365, outside 30
                {id: "t4", amount: 40, type: "expense", categoryId: "c1", date: date400DaysAgo}   // Outside 365
            ],
            categories: [
                {id: "c1", name: "Rolling", type: "expense", parentId: null}
            ],
            subscriptions: [], tags: [], investments: [], mealVouchers: [], mealVoucherExpenses: [], monthlyGoals: {}, spendingGoal: 1000
        };
        document.getElementById('dash-filter-month').value = now.toISOString().substring(0, 7);
    });

    await page.evaluate(() => {
        window.showCategoryDetails("Rolling", 100);
        document.getElementById('data-modal-period').value = 'last_month';
        document.getElementById('data-modal-period').dispatchEvent(new Event('change'));
    });

    // Check 30 days -> should show only t1 (1 item)
    let rowCount30 = await page.evaluate(() => {
        return document.querySelectorAll('#table-modal-transactions tbody tr').length;
    });
    if(rowCount30 !== 1) throw new Error("Expected 1 transaction for 30 days, got " + rowCount30);

    // Switch to 365 days
    await page.evaluate(() => {
        document.getElementById('data-modal-period').value = 'last_year';
        document.getElementById('data-modal-period').dispatchEvent(new Event('change'));
    });

    // Check 365 days -> should show t1, t2, t3 (3 items)
    let rowCount365 = await page.evaluate(() => {
        return document.querySelectorAll('#table-modal-transactions tbody tr').length;
    });
    if(rowCount365 !== 3) throw new Error("Expected 3 transactions for 365 days, got " + rowCount365);

    await browser.close();
});
