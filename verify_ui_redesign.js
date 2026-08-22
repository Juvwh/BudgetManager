// Vérification visuelle de la nouvelle interface (desktop + iPhone).
// Les données Firebase ne sont pas nécessaires : on injecte un jeu de test
// dans window.appData avant le chargement du module.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Petit serveur statique : les modules ES ne se chargent pas en file://
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
function startServer(port) {
    const server = http.createServer((req, res) => {
        const file = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
        fs.readFile(file, (err, data) => {
            if (err) { res.writeHead(404); res.end('not found'); return; }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
            res.end(data);
        });
    });
    return new Promise(resolve => server.listen(port, () => resolve(server)));
}

const SAMPLE = {
    spendingGoal: 900,
    monthlyGoals: {},
    tags: [{ id: 'tag-1', name: 'Voyage', color: '#e5484d' }],
    simulations: [],
    simulationBalance: 0,
    mealVoucherCredits: [],
    mealVoucherExpenses: [],
    mealVouchersEnabled: false,
    mealVoucherEligibleCategories: [],
    investments: [],
    investmentsEnabled: true,
    subscriptions: [
        { id: 's1', type: 'expense', name: 'Netflix', amount: 13.99, frequency: 'monthly', categoryId: 'cat-exp-4-2', startDate: '2025-01-05', nextDate: '2026-09-05', status: 'active' },
        { id: 's2', type: 'expense', name: 'Assurance auto', amount: 62.4, frequency: 'monthly', categoryId: 'cat-exp-2-1-2', startDate: '2025-01-12', nextDate: '2026-09-12', status: 'active' }
    ],
    categories: [
        { id: 'cat-inc-1', name: 'Salaire', type: 'income', parentId: null },
        { id: 'cat-inc-3', name: 'Ventes', type: 'income', parentId: null },
        { id: 'cat-exp-1', name: 'Logement', type: 'expense', parentId: null },
        { id: 'cat-exp-1-1', name: 'Loyer', type: 'expense', parentId: 'cat-exp-1' },
        { id: 'cat-exp-2', name: 'Transport', type: 'expense', parentId: null },
        { id: 'cat-exp-2-1', name: 'Voiture', type: 'expense', parentId: 'cat-exp-2' },
        { id: 'cat-exp-2-1-1', name: 'Essence', type: 'expense', parentId: 'cat-exp-2-1' },
        { id: 'cat-exp-2-1-2', name: 'Assurance', type: 'expense', parentId: 'cat-exp-2-1' },
        { id: 'cat-exp-3', name: 'Alimentation', type: 'expense', parentId: null },
        { id: 'cat-exp-3-1', name: 'Courses', type: 'expense', parentId: 'cat-exp-3' },
        { id: 'cat-exp-3-2', name: 'Restaurants', type: 'expense', parentId: 'cat-exp-3' },
        { id: 'cat-exp-4', name: 'Loisirs', type: 'expense', parentId: null },
        { id: 'cat-exp-4-2', name: 'Streaming', type: 'expense', parentId: 'cat-exp-4' }
    ]
};

function buildTransactions() {
    const now = new Date();
    const ym = (d) => d.toISOString().split('T')[0];
    const mk = (id, type, amount, day, categoryId, note) => {
        const d = new Date(now.getFullYear(), now.getMonth(), day);
        return { id, type, amount, date: ym(d), categoryId, note, tagIds: [] };
    };
    const prev = (id, type, amount, day, categoryId, note) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, day);
        return { id, type, amount, date: ym(d), categoryId, note, tagIds: [] };
    };
    return [
        mk('t1', 'salary', 2400, 1, 'cat-inc-1', 'Salaire'),
        mk('t2', 'expense', 780, 3, 'cat-exp-1-1', 'Loyer'),
        mk('t3', 'expense', 62.35, 5, 'cat-exp-3-1', 'Courses Delhaize'),
        mk('t4', 'expense', 48.9, 8, 'cat-exp-2-1-1', 'Plein essence'),
        mk('t5', 'expense', 13.99, 9, 'cat-exp-4-2', 'Netflix'),
        mk('t6', 'income', 120, 11, 'cat-inc-3', 'Vente Vinted'),
        mk('t7', 'expense', 34.5, 12, 'cat-exp-3-2', 'Restaurant'),
        prev('t8', 'salary', 2400, 1, 'cat-inc-1', 'Salaire'),
        prev('t9', 'expense', 780, 3, 'cat-exp-1-1', 'Loyer'),
        prev('t10', 'expense', 210, 14, 'cat-exp-3-1', 'Courses')
    ];
}

(async () => {
    const server = await startServer(8777);
    const browser = await chromium.launch();
    const url = 'http://localhost:8777/index.html';

    const seed = (data) => {
        window.appData = Object.assign({}, data.sample, { transactions: data.transactions });
    };

    async function shoot(name, width, height, targets) {
        const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await page.addInitScript(seed, { sample: SAMPLE, transactions: buildTransactions() });
        await page.goto(url);
        await page.waitForTimeout(2500);

        // On contourne l'écran de connexion (données locales de test)
        await page.evaluate(() => {
            document.getElementById('login-overlay').classList.remove('active');
            document.getElementById('app-content').style.display = 'block';
            if (typeof window.updateNavigationVisibility === 'function') window.updateNavigationVisibility();
            document.querySelector('.nav-link[data-target="dashboard"]').click();
        });
        await page.waitForTimeout(800);

        for (const t of targets) {
            if (t !== 'dashboard') {
                await page.evaluate((id) => document.querySelector('.nav-link[data-target="' + id + '"]').click(), t);
                await page.waitForTimeout(600);
            }
            await page.screenshot({ path: `ui_${name}_${t}.png`, fullPage: true });
        }

        console.log(`[${name}] erreurs JS :`, errors.length ? errors : 'aucune');
        await ctx.close();
    }

    await shoot('desktop', 1440, 900, ['dashboard', 'transactions', 'subscriptions', 'charts', 'savings', 'categories', 'settings']);
    await shoot('mobile', 390, 844, ['dashboard', 'transactions', 'charts', 'settings']);

    await browser.close();
    server.close();
})();
