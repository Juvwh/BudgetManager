// Tests fonctionnels de la nouvelle interface : saisie rapide, sous-onglets,
// volet mobile et thème sombre.
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
    window.appData = {
        spendingGoal: 900, monthlyGoals: {}, transactions: [], subscriptions: [], tags: [],
        simulations: [], investments: [], investmentsEnabled: true,
        mealVoucherCredits: [], mealVoucherExpenses: [], mealVouchersEnabled: false,
        categories: [
            { id: 'cat-inc-1', name: 'Salaire', type: 'income', parentId: null },
            { id: 'cat-exp-3', name: 'Alimentation', type: 'expense', parentId: null },
            { id: 'cat-exp-3-1', name: 'Courses', type: 'expense', parentId: 'cat-exp-3' }
        ]
    };
};

(async () => {
    const server = await startServer(8778);
    const browser = await chromium.launch();
    const results = [];
    const check = (name, ok, extra) => { results.push(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${extra ? ' → ' + extra : ''}`); };

    // ---------- Desktop ----------
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(SEED);
    await page.goto('http://localhost:8778/index.html');
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        // hors connexion : passer par l'onglet Catégories initialise les listes déroulantes
        document.querySelector('.nav-link[data-target="categories"]').click();
        document.querySelector('.nav-link[data-target="dashboard"]').click();
    });
    await page.waitForTimeout(500);

    // 1. Saisie rapide d'une dépense
    await page.fill('#qa-amount', '42.50');
    await page.selectOption('#qa-category', { label: 'Alimentation > Courses' }).catch(async () => {
        const v = await page.evaluate(() => document.querySelectorAll('#qa-category option')[1].value);
        await page.selectOption('#qa-category', v);
    });
    await page.fill('#qa-note', 'Test saisie rapide');
    await page.click('#form-quick-add button[type="submit"]');
    await page.waitForTimeout(600);

    const added = await page.evaluate(() => window.appData.transactions.map(t => ({ type: t.type, amount: t.amount, note: t.note })));
    check('saisie rapide → transaction créée', added.length === 1 && added[0].amount === 42.5 && added[0].type === 'expense', JSON.stringify(added));

    const feedCount = await page.locator('#dash-recent-list .feed-item').count();
    check('la transaction apparaît dans "Dernières transactions"', feedCount === 1);

    const dashExpense = await page.textContent('#dash-expense');
    check('les indicateurs se mettent à jour', dashExpense.includes('42.50'), dashExpense);

    // 2. Saisie rapide d'un revenu (bascule de type)
    await page.click('#qa-type-group .seg-btn[data-type="income"]');
    await page.waitForTimeout(200);
    const incomeCats = await page.evaluate(() => Array.from(document.querySelectorAll('#qa-category option')).map(o => o.textContent));
    check('les catégories suivent le type sélectionné', incomeCats.some(c => c.includes('Salaire')), incomeCats.join(', '));

    // 3. Navigation : sous-onglets et surlignage du groupe
    await page.click('.nav-link[data-target="transactions"]');
    await page.waitForTimeout(300);
    await page.click('#transactions .subnav-link[data-target="subscriptions"]');
    await page.waitForTimeout(300);
    const subsVisible = await page.isVisible('#subscriptions');
    const sideActive = await page.evaluate(() => document.querySelector('.sidebar .nav-link[data-target="transactions"]').classList.contains('is-group-active'));
    check('sous-onglet Récurrences affiché', subsVisible);
    check('le groupe Transactions reste surligné dans le volet', sideActive);

    // 4. Modale d'édition depuis le tableau de bord
    await page.click('.nav-link[data-target="dashboard"]');
    await page.waitForTimeout(300);
    await page.click('#btn-qa-advanced');
    await page.waitForTimeout(300);
    const editOpen = await page.evaluate(() => document.getElementById('edit-modal-overlay').classList.contains('active'));
    check('"Plus d\'options" ouvre le formulaire complet', editOpen);
    await page.click('#btn-close-edit-modal');
    await page.waitForTimeout(300);
    const formBack = await page.evaluate(() => !!document.querySelector('#transactions .form-panel #form-transaction'));
    check('le formulaire complet retourne à sa place', formBack);

    // 5. Thème sombre
    await page.click('#theme-toggle');
    await page.waitForTimeout(400);
    const dark = await page.evaluate(() => document.body.getAttribute('data-theme'));
    check('bascule en thème sombre', dark === 'dark');
    await page.screenshot({ path: 'ui_desktop_dark.png', fullPage: true });
    await page.click('#theme-toggle');

    await ctx.close();

    // ---------- Mobile ----------
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const mpage = await mctx.newPage();
    mpage.on('pageerror', e => errors.push('mobile: ' + String(e)));
    await mpage.addInitScript(SEED);
    await mpage.goto('http://localhost:8778/index.html');
    await mpage.waitForTimeout(2500);
    await mpage.evaluate(() => {
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        document.querySelector('.nav-link[data-target="dashboard"]').click();
    });
    await mpage.waitForTimeout(400);

    // Volet coulissant
    await mpage.click('#btn-open-sidebar');
    await mpage.waitForTimeout(400);
    const drawerOpen = await mpage.evaluate(() => document.getElementById('sidebar').classList.contains('open'));
    check('le volet latéral s\'ouvre sur mobile', drawerOpen);
    await mpage.screenshot({ path: 'ui_mobile_drawer.png' });
    await mpage.click('#sidebar .nav-link[data-target="charts"]');
    await mpage.waitForTimeout(500);
    const drawerClosed = await mpage.evaluate(() => !document.getElementById('sidebar').classList.contains('open'));
    check('le volet se referme après navigation', drawerClosed);

    // Bouton + depuis l'onglet Transactions
    await mpage.click('#mobile-nav .nav-link[data-target="transactions"]');
    await mpage.waitForTimeout(400);
    await mpage.click('#fab-add');
    await mpage.waitForTimeout(400);
    const mobileModal = await mpage.evaluate(() => document.getElementById('mobile-form-modal').classList.contains('active'));
    check('le bouton + ouvre le formulaire plein écran', mobileModal);
    await mpage.screenshot({ path: 'ui_mobile_add_modal.png' });
    await mpage.click('#btn-close-mobile-modal');
    await mpage.waitForTimeout(300);

    // Pas de débordement horizontal
    const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('aucun débordement horizontal', overflow <= 1, 'écart = ' + overflow + 'px');

    await mctx.close();
    await browser.close();
    server.close();

    console.log(results.join('\n'));
    console.log('\nErreurs JS :', errors.length ? errors : 'aucune');
})();
