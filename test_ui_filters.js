const { test, expect, chromium } = require('@playwright/test');

test('Test comprehensive filters for category modal', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('http://localhost:8000/index.html');

    await page.evaluate(() => {
        window.isAuthenticated = true;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        window.appData = {
            transactions: [
                {id: "t1", amount: 50, type: "expense", categoryId: "c1", date: "2023-10-15"},
                {id: "t2", amount: 60, type: "expense", categoryId: "c1", date: "2023-09-15"},
                {id: "t3", amount: 70, type: "expense", categoryId: "c2", date: "2023-10-10"},
                {id: "t4", amount: 80, type: "expense", categoryId: "c3", date: "2023-10-10"}
            ],
            categories: [
                {id: "c1", name: "Alimentation", type: "expense", parentId: null},
                {id: "c2", name: "Restaurant", type: "expense", parentId: "c1"},
                {id: "c3", name: "Loisirs", type: "expense", parentId: null}
            ],
            subscriptions: [], tags: [], investments: [], mealVouchers: [], mealVoucherExpenses: [], monthlyGoals: {}, spendingGoal: 1000
        };

        // Mock date so "last_month" and "last_year" are deterministic
        // Let's pretend today is 2023-11-15
    });

    // We can test 'with_subcategories' vs 'category_only' directly
    await page.evaluate(() => {
        window.showCategoryDetails("Alimentation", 110);
    });

    let rowCount = await page.evaluate(() => {
        return document.querySelectorAll('#table-modal-transactions tbody tr').length;
    });
    // With 'inherited' period (dashboard default to current month 2023-10 ? we need to check what showCategoryDetails defaulted to)
    // Actually default is current real date. To avoid flaky tests, we'll switch to 'all_time' immediately

    await page.evaluate(() => {
        document.getElementById('data-modal-period').value = 'all_time';
        document.getElementById('data-modal-period').dispatchEvent(new Event('change'));
    });

    // Now it should show all Alimentation AND Restaurant (t1, t2, t3) = 3 items
    rowCount = await page.evaluate(() => {
        return document.querySelectorAll('#table-modal-transactions tbody tr').length;
    });
    if(rowCount !== 3) throw new Error("Expected 3 transactions for with_subcategories, got " + rowCount);

    // Switch to category_only
    await page.evaluate(() => {
        document.getElementById('data-modal-cat-mode').value = 'category_only';
        document.getElementById('data-modal-cat-mode').dispatchEvent(new Event('change'));
    });

    // Now it should show only Alimentation (t1, t2) = 2 items
    rowCount = await page.evaluate(() => {
        return document.querySelectorAll('#table-modal-transactions tbody tr').length;
    });
    if(rowCount !== 2) throw new Error("Expected 2 transactions for category_only, got " + rowCount);

    await browser.close();
});

test('Test custom date range', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('http://localhost:8000/index.html');

    await page.evaluate(() => {
        window.isAuthenticated = true;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        window.appData = {
            transactions: [
                {id: "t1", amount: 50, type: "expense", categoryId: "c1", date: "2023-10-15"},
                {id: "t2", amount: 60, type: "expense", categoryId: "c1", date: "2023-09-15"},
                {id: "t3", amount: 70, type: "expense", categoryId: "c2", date: "2023-10-10"},
                {id: "t4", amount: 80, type: "expense", categoryId: "c3", date: "2023-10-10"}
            ],
            categories: [
                {id: "c1", name: "Alimentation", type: "expense", parentId: null},
                {id: "c2", name: "Restaurant", type: "expense", parentId: "c1"},
                {id: "c3", name: "Loisirs", type: "expense", parentId: null}
            ],
            subscriptions: [], tags: [], investments: [], mealVouchers: [], mealVoucherExpenses: [], monthlyGoals: {}, spendingGoal: 1000
        };
    });

    await page.evaluate(() => {
        window.showCategoryDetails("Alimentation", 110);
        document.getElementById('data-modal-period').value = 'custom';
        document.getElementById('data-modal-period').dispatchEvent(new Event('change'));

        document.getElementById('data-modal-date-start').value = '2023-09-01';
        document.getElementById('data-modal-date-start').dispatchEvent(new Event('change'));

        document.getElementById('data-modal-date-end').value = '2023-09-30';
        document.getElementById('data-modal-date-end').dispatchEvent(new Event('change'));
    });

    // We should only see t2 (2023-09-15) which is 1 item.
    let rowCount = await page.evaluate(() => {
        return document.querySelectorAll('#table-modal-transactions tbody tr').length;
    });
    if(rowCount !== 1) throw new Error("Expected 1 transactions for custom range, got " + rowCount);

    await browser.close();
});
