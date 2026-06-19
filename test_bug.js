const { test, expect, chromium } = require('@playwright/test');

test('Category click keeps multi-month selection', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Serve files locally and bypass auth
    // (Needs http server running in background)
    await page.goto('http://localhost:8000/index.html');

    // We will evaluate a script to simulate the bug
    await page.evaluate(() => {
        window.isAuthenticated = true;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        window.appData = {
            transactions: [
                {id: "t1", amount: 50, type: "expense", categoryId: "c1", date: "2023-10-15"},
                {id: "t2", amount: 60, type: "expense", categoryId: "c1", date: "2023-09-15"},
                {id: "t3", amount: 70, type: "expense", categoryId: "c2", date: "2023-10-10"}
            ],
            categories: [
                {id: "c1", name: "Alimentation", type: "expense", parentId: null},
                {id: "c2", name: "Loisirs", type: "expense", parentId: null}
            ],
            subscriptions: [], tags: [], investments: [], mealVouchers: [], mealVoucherExpenses: [], monthlyGoals: {}, spendingGoal: 1000
        };
        document.getElementById('dash-filter-month').value = "2023-10";
        window.updateDashboard();
        // create the month options
        const select = document.getElementById('dashboard-category-month-selector');
        select.innerHTML = '';
        select.add(new Option('2023-10', '2023-10'));
        select.add(new Option('2023-09', '2023-09'));
    });

    // Select both months in dashboard-category-month-selector
    await page.evaluate(() => {
        const select = document.getElementById('dashboard-category-month-selector');
        Array.from(select.options).forEach(o => o.selected = true);
    });

    // Simulate clicking on the "Alimentation" bar in dashboard chart
    await page.evaluate(() => {
        window.showCategoryDetails("Alimentation", 110);
    });

    // Count how many items in the modal table
    const rowCount = await page.evaluate(() => {
        return document.querySelectorAll('#table-modal-transactions tbody tr').length;
    });

    console.log("Number of transactions shown in modal:", rowCount);
    if(rowCount !== 2) throw new Error("Expected 2 transactions, got " + rowCount);

    // Switch to all time
    await page.evaluate(() => {
        document.getElementById('data-modal-period').value = 'all_time';
        document.getElementById('data-modal-period').dispatchEvent(new Event('change'));
    });

    // It should still be 2, because we only have 2 for Alimentation
    const rowCountAllTime = await page.evaluate(() => {
        return document.querySelectorAll('#table-modal-transactions tbody tr').length;
    });
    if(rowCountAllTime !== 2) throw new Error("Expected 2 transactions, got " + rowCountAllTime);

    await browser.close();
});
