from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000/index.html")
    page.wait_for_timeout(500)

    # Bypass login
    page.evaluate("window.isAuthenticated = true; document.getElementById('login-overlay').classList.remove('active'); document.getElementById('app-content').style.display = 'block';")
    page.wait_for_timeout(500)

    # Initialize data if necessary to prevent crashes
    page.evaluate('''
        if (!window.appData.transactions) window.appData.transactions = [];
        if (!window.appData.subscriptions) window.appData.subscriptions = [];
        window.renderTransactions();
        window.updateCategorySelects();
    ''')
    page.wait_for_timeout(500)

    # Use the desktop view so tabs are visible instead of mobile bar
    page.set_viewport_size({"width": 1200, "height": 800})

    # Go to transactions
    page.locator("#sidebar a[data-target='transactions']").click()
    page.wait_for_timeout(500)

    # Add a transaction to test category wrapping and column widths
    page.locator("#trans-category").select_option(value="cat-exp-1-1") # Select via value instead of label
    page.locator("#trans-amount").fill("500")
    page.locator("#trans-note").fill("Loyer du mois de Novembre très très long pour tester le retour à la ligne de la colonne note du tableau des transactions qui devrait être d'au moins 200px")
    page.locator("#btn-submit-trans").click()
    page.wait_for_timeout(500)

    # Take screenshot of transactions table (desktop view to see table structure clearly)
    page.screenshot(path="/home/jules/verification/screenshots/transactions.png")
    page.wait_for_timeout(1000)

    # Go to subscriptions
    page.locator("#sidebar a[data-target='subscriptions']").click()
    page.wait_for_timeout(500)

    # Add an installments subscription
    page.locator("#sub-name").fill("Nouvel Ordinateur")
    page.locator("#sub-frequency").select_option(value="installments")
    page.wait_for_timeout(500)

    page.locator("#sub-total-amount").fill("1200")
    page.locator("#sub-installments-count").fill("4")
    page.locator("#sub-start-date").fill("2024-01-01")
    page.locator("#sub-end-date").fill("2024-06-01")
    page.locator("#btn-submit-sub").click()
    page.wait_for_timeout(500)

    # Add a completed subscription to test styling
    page.evaluate('''
        window.appData.subscriptions.push({
            id: 'sub-test-completed',
            type: 'expense',
            name: 'Ancien Abo',
            amount: 10,
            categoryId: 'cat-exp-4',
            frequency: 'monthly',
            startDate: '2023-01-01',
            endDate: '2023-06-01',
            status: 'completed'
        });
        window.renderSubscriptions();
    ''')
    page.wait_for_timeout(500)

    # Take screenshot of subscriptions table
    page.screenshot(path="/home/jules/verification/screenshots/subscriptions.png")
    page.wait_for_timeout(1000)

    # Go back to transactions to see generated ones
    page.locator("#sidebar a[data-target='transactions']").click()
    page.wait_for_timeout(500)

    # Take final screenshot showing auto-generated transactions with "(Mois X/Y)"
    page.screenshot(path="/home/jules/verification/screenshots/generated_transactions.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    import os
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()