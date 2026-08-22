// Vérifie les graphiques (netteté, portefeuille, patrimoine), la nouvelle
// liste de transactions et l'absence de défilement horizontal sur mobile.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
function startServer(port) {
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(req.url.split('?')[0]);
        const file = path.join(__dirname, rel === '/' ? 'index.html' : rel);
        fs.readFile(file, (err, data) => {
            if (err) { res.writeHead(404); res.end('not found'); return; }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
            res.end(data);
        });
    });
    return new Promise(resolve => server.listen(port, () => resolve(server)));
}

const SEED = () => {
    const now = new Date();
    const d = (monthOffset, day) => new Date(now.getFullYear(), now.getMonth() + monthOffset, day)
        .toISOString().split('T')[0];
    window.appData = {
        spendingGoal: 900, monthlyGoals: {},
        transactions: [
            { id: 't1', type: 'salary', amount: 2400, savedAmount: 300, date: d(0, 2), categoryId: 'cat-inc-1', note: 'Salaire', tagIds: [] },
            { id: 't2', type: 'expense', amount: 780, date: d(0, 3), categoryId: 'cat-exp-1-1', note: 'Loyer', tagIds: ['tag-1'] },
            { id: 't3', type: 'expense', amount: 62.35, date: d(0, 5), categoryId: 'cat-exp-3-1', note: 'Courses', tagIds: [] },
            { id: 't4', type: 'expense', amount: 120, date: d(0, 5), categoryId: 'cat-exp-3-2', note: 'Resto', tagIds: [] },
            { id: 't5', type: 'income', amount: 40, date: d(0, 6), categoryId: 'cat-inc-3', note: 'Remboursement resto', tagIds: [], linkedExpenseId: 't4' },
            { id: 't6', type: 'salary', amount: 2400, savedAmount: 300, date: d(-1, 2), categoryId: 'cat-inc-1', note: 'Salaire', tagIds: [] },
            { id: 't7', type: 'expense', amount: 810, date: d(-1, 3), categoryId: 'cat-exp-1-1', note: 'Loyer', tagIds: [] },
            { id: 't8', type: 'investment_transfer', amount: 500, date: d(-1, 10), categoryId: 'cat-exp-1', note: 'Achat or', tagIds: [], investmentId: 'inv-1' }
        ],
        subscriptions: [], tags: [{ id: 'tag-1', name: 'Maison', color: '#0a6cff' }],
        simulations: [], investmentsEnabled: true,
        investments: [{
            id: 'inv-1', name: 'Or physique', type: 'metaux', acquisitionDate: d(-3, 1), status: 'active',
            valueHistory: [
                { id: 'v1', date: d(-3, 1), value: 500 },
                { id: 'v2', date: d(-2, 1), value: 540 },
                { id: 'v3', date: d(-1, 1), value: 520 },
                { id: 'v4', date: d(0, 1), value: 610 }
            ]
        }],
        mealVoucherCredits: [], mealVoucherExpenses: [], mealVouchersEnabled: false,
        categories: [
            { id: 'cat-inc-1', name: 'Salaire', type: 'income', parentId: null },
            { id: 'cat-inc-3', name: 'Ventes', type: 'income', parentId: null },
            { id: 'cat-exp-1', name: 'Logement', type: 'expense', parentId: null },
            { id: 'cat-exp-1-1', name: 'Loyer', type: 'expense', parentId: 'cat-exp-1' },
            { id: 'cat-exp-3', name: 'Alimentation', type: 'expense', parentId: null },
            { id: 'cat-exp-3-1', name: 'Courses', type: 'expense', parentId: 'cat-exp-3' },
            { id: 'cat-exp-3-2', name: 'Restaurants', type: 'expense', parentId: 'cat-exp-3' }
        ]
    };
};

// Compte les pixels non transparents : un canvas vide en contient très peu
const inkOf = (id) => {
    const c = document.getElementById(id);
    if (!c || !c.width) return -1;
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 8) n++;
    return n;
};

