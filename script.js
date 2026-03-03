// script.js
// --- STATE MANAGEMENT ---
let appData = {
    spendingGoal: 600,
    transactions: [],
    subscriptions: [],
    categories: [
        // Default categories
        { id: 'cat-inc-1', name: 'Salaire', type: 'income', parentId: null },
        { id: 'cat-inc-2', name: 'Aides', type: 'income', parentId: null },
        { id: 'cat-inc-3', name: 'Ventes', type: 'income', parentId: null },
        { id: 'cat-exp-1', name: 'Logement', type: 'expense', parentId: null },
        { id: 'cat-exp-1-1', name: 'Loyer', type: 'expense', parentId: 'cat-exp-1' },
        { id: 'cat-exp-1-2', name: 'Électricité', type: 'expense', parentId: 'cat-exp-1' },
        { id: 'cat-exp-2', name: 'Transport', type: 'expense', parentId: null },
        { id: 'cat-exp-2-1', name: 'Voiture', type: 'expense', parentId: 'cat-exp-2' },
        { id: 'cat-exp-2-1-1', name: 'Essence', type: 'expense', parentId: 'cat-exp-2-1' },
        { id: 'cat-exp-2-1-2', name: 'Assurance', type: 'expense', parentId: 'cat-exp-2-1' },
        { id: 'cat-exp-2-1-3', name: 'Entretien', type: 'expense', parentId: 'cat-exp-2-1' },
        { id: 'cat-exp-3', name: 'Alimentation', type: 'expense', parentId: null },
        { id: 'cat-exp-3-1', name: 'Courses', type: 'expense', parentId: 'cat-exp-3' },
        { id: 'cat-exp-3-2', name: 'Restaurants', type: 'expense', parentId: 'cat-exp-3' },
        { id: 'cat-exp-4', name: 'Loisirs', type: 'expense', parentId: null },
        { id: 'cat-exp-4-1', name: 'IA', type: 'expense', parentId: 'cat-exp-4' },
        { id: 'cat-exp-4-2', name: 'Streaming', type: 'expense', parentId: 'cat-exp-4' },
        { id: 'cat-exp-4-3', name: 'Jeux', type: 'expense', parentId: 'cat-exp-4' },
        { id: 'cat-exp-4-4', name: 'Sport', type: 'expense', parentId: 'cat-exp-4' },
        { id: 'cat-exp-5', name: 'Achats', type: 'expense', parentId: null },
        { id: 'cat-exp-5-1', name: 'Vêtements', type: 'expense', parentId: 'cat-exp-5' },
        { id: 'cat-exp-5-2', name: 'Cadeaux', type: 'expense', parentId: 'cat-exp-5' },
        { id: 'cat-exp-6', name: 'Santé', type: 'expense', parentId: null }
    ]
};

