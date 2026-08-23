// Vérifie les évolutions demandées : indicateurs agrandis sans comparaison,
// repères mensuels + infobulle sur le patrimoine, nouveaux graphiques,
// onglet Organisation, sous-onglets Chèques repas et recherche de transactions.
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
    const trans = [];
    for (let m = 0; m >= -7; m--) {
        trans.push({ id: 'sal' + m, type: 'salary', amount: 2400, savedAmount: 300, date: d(m, 2), categoryId: 'cat-inc-1', note: 'Salaire', tagIds: [] });
        trans.push({ id: 'loy' + m, type: 'expense', amount: 780, date: d(m, 3), categoryId: 'cat-exp-1-1', note: 'Loyer', tagIds: ['tag-1'] });
        trans.push({ id: 'cou' + m, type: 'expense', amount: 162.35, date: d(m, 12), categoryId: 'cat-exp-3-1', note: 'Courses Delhaize', tagIds: ['tag-2'] });
        trans.push({ id: 'res' + m, type: 'expense', amount: 48, date: d(m, 21), categoryId: 'cat-exp-3-2', note: 'Restaurant italien', tagIds: [] });
    }
    window.appData = {
        spendingGoal: 1200, monthlyGoals: {},
        transactions: trans,
        subscriptions: [],
        tags: [
            { id: 'tag-1', name: 'Maison', color: '#0a6cff' },
            { id: 'tag-2', name: 'Alimentation', color: '#12a150' }
        ],
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
        mealVoucherCredits: [{ id: 'mv1', date: d(-1, 1), amount: 200, expiryDate: d(11, 1) }],
        mealVoucherExpenses: [{ id: 'mve1', amount: 35.5, date: d(0, 4) }, { id: 'mve2', amount: 12, date: d(0, 9) }],
        mealVouchersEnabled: true,
        mealVoucherCategories: ['cat-exp-3'],
        categories: [
            { id: 'cat-inc-1', name: 'Salaire', type: 'income', parentId: null },
            { id: 'cat-exp-1', name: 'Logement', type: 'expense', parentId: null },
            { id: 'cat-exp-1-1', name: 'Loyer', type: 'expense', parentId: 'cat-exp-1' },
            { id: 'cat-exp-3', name: 'Alimentation', type: 'expense', parentId: null },
            { id: 'cat-exp-3-1', name: 'Courses', type: 'expense', parentId: 'cat-exp-3' },
            { id: 'cat-exp-3-2', name: 'Restaurants', type: 'expense', parentId: 'cat-exp-3' }
        ]
    };
};

const inkOf = (id) => {
    const c = document.getElementById(id);
    if (!c || !c.width) return -1;
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 8) n++;
    return n;
};

