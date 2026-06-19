const { test, expect, chromium } = require('@playwright/test');

test('Subcategory click hides inclusion mode', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('http://localhost:8000/index.html');

    await page.evaluate(() => {
        window.isAuthenticated = true;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        window.appData = {
            transactions: [],
            categories: [
                {id: "c1", name: "Alimentation", type: "expense", parentId: null},
                {id: "c2", name: "Restaurant", type: "expense", parentId: "c1"}
            ],
            subscriptions: [], tags: [], investments: [], mealVouchers: [], mealVoucherExpenses: [], monthlyGoals: {}, spendingGoal: 1000
        };
    });

    // Simulate clicking on the "Alimentation > Restaurant" bar in dashboard chart
    await page.evaluate(() => {
        window.showCategoryDetails("Alimentation > Restaurant", 110);
    });

    const isModeHidden = await page.evaluate(() => {
        return document.getElementById('data-modal-cat-mode-group').style.display === 'none';
    });

    if(!isModeHidden) throw new Error("Expected inclusion mode selector to be hidden for subcategories");

    // Click on main category
    await page.evaluate(() => {
        window.showCategoryDetails("Alimentation", 110);
    });

    const isModeVisible = await page.evaluate(() => {
        return document.getElementById('data-modal-cat-mode-group').style.display !== 'none';
    });

    if(!isModeVisible) throw new Error("Expected inclusion mode selector to be visible for main categories");

    await browser.close();
});