(async () => {
    const server = await startServer(8781);
    const browser = await chromium.launch();
    const results = [];
    const check = (name, ok, extra) => results.push(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${extra !== undefined ? ' → ' + extra : ''}`);
    const errors = [];

    // ---------- Desktop ----------
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(SEED);
    await page.goto('http://localhost:8781/index.html');
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        document.querySelector('.nav-link[data-target="categories"]').click();
        document.querySelector('.nav-link[data-target="dashboard"]').click();
    });
    await page.waitForTimeout(800);

    // Netteté : la résolution interne doit dépasser la largeur CSS (deviceScaleFactor 2)
    const crisp = await page.evaluate(() => {
        const c = document.getElementById('dashboardBarChartCategory');
        return { internal: c.width, css: Math.round(c.getBoundingClientRect().width) };
    });
    check('graphique en haute résolution (Retina)', crisp.internal >= crisp.css * 1.9, `${crisp.internal}px pour ${crisp.css}px CSS`);

    const patrimonyInk = await page.evaluate(inkOf, 'dashPatrimonyChart');
    check('courbe du patrimoine dessinée', patrimonyInk > 2000, patrimonyInk + ' pixels');

    const patrimonyLabel = await page.textContent('#dash-patrimony-total');
    check('total du patrimoine affiché', /\d/.test(patrimonyLabel), patrimonyLabel);

    // Légende de l'objectif
    const goal = await page.evaluate(() => ({
        target: document.getElementById('goal-value-target').textContent,
        spent: document.getElementById('goal-value-spent').textContent,
        left: document.getElementById('goal-value-left').textContent
    }));
    check('légende Objectif / Dépense / Reste renseignée',
        goal.target.includes('900') && /\d/.test(goal.spent) && /\d|—/.test(goal.left),
        JSON.stringify(goal));

    // Onglet Analyse : camembert + histogramme
    await page.click('.nav-link[data-target="charts"]');
    await page.waitForTimeout(700);
    const pieInk = await page.evaluate(inkOf, 'pieChartCategory');
    const barInk = await page.evaluate(inkOf, 'barChartEvolution');
    const horizInk = await page.evaluate(inkOf, 'horizontalBarChartCategory');
    check('camembert dessiné', pieInk > 5000, pieInk + ' pixels');
    check('histogramme dessiné', barInk > 3000, barInk + ' pixels');
    check('barres par catégorie dessinées', horizInk > 3000, horizInk + ' pixels');
    await page.screenshot({ path: 'ui_desktop_charts.png', fullPage: true });

    // Onglet Investissements : évolution du portefeuille
    await page.click('.nav-link[data-target="investments"]');
    await page.waitForTimeout(700);
    const portfolioInk = await page.evaluate(inkOf, 'portfolioChart');
    check('évolution du portefeuille dessinée', portfolioInk > 2000, portfolioInk + ' pixels');
    await page.screenshot({ path: 'ui_desktop_investments.png', fullPage: true });

    // Liste des transactions
    await page.click('.nav-link[data-target="transactions"]');
    await page.waitForTimeout(600);
    const list = await page.evaluate(() => ({
        rows: document.querySelectorAll('#transactions-list .txn-row').length,
        days: document.querySelectorAll('#transactions-list .txn-day').length,
        count: document.getElementById('transactions-count').textContent,
        refundInfo: document.body.innerHTML.includes('reste à charge')
    }));
    check('liste groupée par jour', list.rows === 8 && list.days >= 5, `${list.rows} lignes / ${list.days} jours`);
    check('compteur de transactions', /transactions/.test(list.count), list.count);
    check('reste à charge affiché sur la dépense remboursée', list.refundInfo);

    // Mode sélection
    await page.click('#btn-toggle-transaction-selection');
    await page.waitForTimeout(300);
    await page.click('#transactions-list .transaction-checkbox');
    await page.waitForTimeout(300);
    const selTotal = await page.textContent('#transaction-selection-total');
    check('mode sélection fonctionnel', parseFloat(selTotal) !== 0, selTotal + ' €');
    await page.click('#btn-toggle-transaction-selection');

    // Options avancées : ouverture automatique pour un salaire
    await page.selectOption('#trans-type', 'salary');
    await page.waitForTimeout(300);
    const advOpen = await page.evaluate(() => document.getElementById('trans-advanced').open
        && document.getElementById('trans-savings-group').style.display !== 'none');
    check('options avancées ouvertes automatiquement (salaire)', advOpen);
    await page.selectOption('#trans-type', 'expense');
    await page.screenshot({ path: 'ui_desktop_transactions.png', fullPage: true });

    await ctx.close();

    // ---------- Mobile : aucun défilement horizontal ----------
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const mpage = await mctx.newPage();
    mpage.on('pageerror', e => errors.push('mobile: ' + String(e)));
    await mpage.addInitScript(SEED);
    await mpage.goto('http://localhost:8781/index.html');
    await mpage.waitForTimeout(2500);
    await mpage.evaluate(() => {
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        document.querySelector('.nav-link[data-target="categories"]').click();
        document.querySelector('.nav-link[data-target="dashboard"]').click();
    });
    await mpage.waitForTimeout(600);

    for (const tab of ['dashboard', 'transactions', 'subscriptions', 'charts', 'savings', 'investments', 'settings', 'categories']) {
        await mpage.evaluate((id) => document.querySelector('.nav-link[data-target="' + id + '"]').click(), tab);
        await mpage.waitForTimeout(500);
        const over = await mpage.evaluate(() => {
            const page = document.documentElement.scrollWidth - document.documentElement.clientWidth;
            let widest = null;
            document.querySelectorAll('#app-content *').forEach(el => {
                // overflow hidden = texte tronque volontairement, pas un debordement
                if (getComputedStyle(el).overflowX === 'hidden') return;
                if (el.scrollWidth - el.clientWidth > 2 && el.clientWidth > 0) {
                    widest = el.tagName + '.' + (el.className || '').toString().split(' ')[0];
                }
            });
            return { page, widest };
        });
        check('mobile ' + tab + ' : pas de défilement horizontal', over.page <= 1 && !over.widest,
            'page ' + over.page + 'px' + (over.widest ? ', élément ' + over.widest : ''));
        if (tab === 'dashboard' || tab === 'transactions') {
            await mpage.screenshot({ path: 'ui_mobile_' + tab + '.png', fullPage: true });
        }
    }

    // Les indicateurs doivent précéder la saisie rapide
    await mpage.evaluate(() => document.querySelector('.nav-link[data-target="dashboard"]').click());
    await mpage.waitForTimeout(400);
    const orderOk = await mpage.evaluate(() => {
        const kpi = document.querySelector('.summary-cards').getBoundingClientRect().top;
        const quick = document.querySelector('.quick-add').getBoundingClientRect().top;
        return kpi < quick;
    });
    check('mobile : indicateurs affichés avant la saisie rapide', orderOk);

    await mctx.close();
    await browser.close();
    server.close();

    console.log(results.join('\n'));
    console.log('\nErreurs JS :', errors.length ? errors : 'aucune');
})();