(async () => {
    const server = await startServer(8791);
    const browser = await chromium.launch();
    const results = [];
    const check = (name, ok, extra) => results.push(`${ok ? 'OK   ' : 'ÉCHEC'} ${name}${extra !== undefined ? ' → ' + extra : ''}`);
    const errors = [];

    try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(SEED);
    await page.goto('http://localhost:8791/index.html');
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        if (typeof window.updateNavigationVisibility === 'function') window.updateNavigationVisibility();
        document.querySelector('.nav-link[data-target="dashboard"]').click();
    });
    await page.waitForTimeout(900);

    // ---------- 1. Indicateurs clés agrandis, sans comparaison ----------
    const hero = await page.evaluate(() => {
        const p = document.getElementById('dash-income');
        return {
            fontSize: parseFloat(getComputedStyle(p).fontSize),
            deltas: document.querySelectorAll('#dashboard .summary-cards-hero .stat-delta').length,
            texts: [...document.querySelectorAll('#dashboard .summary-cards-hero .stat-card')].map(c => c.textContent.trim())
        };
    });
    check('montant des indicateurs agrandi', hero.fontSize >= 34, hero.fontSize + 'px');
    check('aucune comparaison avec le mois précédent', hero.deltas === 0
        && !hero.texts.join(' ').includes('mois dernier'), JSON.stringify(hero.texts));

    // ---------- 2. Patrimoine : repères au 1er du mois + infobulle ----------
    const patri = await page.evaluate(() => {
        const c = document.getElementById('dashPatrimonyChart');
        return {
            points: (c._chartPoints || []).length,
            labels: (c._chartPoints || []).map(p => p.point.label),
            tooltips: (c._chartPoints || []).map(p => p.point.tooltip)
        };
    });
    check('repères mensuels sur la courbe du patrimoine', patri.points === 13, patri.points + ' points');
    check('libellés au 1er du mois', patri.labels.every(l => l.startsWith('1 ')), patri.labels[0]);
    check('infobulle : total + écart mois précédent',
        patri.tooltips[5] && patri.tooltips[5].length === 3
        && patri.tooltips[5][1].startsWith('Total :')
        && patri.tooltips[5][2].startsWith('Mois précédent :'),
        JSON.stringify(patri.tooltips[5]));

    // Survol réel d'un point : l'infobulle doit apparaître
    const tipVisible = await page.evaluate(async () => {
        const c = document.getElementById('dashPatrimonyChart');
        const rect = c.getBoundingClientRect();
        const pt = c._chartPoints[6];
        const ratio = rect.width / c._chartLogicalW;
        c.dispatchEvent(new MouseEvent('mousemove', {
            clientX: rect.left + pt.x * ratio, clientY: rect.top + pt.y * ratio, bubbles: true
        }));
        const tip = c.parentElement.querySelector('.chart-tooltip');
        return tip ? { display: tip.style.display, text: tip.textContent } : null;
    });
    check('infobulle affichée au survol', !!tipVisible && tipVisible.display === 'block'
        && tipVisible.text.includes('Total'), tipVisible && tipVisible.text);

    // ---------- 3. Renommage des modes chèques repas ----------
    const modes = await page.evaluate(() => [...document.querySelectorAll('#dashboard-mv-toggle option')].map(o => o.value + '=' + o.textContent));
    check('modes renommés Total / Avec chèques repas',
        modes.join(',') === 'real=Total,total=Avec chèques repas', modes.join(', '));

    await page.screenshot({ path: 'ui_upd_dashboard.png', fullPage: true });

    // ---------- 4. Nouveaux graphiques ----------
    await page.click('.nav-link[data-target="charts"]');
    await page.waitForTimeout(900);
    for (const [id, min] of [['chartCumulativeBalance', 2000], ['chartIncomeExpense12', 3000],
                             ['chartSavingsRate', 2000], ['chartWeekday', 2000],
                             ['chartDayOfMonth', 1500], ['chartTagExpenses', 1500],
                             ['chartTopExpenses', 1500]]) {
        const ink = await page.evaluate(inkOf, id);
        check('graphique ' + id + ' dessiné', ink > min, ink + ' pixels');
    }

    // Changement de période sur le bloc « Zoom sur les dépenses »
    await page.selectOption('#extra-chart-period', '12');
    await page.waitForTimeout(500);
    const weekdayInk12 = await page.evaluate(inkOf, 'chartWeekday');
    check('période « Zoom sur les dépenses » appliquée', weekdayInk12 > 2000, weekdayInk12 + ' pixels');
    await page.screenshot({ path: 'ui_upd_charts.png', fullPage: true });

    // La sous-navigation Analyse ne contient plus les Tags
    const analyseSub = await page.evaluate(() => [...document.querySelectorAll('#charts .subnav-link')].map(a => a.dataset.target));
    check('sous-onglets Analyse = Graphiques + Bilan', analyseSub.join(',') === 'charts,savings', analyseSub.join(', '));

    // ---------- 5. Onglet Organisation ----------
    await page.click('.sidebar .nav-link[data-target="categories"]');
    await page.waitForTimeout(600);
    const orga = await page.evaluate(() => ({
        title: document.getElementById('topbar-title').textContent,
        h2: document.querySelector('#categories h2').textContent,
        subs: [...document.querySelectorAll('#categories .subnav-link')].map(a => a.textContent.trim()),
        active: document.querySelector('.view-section.active').id
    }));
    check('onglet Organisation actif', orga.active === 'categories' && orga.h2 === 'Organisation', JSON.stringify(orga));
    check('sous-onglets Catégories & Tags', orga.subs.join(',') === 'Catégories,Tags', orga.subs.join(', '));
    await page.screenshot({ path: 'ui_upd_organisation.png', fullPage: true });

    await page.click('#categories .subnav-link[data-target="tags"]');
    await page.waitForTimeout(500);
    const tagsView = await page.evaluate(() => ({
        active: document.querySelector('.view-section.active').id,
        rows: document.querySelectorAll('#table-tags-overview tbody tr').length,
        h2: document.querySelector('#tags h2').textContent
    }));
    check('sous-onglet Tags rattaché à Organisation',
        tagsView.active === 'tags' && tagsView.h2 === 'Organisation' && tagsView.rows === 2, JSON.stringify(tagsView));

    // Les Réglages n'ont plus de sous-navigation Catégories
    await page.click('.sidebar .nav-link[data-target="settings"]');
    await page.waitForTimeout(400);
    const settingsSub = await page.evaluate(() => document.querySelectorAll('#settings .subnav-link').length);
    check('Réglages sans sous-onglet Catégories', settingsSub === 0, settingsSub + ' sous-onglets');

    // ---------- 6. Chèques repas en deux sous-onglets ----------
    await page.click('.sidebar .nav-link[data-target="meal-vouchers"]');
    await page.waitForTimeout(600);
    const mvSubs = await page.evaluate(() => ({
        subs: [...document.querySelectorAll('#meal-vouchers .subnav-link')].map(a => a.textContent.trim()),
        hasSharedForm: !!document.querySelector('#meal-vouchers #form-meal-voucher-expense')
    }));
    check('sous-onglets Chèques repas', mvSubs.subs.join(',') === 'Solde & lots,Dépenses partagées', mvSubs.subs.join(', '));
    check('formulaire partagé retiré de l\'onglet principal', mvSubs.hasSharedForm === false);

    await page.click('#meal-vouchers .subnav-link[data-target="meal-vouchers-shared"]');
    await page.waitForTimeout(600);
    const shared = await page.evaluate(() => ({
        active: document.querySelector('.view-section.active').id,
        total: document.getElementById('mv-shared-total').textContent,
        count: document.getElementById('mv-shared-count').textContent,
        rows: document.querySelectorAll('#table-meal-voucher-external-expenses tbody tr').length
    }));
    check('sous-onglet Dépenses partagées', shared.active === 'meal-vouchers-shared'
        && shared.count === '2' && shared.total.startsWith('47.50') && shared.rows === 2, JSON.stringify(shared));
    await page.screenshot({ path: 'ui_upd_meal_vouchers.png', fullPage: true });

    // ---------- 7. Recherche de transactions ----------
    await page.click('.sidebar .nav-link[data-target="transactions"]');
    await page.waitForTimeout(600);
    const before = await page.evaluate(() => document.querySelectorAll('#transactions-list .txn-row, #transactions-list .feed-item, #transactions-list li').length);
    await page.fill('#filter-search', 'delhaize');
    await page.waitForTimeout(500);
    const searched = await page.evaluate(() => ({
        count: document.getElementById('transactions-count').textContent,
        titles: [...document.querySelectorAll('#transactions-list')].map(n => n.textContent).join(' '),
        clearVisible: getComputedStyle(document.getElementById('btn-clear-filters')).display !== 'none'
    }));
    check('recherche par titre (insensible à la casse)',
        searched.count.startsWith('8 transactions') && searched.titles.includes('Courses Delhaize')
        && !searched.titles.includes('Loyer'), searched.count);
    check('bouton Réinitialiser actif avec une recherche', searched.clearVisible === true);

    await page.click('#btn-clear-filters');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
        value: document.getElementById('filter-search').value,
        count: document.getElementById('transactions-count').textContent
    }));
    check('réinitialisation vide la recherche', after.value === '' && after.count.startsWith('32'), JSON.stringify(after));
    await page.screenshot({ path: 'ui_upd_transactions.png', fullPage: true });

    // ---------- 8. Mobile ----------
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mpage = await mctx.newPage();
    mpage.on('pageerror', e => errors.push('[mobile] ' + String(e)));
    await mpage.addInitScript(SEED);
    await mpage.goto('http://localhost:8791/index.html');
    await mpage.waitForTimeout(2500);
    await mpage.evaluate(() => {
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app-content').style.display = 'block';
        if (typeof window.updateNavigationVisibility === 'function') window.updateNavigationVisibility();
        document.querySelector('#mobile-nav .nav-link[data-target="dashboard"]').click();
    });
    await mpage.waitForTimeout(900);
    const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('pas de débordement horizontal (mobile)', overflow <= 1, overflow + 'px');
    await mpage.screenshot({ path: 'ui_upd_mobile_dashboard.png', fullPage: true });

    } catch (e) {
        errors.push('EXCEPTION: ' + (e && e.message ? String(e.message).split(String.fromCharCode(10))[0] : String(e)));
    }
    console.log('\n' + results.join('\n'));
    console.log('\nErreurs JS : ' + (errors.length ? '\n' + errors.join('\n') : 'aucune'));
    const failed = results.filter(r => r.startsWith('ÉCHEC')).length;
    console.log(`\n${results.length - failed}/${results.length} vérifications réussies.`);

    await browser.close();
    server.close();
    process.exit(failed || errors.length ? 1 : 0);
})();
