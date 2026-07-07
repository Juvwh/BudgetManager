import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000/index.html")
    page.wait_for_timeout(2000)

    # Bypass login
    page.evaluate("""() => {
        window.isAuthenticated = true;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        window.appData = {
            transactions: [
                { id: '1', date: '2023-10-15', type: 'income', amount: 2000, categoryId: 'cat1' },
                { id: '2', date: '2023-10-16', type: 'expense', amount: 500, categoryId: 'cat2', mealVoucherPart: 50 },
                { id: '3', date: `${y}-${m}-01`, type: 'income', amount: 3000, categoryId: 'cat1' },
                { id: '4', date: `${y}-${m}-02`, type: 'expense', amount: 1000, categoryId: 'cat2', mealVoucherPart: 100 }
            ],
            subscriptions: [],
            tags: [],
            categories: [
                { id: 'cat1', name: 'Salaire', type: 'income' },
                { id: 'cat2', name: 'Loyer', type: 'expense' }
            ],
            spendingGoal: 1000,
            mealVouchersEnabled: true
        };
    }""")
    page.wait_for_timeout(500)

    # Re-render or just click a navigation link
    page.evaluate("document.querySelector('[data-target=\"savings\"]').click()")
    page.wait_for_timeout(1000)

    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    page.screenshot(path="/home/jules/verification/screenshots/verification2.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
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