const STORAGE_KEY = 'budget_app_data';

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function loadData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            const parsed = JSON.parse(data);
            if(parsed.spendingGoal) appData.spendingGoal = parsed.spendingGoal;
            if(parsed.transactions) appData.transactions = parsed.transactions;
            if(parsed.subscriptions) appData.subscriptions = parsed.subscriptions;
            if(parsed.categories) appData.categories = parsed.categories;
        } catch(e) {
            console.error("Erreur de chargement des données", e);
        }
    } else {
        saveData(); // Save defaults
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- TRANSACTIONS MANAGEMENT ---
function renderTransactions() {
    const tbody = document.querySelector('#table-transactions tbody');
    tbody.innerHTML = '';

    let filterMonth = document.getElementById('filter-month').value;

    let filteredTrans = appData.transactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filterMonth) {
        filteredTrans = filteredTrans.filter(t => t.date.startsWith(filterMonth));
    }

    filteredTrans.forEach(t => {
        const tr = document.createElement('tr');
        const catName = getCategoryPath(t.categoryId);

        tr.innerHTML = `
            <td>${t.date}</td>
            <td><span class="${t.type === 'income' ? 'text-green' : 'text-red'}">${t.type === 'income' ? 'Revenu' : 'Dépense'}</span></td>
            <td>${catName}</td>
            <td>${t.note || ''}</td>
            <td class="${t.type === 'income' ? 'text-green' : 'text-red'}">${t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)} €</td>
            <td>
                <button class="btn btn-secondary btn-small" onclick="editTransaction('${t.id}')">Modifier</button>
                <button class="btn btn-danger btn-small" onclick="deleteTransaction('${t.id}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteTransaction(id) {
    if (confirm("Supprimer cette transaction ?")) {
        appData.transactions = appData.transactions.filter(t => t.id !== id);
        saveData();
        renderTransactions();
        updateDashboard();
    }
}

function editTransaction(id) {
    const trans = appData.transactions.find(t => t.id === id);
    if (!trans) return;

    // Remplir le formulaire
    document.getElementById('trans-id').value = trans.id;
    document.getElementById('trans-type').value = trans.type;
    document.getElementById('trans-type').dispatchEvent(new Event('change')); // Mettre à jour les catégories
    document.getElementById('trans-amount').value = trans.amount;
    document.getElementById('trans-date').value = trans.date;
    document.getElementById('trans-category').value = trans.categoryId;
    document.getElementById('trans-note').value = trans.note || '';

    // Changer l'état des boutons
    document.getElementById('btn-submit-trans').textContent = "Mettre à jour";
    document.getElementById('btn-cancel-edit-trans').style.display = 'inline-block';
}

function resetTransactionForm() {
    document.getElementById('form-transaction').reset();
    document.getElementById('trans-id').value = '';
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('trans-type').value = 'expense';
    document.getElementById('trans-type').dispatchEvent(new Event('change'));

    document.getElementById('btn-submit-trans').textContent = "Ajouter";
    document.getElementById('btn-cancel-edit-trans').style.display = 'none';
}

// --- SUBSCRIPTIONS MANAGEMENT ---
function getNextDate(dateStr, frequency) {
    const d = new Date(dateStr);
    if (frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
}

function processSubscriptions() {
    let hasNewTransactions = false;
    const today = new Date().toISOString().split('T')[0];

    appData.subscriptions.forEach(sub => {
        let nextDate = sub.nextDate || sub.startDate;

        while (nextDate <= today) {
            // Generate a transaction
            appData.transactions.push({
                id: 'trans-auto-' + generateId(),
                type: sub.type,
                amount: sub.amount,
                date: nextDate,
                categoryId: sub.categoryId,
                note: `[Auto] ${sub.name}`
            });

            // Advance next date
            nextDate = getNextDate(nextDate, sub.frequency);
            sub.nextDate = nextDate;
            hasNewTransactions = true;
        }
    });

    if (hasNewTransactions) {
        saveData();
        renderTransactions();
        updateDashboard();
    }
}

function renderSubscriptions() {
    const tbody = document.querySelector('#table-subscriptions tbody');
    tbody.innerHTML = '';

    appData.subscriptions.forEach(sub => {
        const tr = document.createElement('tr');
        const freqMap = { 'weekly': 'Hebdomadaire', 'monthly': 'Mensuelle', 'yearly': 'Annuelle' };

        tr.innerHTML = `
            <td>${sub.name}</td>
            <td><span class="${sub.type === 'income' ? 'text-green' : 'text-red'}">${sub.type === 'income' ? 'Revenu' : 'Dépense'}</span></td>
            <td>${freqMap[sub.frequency]}</td>
            <td class="${sub.type === 'income' ? 'text-green' : 'text-red'}">${sub.amount.toFixed(2)} €</td>
            <td>${sub.nextDate || sub.startDate}</td>
            <td><button class="btn btn-danger btn-small" onclick="deleteSubscription('${sub.id}')">Supprimer</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteSubscription(id) {
    if (confirm("Supprimer cet abonnement ? Les transactions déjà générées ne seront pas supprimées.")) {
        appData.subscriptions = appData.subscriptions.filter(s => s.id !== id);
        saveData();
        renderSubscriptions();
    }
}


// --- DASHBOARD & CHARTS MANAGEMENT ---
function getMonthData(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const trans = appData.transactions.filter(t => t.date.startsWith(prefix));

    let income = 0;
    let expense = 0;
    let categoryExpenses = {};

    trans.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else {
            expense += t.amount;
            // Get main category (if it's a sub, we get its parent for high-level charts, or just use it direct. Let's group by top-level category for clarity)
            const cat = appData.categories.find(c => c.id === t.categoryId);
            if (cat) {
                const topLevelId = cat.parentId ? cat.parentId : cat.id;
                const topLevelName = getCategoryPath(topLevelId).split(' > ')[0];
                categoryExpenses[topLevelName] = (categoryExpenses[topLevelName] || 0) + t.amount;
            }
        }
    });

    return { income, expense, balance: income - expense, categoryExpenses };
}

function drawPieChart(canvasId, dataObj) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const entries = Object.entries(dataObj).filter(e => e[1] > 0);
    if (entries.length === 0) {
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("Aucune donnée", canvas.width/2, canvas.height/2);
        return;
    }

    const total = entries.reduce((sum, e) => sum + e[1], 0);
    const colors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#2ecc71', '#e67e22', '#1abc9c', '#34495e'];

    let startAngle = 0;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 20;

    entries.forEach((entry, i) => {
        const [label, val] = entry;
        const sliceAngle = (val / total) * 2 * Math.PI;

        // Draw slice
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();

        // Draw Label text
        const middleAngle = startAngle + sliceAngle / 2;
        const textX = cx + Math.cos(middleAngle) * (radius + 15);
        const textY = cy + Math.sin(middleAngle) * (radius + 15);

        // Get text color from CSS variable for dark mode support
        const computedStyle = getComputedStyle(document.body);
        const textColor = computedStyle.getPropertyValue('--text-color').trim() || '#333';

        ctx.fillStyle = textColor;
        ctx.font = '12px Arial';
        ctx.textAlign = Math.cos(middleAngle) > 0 ? 'left' : 'right';
        ctx.textBaseline = 'middle';

        // Only show label if slice is > 5% to avoid clutter
        if ((val / total) > 0.05) {
            ctx.fillText(`${label} (${Math.round((val/total)*100)}%)`, textX, textY);
        }

        startAngle += sliceAngle;
    });
}

