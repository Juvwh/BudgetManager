const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
        colorScheme: 'light'
    });
    const page = await context.newPage();

    await page.goto('http://localhost:8000/index.html');
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
        window.isAuthenticated = true;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        window.appData = {
            transactions: [
                {
                    id: '1',
                    type: 'expense',
                    amount: 50.00,
                    mealVoucherPart: 15.65,
                    date: '2023-10-25',
                    categoryId: 'cat-exp-3-2',
                    note: 'Restaurant midi long note to see wrapping',
                    tagIds: []
                },
                {
                    id: '2',
                    type: 'expense',
                    amount: 25.00,
                    mealVoucherPart: 0,
                    date: '2023-10-24',
                    categoryId: 'cat-exp-3-1',
                    note: '',
                    tagIds: []
                }
            ],
            subscriptions: [],
            tags: [],
            categories: [
                { id: 'cat-exp-3', name: 'Alimentation', type: 'expense', parentId: null },
                { id: 'cat-exp-3-1', name: 'Courses', type: 'expense', parentId: 'cat-exp-3' },
                { id: 'cat-exp-3-2', name: 'Restaurants', type: 'expense', parentId: 'cat-exp-3' }
            ],
            mealVouchersEnabled: true,
            mealVoucherEligibleCategories: ['cat-exp-3-1', 'cat-exp-3-2'],
            mealVoucherCredits: [
                { id: '1', amount: 100, date: '2023-01-01', expiryDate: '2024-01-01' }
            ]
        };
        window.renderTransactions();
        window.renderMealVouchers();
        document.querySelector('a[data-target="transactions"]').click();
    });

    await page.waitForTimeout(500);

    await page.evaluate(() => {
        document.querySelector('a[data-target="meal-vouchers"]').click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'meal_vouchers_transactions_mobile.png' });

    await browser.close();
})();
