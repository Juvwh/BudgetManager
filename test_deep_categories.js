const { test, expect, chromium } = require('@playwright/test');

test('Deep subcategory inclusion mode', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('http://localhost:8000/index.html');

    await page.evaluate(() => {
        window.isAuthenticated = true;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        window.appData = {
            transactions: [
                {id: "t1", amount: 10, type: "expense", categoryId: "c1", date: "2023-10-15"}, // A
                {id: "t2", amount: 20, type: "expense", categoryId: "c2", date: "2023-10-15"}, // A > B
                {id: "t3", amount: 30, type: "expense", categoryId: "c3", date: "2023-10-10"}  // A > B > C
            ],
            categories: [
                {id: "c1", name: "A", type: "expense", parentId: null},
                {id: "c2", name: "B", type: "expense", parentId: "c1"},
                {id: "c3", name: "C", type: "expense", parentId: "c2"}
            ],
            subscriptions: [], tags: [], investments: [], mealVouchers: [], mealVoucherExpenses: [], monthlyGoals: {}, spendingGoal: 1000
        };
        // Reset mode
        document.getElementById('dash-filter-month').value = "2023-10";
    });

    // 1. Click on C (leaf category, no children) -> shouldn't show inclusion mode
    await page.evaluate(() => {
        window.showCategoryDetails("A > B > C", 30);
    });

    let isModeHidden = await page.evaluate(() => {
        return document.getElementById('data-modal-cat-mode-group').style.display === 'none';
    });
    if(!isModeHidden) throw new Error("Expected inclusion mode selector to be hidden for leaf C");

    // 2. Click on B (mid category, has child C) -> should show inclusion mode
    await page.evaluate(() => {
        window.showCategoryDetails("A > B", 50);
        // Switch to all time to avoid time flakiness
        document.getElementById('data-modal-period').value = 'all_time';
        document.getElementById('data-modal-period').dispatchEvent(new Event('change'));
    });

    let isModeVisible = await page.evaluate(() => {
        return document.getElementById('data-modal-cat-mode-group').style.display !== 'none';
    });
    if(!isModeVisible) throw new Error("Expected inclusion mode selector to be visible for mid category B");

    // By default, it's 'with_subcategories', so it should show t2(B) and t3(C) = 2 rows
    let rowCount = await page.evaluate(() => {
        return document.querySelectorAll('#table-modal-transactions tbody tr').length;
    });
    if(rowCount !== 2) throw new Error("Expected 2 transactions (B and C) for 'with_subcategories' on B, got " + rowCount);

    // Switch B to 'category_only' -> should show t2(B) = 1 row
    await page.evaluate(() => {
        document.getElementById('data-modal-cat-mode').value = 'category_only';
        document.getElementById('data-modal-cat-mode').dispatchEvent(new Event('change'));
    });

    rowCount = await page.evaluate(() => {
        return document.querySelectorAll('#table-modal-transactions tbody tr').length;
    });
    if(rowCount !== 1) throw new Error("Expected 1 transactions (B only) for 'category_only' on B, got " + rowCount);

    await browser.close();
});