function drawBarChart(canvasId, dataArr) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (dataArr.length === 0) return;

    const maxVal = Math.max(...dataArr.map(d => Math.max(d.income, d.expense, 0.1)));

    const padding = 40;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border-color').trim() || '#ccc';
    ctx.stroke();

    const barGroupWidth = width / dataArr.length;
    const barWidth = barGroupWidth * 0.35;
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-color').trim() || '#333';

    dataArr.forEach((d, i) => {
        const x = padding + i * barGroupWidth + barGroupWidth * 0.15;

        // Income Bar (Green)
        const incomeH = (d.income / maxVal) * height;
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--success-color').trim() || '#2ecc71';
        ctx.fillRect(x, canvas.height - padding - incomeH, barWidth, incomeH);

        // Expense Bar (Red)
        const expenseH = (d.expense / maxVal) * height;
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--danger-color').trim() || '#e74c3c';
        ctx.fillRect(x + barWidth, canvas.height - padding - expenseH, barWidth, expenseH);

        // Month label
        ctx.fillStyle = textColor;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(d.label, x + barWidth, canvas.height - padding + 15);
    });

    // Legend
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--success-color').trim() || '#2ecc71';
    ctx.fillRect(padding + 10, 10, 10, 10);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.fillText("Revenus", padding + 25, 20);

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--danger-color').trim() || '#e74c3c';
    ctx.fillRect(padding + 100, 10, 10, 10);
    ctx.fillStyle = textColor;
    ctx.fillText("Dépenses", padding + 115, 20);
}


function updateDashboard() {
    let currentYear, currentMonth;

    const dashMonthFilter = document.getElementById('dash-filter-month').value;
    if (dashMonthFilter) {
        const parts = dashMonthFilter.split('-');
        currentYear = parseInt(parts[0], 10);
        currentMonth = parseInt(parts[1], 10);
    } else {
        const now = new Date();
        currentYear = now.getFullYear();
        currentMonth = now.getMonth() + 1;
        document.getElementById('dash-filter-month').value = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    }

    // Update current month summary cards
    const currentData = getMonthData(currentYear, currentMonth);
    document.getElementById('dash-income').textContent = currentData.income.toFixed(2) + ' €';
    document.getElementById('dash-expense').textContent = currentData.expense.toFixed(2) + ' €';

    // Update Goal Progress Bar
    const progressBar = document.getElementById('goal-progress-bar');
    const progressText = document.getElementById('goal-progress-text');
    const goal = appData.spendingGoal;
    const spent = currentData.expense;

    let percentage = 0;
    if (goal > 0) {
        percentage = (spent / goal) * 100;
    }

    // Cap at 100% for display purposes if wanted, but going over 100% is fine, just cap width at 100%
    progressBar.style.width = Math.min(percentage, 100) + '%';

    // Change color based on percentage
    if (percentage < 75) {
        progressBar.style.backgroundColor = 'var(--success-color)';
    } else if (percentage < 100) {
        progressBar.style.backgroundColor = 'var(--warning-color)'; // Needs definition in CSS
    } else {
        progressBar.style.backgroundColor = 'var(--danger-color)';
    }

    progressText.textContent = `${spent.toFixed(2)} € dépénsés sur ${goal.toFixed(2)} € (${percentage.toFixed(1)}%)`;

    // Draw Pie Chart for Categories
    drawPieChart('pieChartCategory', currentData.categoryExpenses);

    // Prepare data for 6-months bar chart
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
        let m = currentMonth - i;
        let y = currentYear;
        if (m <= 0) {
            m += 12;
            y -= 1;
        }
        const data = getMonthData(y, m);
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        data.label = monthNames[m - 1];
        last6Months.push(data);
    }

    drawBarChart('barChartEvolution', last6Months);
}

// --- INITIALIZATION ---
// --- CATEGORIES MANAGEMENT ---
function getCategoryPath(catId, visited = new Set()) {
    const cat = appData.categories.find(c => c.id === catId);
    if (!cat) return 'Inconnu';

    // Check for circular dependency
    if (visited.has(catId)) {
        return cat.name + " (Erreur: Boucle détectée)";
    }
    visited.add(catId);

    if (cat.parentId) {
        return getCategoryPath(cat.parentId, visited) + ' > ' + cat.name;
    }
    return cat.name;
}

function updateCategorySelects() {
    const parentSelect = document.getElementById('cat-parent');
    const transSelect = document.getElementById('trans-category');
    const subSelect = document.getElementById('sub-category');

    // Clear
    parentSelect.innerHTML = '<option value="">-- Aucune (Catégorie principale) --</option>';
    transSelect.innerHTML = '';
    subSelect.innerHTML = '';

    // Filter by type for transactions/subscriptions based on their selected type
    const populateTransSelect = () => {
        const transType = document.getElementById('trans-type').value;
        transSelect.innerHTML = '';
        appData.categories.filter(c => c.type === transType).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = getCategoryPath(c.id);
            transSelect.appendChild(opt);
        });
    };

    const populateSubSelect = () => {
        const subType = document.getElementById('sub-type').value;
        subSelect.innerHTML = '';
        appData.categories.filter(c => c.type === subType).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = getCategoryPath(c.id);
            subSelect.appendChild(opt);
        });
    };

    // Populate Parent Category Select (all categories allowed)
    appData.categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = getCategoryPath(c.id) + (c.type === 'income' ? ' (Revenu)' : ' (Dépense)');
        parentSelect.appendChild(opt);
    });

    populateTransSelect();
    populateSubSelect();

    // Event listeners to update on type change
    document.getElementById('trans-type').addEventListener('change', populateTransSelect);
    document.getElementById('sub-type').addEventListener('change', populateSubSelect);
}

function renderCategoryTree() {
    const container = document.getElementById('category-tree');
    container.innerHTML = '';

    const buildTree = (parentId, level) => {
        const children = appData.categories.filter(c => c.parentId === parentId);

        children.forEach(cat => {
            const el = document.createElement('div');
            el.className = 'cat-item' + (parentId ? ' cat-children' : '');

            const badge = `<span class="cat-type-badge ${cat.type === 'income' ? 'badge-income' : 'badge-expense'}">${cat.type === 'income' ? 'Revenu' : 'Dépense'}</span>`;

            el.innerHTML = `
                <div>
                    <strong>${cat.name}</strong> ${!parentId ? badge : ''}
                </div>
                <button class="btn btn-danger btn-small" onclick="deleteCategory('${cat.id}')">Supprimer</button>
            `;
            container.appendChild(el);

            buildTree(cat.id, level + 1);
        });
    };

    buildTree(null, 0);
}

function deleteCategory(id) {
    // Check if used
    const inTrans = appData.transactions.some(t => t.categoryId === id);
    const inSub = appData.subscriptions.some(s => s.categoryId === id);
    const hasChildren = appData.categories.some(c => c.parentId === id);

    if (inTrans || inSub) {
        alert("Impossible de supprimer cette catégorie car elle est utilisée dans des transactions ou abonnements.");
        return;
    }
    if (hasChildren) {
        alert("Impossible de supprimer cette catégorie car elle contient des sous-catégories.");
        return;
    }

    if (confirm("Supprimer cette catégorie ?")) {
        appData.categories = appData.categories.filter(c => c.id !== id);
        saveData();
        updateCategorySelects();
        renderCategoryTree();
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // Theme switching logic
    const themeToggleBtn = document.getElementById('theme-toggle');

    // Load saved theme or check OS preference
    const savedTheme = localStorage.getItem('budget_app_theme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.setAttribute('data-theme', 'dark');
    }

    themeToggleBtn.addEventListener('click', () => {
        if (document.body.getAttribute('data-theme') === 'dark') {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('budget_app_theme', 'light');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('budget_app_theme', 'dark');
        }
        updateDashboard(); // Redraw charts with new colors
    });

    // 1. Load data
    loadData();

    // Set default dashboard month to current
    const now = new Date();
    document.getElementById('dash-filter-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    updateDashboard(); // Initial render

    document.getElementById('dash-filter-month').addEventListener('change', updateDashboard);

    // Listen to tab changes to refresh dashboard
    document.addEventListener('viewChanged', (e) => {
        if(e.detail === 'dashboard' || e.detail === 'charts') {
            updateDashboard();
        } else if(e.detail === 'transactions') {
            renderTransactions();
        } else if(e.detail === 'subscriptions') {
            renderSubscriptions();
        } else if(e.detail === 'categories') {
            updateCategorySelects();
            renderCategoryTree();
        }
    });

    // 2. Navigation Logic
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            // Update active link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update active section
            sections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            // Dispatch event for view change
            document.dispatchEvent(new CustomEvent('viewChanged', { detail: targetId }));
        });
    });

    // 3. Init Categories View
    updateCategorySelects();
    renderCategoryTree();

    // 4. Handle Category Form
    document.getElementById('form-category').addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('cat-name').value;
        const parentId = document.getElementById('cat-parent').value || null;
        let type = document.getElementById('cat-type').value;

        // Si c'est une sous-catégorie, forcer le type du parent
        if (parentId) {
            const parentCat = appData.categories.find(c => c.id === parentId);
            if(parentCat) type = parentCat.type;
        }

        const newCat = {
            id: 'cat-' + generateId(),
            name: name,
            type: type,
            parentId: parentId
        };

        appData.categories.push(newCat);
        saveData();

        document.getElementById('form-category').reset();
        updateCategorySelects();
        renderCategoryTree();
    });


    // 5. Handle Transactions
    renderTransactions();

    document.getElementById('form-transaction').addEventListener('submit', (e) => {
        e.preventDefault();

        const type = document.getElementById('trans-type').value;
        const amount = parseFloat(document.getElementById('trans-amount').value);
        const date = document.getElementById('trans-date').value;
        const categoryId = document.getElementById('trans-category').value;
        const note = document.getElementById('trans-note').value;
        const transId = document.getElementById('trans-id').value;

        if (transId) {
            // Update
            const transIndex = appData.transactions.findIndex(t => t.id === transId);
            if (transIndex !== -1) {
                appData.transactions[transIndex] = {
                    id: transId,
                    type,
                    amount,
                    date,
                    categoryId,
                    note
                };
            }
        } else {
            // Add new
            const newTrans = {
                id: 'trans-' + generateId(),
                type,
                amount,
                date,
                categoryId,
                note
            };
            appData.transactions.push(newTrans);
        }

        saveData();
        resetTransactionForm();
        renderTransactions();
        updateDashboard();
    });

    document.getElementById('btn-cancel-edit-trans').addEventListener('click', resetTransactionForm);
    document.getElementById('filter-month').addEventListener('change', renderTransactions);
    // Set default date to today
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];


    // 6. Handle Subscriptions
    renderSubscriptions();
    processSubscriptions();

    document.getElementById('form-subscription').addEventListener('submit', (e) => {
        e.preventDefault();

        const type = document.getElementById('sub-type').value;
        const name = document.getElementById('sub-name').value;
        const amount = parseFloat(document.getElementById('sub-amount').value);
        const categoryId = document.getElementById('sub-category').value;
        const frequency = document.getElementById('sub-frequency').value;
        const startDate = document.getElementById('sub-start-date').value;

        const newSub = {
            id: 'sub-' + generateId(),
            type,
            name,
            amount,
            categoryId,
            frequency,
            startDate,
            nextDate: startDate // Le prochain prélèvement est au démarrage
        };

        appData.subscriptions.push(newSub);
        saveData();

        document.getElementById('form-subscription').reset();
        document.getElementById('sub-start-date').value = new Date().toISOString().split('T')[0];

        // Re-populate correctly
        document.getElementById('sub-type').value = 'expense';
        document.getElementById('sub-type').dispatchEvent(new Event('change'));

        renderSubscriptions();
        processSubscriptions(); // Au cas où la date de début est déjà passée, on génère la transaction de suite
    });

    document.getElementById('sub-start-date').value = new Date().toISOString().split('T')[0];


    // 7. Settings - Spending Goal
    const goalInput = document.getElementById('setting-spending-goal');
    goalInput.value = appData.spendingGoal;

    document.getElementById('form-settings-goal').addEventListener('submit', (e) => {
        e.preventDefault();
        appData.spendingGoal = parseFloat(goalInput.value);
        saveData();
        updateDashboard();
        alert("Objectif de dépense mis à jour !");
    });

    // 8. Settings - Export / Import / Reset
    document.getElementById('btn-export').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "budget_sauvegarde_" + new Date().toISOString().split('T')[0] + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    document.getElementById('btn-import').addEventListener('click', () => {
        const fileInput = document.getElementById('file-import');
        if (!fileInput.files.length) {
            alert("Veuillez sélectionner un fichier JSON.");
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if(importedData.categories && importedData.transactions) {
                    appData = importedData;
                    saveData();
                    alert("Données importées avec succès ! L'application va se recharger.");
                    location.reload();
                } else {
                    alert("Le fichier JSON n'est pas au bon format.");
                }
            } catch(error) {
                alert("Erreur lors de la lecture du fichier JSON.");
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        if(confirm("Êtes-vous sûr de vouloir tout effacer ? Cette action est irréversible.")) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        }
    });
});
