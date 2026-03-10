// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAequVMpWw5LnZ6fpq3_17o4ojBsfwbGUA",
  authDomain: "monbudget-51ab6.firebaseapp.com",
  projectId: "monbudget-51ab6",
  storageBucket: "monbudget-51ab6.firebasestorage.app",
  messagingSenderId: "37724778417",
  appId: "1:37724778417:web:289aa4478da7c67b0d9790"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// L'email caché utilisé pour s'authentifier
const ADMIN_EMAIL = "admin@monbudget.app";

// --- STATE MANAGEMENT ---
let appData = {
    spendingGoal: 600,
    monthlyGoals: {},
    transactions: [],
    subscriptions: [],
    tags: [],
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

// Variable pour savoir si on est connecté ou non
let isAuthenticated = false;

async function saveData() {
    if (!isAuthenticated) return; // Ne pas sauvegarder si pas connecté

    try {
        const userDocRef = doc(db, "users", "admin");
        await setDoc(userDocRef, {
            spendingGoal: appData.spendingGoal,
            monthlyGoals: appData.monthlyGoals || {},
            transactions: appData.transactions,
            subscriptions: appData.subscriptions,
            tags: appData.tags || [],
            categories: appData.categories,
            updatedAt: new Date().toISOString()
        });
        console.log("Données sauvegardées sur Firestore avec succès.");
    } catch (error) {
        console.error("Erreur lors de la sauvegarde sur Firestore :", error);
        alert("Erreur lors de la sauvegarde de vos données. Vérifiez votre connexion internet.");
    }
}

async function loadData() {
    if (!isAuthenticated) return;

    try {
        const userDocRef = doc(db, "users", "admin");
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const parsed = docSnap.data();
            if(parsed.spendingGoal) appData.spendingGoal = parsed.spendingGoal;
            if(parsed.monthlyGoals) appData.monthlyGoals = parsed.monthlyGoals;
            if(parsed.transactions) appData.transactions = parsed.transactions.map(t => ({ ...t, tagIds: t.tagIds || [] }));
            if(parsed.subscriptions) appData.subscriptions = parsed.subscriptions;
            if(parsed.tags) appData.tags = parsed.tags;
            if(parsed.categories) appData.categories = parsed.categories;
        } else {
            console.log("Aucune donnée Firestore trouvée. Initialisation avec les valeurs par défaut.");
            await saveData(); // Sauvegarde les valeurs par défaut
        }
    } catch (error) {
        console.error("Erreur lors du chargement depuis Firestore :", error);
        alert("Impossible de charger vos données. Veuillez réessayer plus tard.");
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- TRANSACTIONS MANAGEMENT ---
let currentTransactionFilter = 'all';
let currentTransactionTagFilters = [];

function toggleTransactionTagFilter(tagId) {
    if (currentTransactionTagFilters.includes(tagId)) {
        currentTransactionTagFilters = currentTransactionTagFilters.filter(id => id !== tagId);
    } else {
        currentTransactionTagFilters.push(tagId);
    }
    renderTransactions();
    updateFilterChips();
}
window.toggleTransactionTagFilter = toggleTransactionTagFilter;

function renderTransactions() {
    const tbody = document.querySelector('#table-transactions tbody');
    tbody.innerHTML = '';

    let filterMonth = document.getElementById('filter-month').value;

    let filteredTrans = appData.transactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filterMonth) {
        filteredTrans = filteredTrans.filter(t => t.date.startsWith(filterMonth));
    }

    if (currentTransactionFilter === 'income') {
        filteredTrans = filteredTrans.filter(t => t.type === 'income');
    } else if (currentTransactionFilter === 'expense') {
        filteredTrans = filteredTrans.filter(t => t.type === 'expense');
    } else if (currentTransactionFilter.startsWith('cat-')) {
        // Includes subcategories
        filteredTrans = filteredTrans.filter(t => {
            const cat = appData.categories.find(c => c.id === t.categoryId);
            return t.categoryId === currentTransactionFilter || (cat && cat.parentId === currentTransactionFilter);
        });
    }

    if (currentTransactionTagFilters.length > 0) {
        filteredTrans = filteredTrans.filter(t => {
            if (!t.tagIds) return false;
            // Retourne true si la transaction possède au moins un des tags sélectionnés (OU logique)
            return currentTransactionTagFilters.some(filterTagId => t.tagIds.includes(filterTagId));
        });
    }

    filteredTrans.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = 'clickable-row'; // Visual cue
        tr.ondblclick = () => editTransaction(t.id); // Option C: Quick edit on double click

        const catName = getCategoryPath(t.categoryId);

        // Tags HTML
        let tagsHtml = '';
        if (t.tagIds && t.tagIds.length > 0) {
            t.tagIds.forEach(tagId => {
                const tag = appData.tags.find(g => g.id === tagId);
                if (tag) {
                    tagsHtml += `<span class="tag-chip tag-display"><span class="tag-dot" style="background-color: ${tag.color};"></span>${tag.name}</span>`;
                }
            });
        }

        tr.innerHTML = `
            <td data-label="Date">${t.date}</td>
            <td data-label="Type"><span class="${t.type === 'income' ? 'text-green' : 'text-red'}">${t.type === 'income' ? 'Revenu' : 'Dépense'}</span></td>
            <td data-label="Catégorie">${catName}</td>
            <td data-label="Note">${t.note || ''}</td>
            <td data-label="Tags"><div style="display: flex; gap: 4px; flex-wrap: wrap;">${tagsHtml}</div></td>
            <td data-label="Montant" class="${t.type === 'income' ? 'text-green' : 'text-red'}">${t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)} €</td>
            <td data-label="Actions">
                <button class="btn btn-secondary btn-small" onclick="editTransaction('${t.id}')">Modifier</button>
                <button class="btn btn-danger btn-small" onclick="deleteTransaction('${t.id}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateFilterChips();
}

function setTransactionFilter(filter) {
    currentTransactionFilter = filter;
    renderTransactions();
}

function updateFilterChips() {
    const container = document.getElementById('quick-filters');
    if (!container) return;

    // Keep the static first 3 buttons (All, Income, Expense)
    const staticChipsHtml = `
        <button class="btn btn-small filter-chip ${currentTransactionFilter === 'all' ? 'active' : ''}" onclick="setTransactionFilter('all')">Toutes</button>
        <button class="btn btn-small filter-chip ${currentTransactionFilter === 'income' ? 'active' : ''}" onclick="setTransactionFilter('income')" style="background-color: ${currentTransactionFilter === 'income' ? 'var(--success-color)' : 'transparent'}; border-color: var(--success-color); color: ${currentTransactionFilter === 'income' ? 'white' : 'var(--success-color)'};">Revenus</button>
        <button class="btn btn-small filter-chip ${currentTransactionFilter === 'expense' ? 'active' : ''}" onclick="setTransactionFilter('expense')" style="background-color: ${currentTransactionFilter === 'expense' ? 'var(--danger-color)' : 'transparent'}; border-color: var(--danger-color); color: ${currentTransactionFilter === 'expense' ? 'white' : 'var(--danger-color)'};">Dépenses</button>
    `;

    // Dynamic Top Categories (Main level)
    let dynChipsHtml = '';
    const mainCategories = appData.categories.filter(c => c.parentId === null);

    mainCategories.forEach(cat => {
        const isActive = currentTransactionFilter === cat.id;
        dynChipsHtml += `<button class="btn btn-small filter-chip ${isActive ? 'active' : ''}" onclick="setTransactionFilter('${cat.id}')">${cat.name}</button>`;
    });

    container.innerHTML = staticChipsHtml + dynChipsHtml;

    // Mettre à jour les filtres de tags
    const tagsContainer = document.getElementById('tag-filters');
    if (!tagsContainer) return;

    let tagChipsHtml = '';
    appData.tags.forEach(tag => {
        const isSelected = currentTransactionTagFilters.includes(tag.id);
        const activeClass = isSelected ? 'active' : '';
        tagChipsHtml += `<button class="btn btn-small filter-chip tag-filter-chip ${activeClass}" onclick="toggleTransactionTagFilter('${tag.id}')"><span class="tag-dot" style="background-color: ${tag.color};"></span>${tag.name}</button>`;
    });
    tagsContainer.innerHTML = tagChipsHtml;
}

async function deleteTransaction(id) {
    if (confirm("Supprimer cette transaction ?")) {
        appData.transactions = appData.transactions.filter(t => t.id !== id);
        await saveData();
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

    // Gérer les tags
    document.getElementById('trans-selected-tags').value = JSON.stringify(trans.tagIds || []);
    renderTransactionTagsSelector();

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

    document.getElementById('trans-selected-tags').value = '[]';
    renderTransactionTagsSelector();

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

async function processSubscriptions() {
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
                note: `[Auto] ${sub.name}`,
                subscriptionId: sub.id
            });

            // Advance next date
            nextDate = getNextDate(nextDate, sub.frequency);
            sub.nextDate = nextDate;
            hasNewTransactions = true;
        }
    });

    if (hasNewTransactions) {
        await saveData();
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
            <td data-label="Nom">${sub.name}</td>
            <td data-label="Type"><span class="${sub.type === 'income' ? 'text-green' : 'text-red'}">${sub.type === 'income' ? 'Revenu' : 'Dépense'}</span></td>
            <td data-label="Fréquence">${freqMap[sub.frequency]}</td>
            <td data-label="Montant" class="${sub.type === 'income' ? 'text-green' : 'text-red'}">${sub.amount.toFixed(2)} €</td>
            <td data-label="Prochaine date">${sub.nextDate || sub.startDate}</td>
            <td data-label="Actions">
                <button class="btn btn-primary btn-small" onclick="viewSubscriptionHistory('${sub.id}')">Historique</button>
                <button class="btn btn-secondary btn-small" onclick="editSubscription('${sub.id}')">Modifier</button>
                <button class="btn btn-danger btn-small" onclick="deleteSubscription('${sub.id}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function viewSubscriptionHistory(subId) {
    const sub = appData.subscriptions.find(s => s.id === subId);
    if (!sub) return;

    // Filter transactions generated by this subscription
    const trans = appData.transactions.filter(t => t.subscriptionId === subId || (t.note && t.note.includes(`[Auto] ${sub.name}`)));

    // Sort descending by date
    trans.sort((a, b) => new Date(b.date) - new Date(a.date));

    let total = 0;
    trans.forEach(t => total += t.amount);

    openDataModal(`Historique de l'abonnement : ${sub.name}`, trans, total, sub.type);
}

function editSubscription(id) {
    const sub = appData.subscriptions.find(s => s.id === id);
    if (!sub) return;

    // Fill the form
    document.getElementById('sub-id').value = sub.id;
    document.getElementById('sub-type').value = sub.type;
    document.getElementById('sub-type').dispatchEvent(new Event('change')); // Mettre à jour les catégories
    document.getElementById('sub-name').value = sub.name;
    document.getElementById('sub-amount').value = sub.amount;
    document.getElementById('sub-category').value = sub.categoryId;
    document.getElementById('sub-frequency').value = sub.frequency;
    document.getElementById('sub-start-date').value = sub.startDate; // Note: editing start date won't change nextDate unless handled explicitly

    // Show apply to past checkbox and change buttons
    document.getElementById('sub-apply-past-container').style.display = 'flex';
    document.getElementById('sub-apply-past').checked = false;
    document.getElementById('btn-submit-sub').textContent = "Mettre à jour";
    document.getElementById('btn-cancel-edit-sub').style.display = 'inline-block';
}

function resetSubscriptionForm() {
    document.getElementById('form-subscription').reset();
    document.getElementById('sub-id').value = '';
    document.getElementById('sub-start-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('sub-type').value = 'expense';
    document.getElementById('sub-type').dispatchEvent(new Event('change'));

    document.getElementById('sub-apply-past-container').style.display = 'none';
    document.getElementById('btn-submit-sub').textContent = "Ajouter";
    document.getElementById('btn-cancel-edit-sub').style.display = 'none';
}

async function deleteSubscription(id) {
    if (confirm("Supprimer cet abonnement ? Les transactions déjà générées ne seront pas supprimées.")) {
        appData.subscriptions = appData.subscriptions.filter(s => s.id !== id);
        await saveData();
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

function getMultiMonthCategoryData(startYear, startMonth, numberOfMonths) {
    // Generate valid YYYY-MM prefixes for the requested period
    const validPrefixes = [];
    for (let i = 0; i < numberOfMonths; i++) {
        let m = startMonth - i;
        let y = startYear;
        if (m <= 0) {
            m += 12;
            y -= 1;
        }
        validPrefixes.push(`${y}-${String(m).padStart(2, '0')}`);
    }

    // Filter transactions by these prefixes
    const trans = appData.transactions.filter(t =>
        validPrefixes.some(prefix => t.date.startsWith(prefix))
    );

    let detailedCategoryExpenses = {};

    trans.forEach(t => {
        if (t.type === 'expense') {
            const catPath = getCategoryPath(t.categoryId);
            detailedCategoryExpenses[catPath] = (detailedCategoryExpenses[catPath] || 0) + t.amount;
        }
    });

    return detailedCategoryExpenses;
}

// Store hit regions for interactivity
let chartInteractions = {};

function handleChartClick(e, canvasId) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const regions = chartInteractions[canvasId];
    if (!regions) return;

    // Use scaling if the canvas uses CSS to resize
    const scaleX = e.target.width / rect.width;
    const scaleY = e.target.height / rect.height;

    const clickX = x * scaleX;
    const clickY = y * scaleY;

    for (const region of regions) {
        if (region.type === 'arc') {
            const dx = clickX - region.cx;
            const dy = clickY - region.cy;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance <= region.radius) {
                let angle = Math.atan2(dy, dx);
                if (angle < 0) angle += 2 * Math.PI; // Normalize to 0 - 2PI

                if (angle >= region.startAngle && angle <= region.endAngle) {
                    showCategoryDetails(region.label, region.amount);
                    return;
                }
            }
        } else if (region.type === 'rect') {
            if (clickX >= region.x && clickX <= region.x + region.w &&
                clickY >= region.y && clickY <= region.y + region.h) {

                if (region.action === 'showCategory') {
                    showCategoryDetails(region.label, region.amount);
                } else if (region.action === 'showMonth') {
                    showMonthDetails(region.year, region.month, region.label, region.income, region.expense);
                }
                return;
            }
        }
    }
}

function attachChartClickListener(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Remove existing listener to prevent duplicates
    canvas.removeEventListener('click', canvas._clickHandler);

    canvas._clickHandler = (e) => handleChartClick(e, canvasId);
    canvas.addEventListener('click', canvas._clickHandler);

    // Add hover effect
    canvas.addEventListener('mousemove', (e) => {
        const rect = e.target.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (e.target.width / rect.width);
        const y = (e.clientY - rect.top) * (e.target.height / rect.height);

        let hovered = false;
        const regions = chartInteractions[canvasId] || [];

        for (const region of regions) {
            if (region.type === 'arc') {
                const dx = x - region.cx;
                const dy = y - region.cy;
                if (Math.sqrt(dx*dx + dy*dy) <= region.radius) {
                    let angle = Math.atan2(dy, dx);
                    if (angle < 0) angle += 2 * Math.PI;
                    if (angle >= region.startAngle && angle <= region.endAngle) {
                        hovered = true; break;
                    }
                }
            } else if (region.type === 'rect') {
                if (x >= region.x && x <= region.x + region.w &&
                    y >= region.y && y <= region.y + region.h) {
                    hovered = true; break;
                }
            }
        }
        e.target.style.cursor = hovered ? 'pointer' : 'default';
    });
}

function showCategoryDetails(categoryName, totalAmount) {
    const periodSelect = document.getElementById('chart-period-select');
    let months = 1; // Default
    if (periodSelect && document.querySelector('#charts').classList.contains('active')) {
         months = parseInt(periodSelect.value, 10);
    }

    // Get filter prefix based on dashboard month
    let filterPrefixes = [];
    const dashMonthFilter = document.getElementById('dash-filter-month').value;
    let year, month;
    if (dashMonthFilter) {
        const parts = dashMonthFilter.split('-');
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
    } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1;
    }

    for (let i = 0; i < months; i++) {
        let m = month - i;
        let y = year;
        if (m <= 0) {
            m += 12;
            y -= 1;
        }
        filterPrefixes.push(`${y}-${String(m).padStart(2, '0')}`);
    }

    // Filter transactions
    const trans = appData.transactions.filter(t => {
        if (t.type !== 'expense') return false;
        const catPath = getCategoryPath(t.categoryId);
        const topCatName = catPath.split(' > ')[0];

        // Match exact path OR top category name depending on chart detail level
        const isMatch = (catPath === categoryName) || (topCatName === categoryName);

        return isMatch && filterPrefixes.some(prefix => t.date.startsWith(prefix));
    });

    trans.sort((a, b) => new Date(b.date) - new Date(a.date));

    openDataModal(`Détails : ${categoryName}`, trans, totalAmount, 'expense');
}

function showMonthDetails(year, month, label, totalIncome, totalExpense) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const trans = appData.transactions.filter(t => t.date.startsWith(prefix));
    trans.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Show expenses total by default, unless income is specified
    const balance = totalIncome - totalExpense;

    // Add custom header info to the modal for this specific case
    document.getElementById('data-modal-title').innerHTML = `Mois : ${label} <small>(${year})</small>`;

    const totalSpan = document.getElementById('data-modal-total');
    totalSpan.innerHTML = `
        <span class="text-green">+${totalIncome.toFixed(2)}€</span> |
        <span class="text-red">-${totalExpense.toFixed(2)}€</span> |
        <span style="color: ${balance >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
            Solde: ${balance >= 0 ? '+' : ''}${balance.toFixed(2)}€
        </span>`;

    // Fill the table manually since we hijacked the title
    const tbody = document.querySelector('#table-modal-transactions tbody');
    tbody.innerHTML = '';

    if (trans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucune transaction trouvée.</td></tr>';
    } else {
        trans.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'clickable-row';
            tr.onclick = () => {
                closeDataModal();
                document.querySelector('.nav-link[data-target="transactions"]').click();
                editTransaction(t.id);
            };
            const catName = getCategoryPath(t.categoryId);

            tr.innerHTML = `
                <td data-label="Date">${t.date}</td>
                <td data-label="Type"><span class="${t.type === 'income' ? 'text-green' : 'text-red'}">${t.type === 'income' ? 'Revenu' : 'Dépense'}</span></td>
                <td data-label="Catégorie">${catName}</td>
                <td data-label="Note">${t.note || ''}</td>
                <td data-label="Montant" class="${t.type === 'income' ? 'text-green' : 'text-red'}">${t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)} €</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('data-modal-overlay').classList.add('active');
}

function drawPieChart(canvasId, dataObj) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    chartInteractions[canvasId] = [];
    attachChartClickListener(canvasId);

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

        // Store hit region
        chartInteractions[canvasId].push({
            type: 'arc', cx, cy, radius, startAngle, endAngle: startAngle + sliceAngle,
            label, amount: val
        });

        startAngle += sliceAngle;
    });
}

function drawBarChart(canvasId, dataArr) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    chartInteractions[canvasId] = [];
    attachChartClickListener(canvasId);

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

        // Store hit region for the whole group (both bars + label)
        const hitX = x - barWidth * 0.5;
        const hitY = canvas.height - padding - Math.max(incomeH, expenseH);
        const hitW = barWidth * 3;
        const hitH = Math.max(incomeH, expenseH) + 20;

        chartInteractions[canvasId].push({
            type: 'rect', x: hitX, y: hitY, w: hitW, h: hitH,
            action: 'showMonth', label: d.label, year: d.year, month: d.month,
            income: d.income, expense: d.expense
        });
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

function drawHorizontalBarChart(canvasId, dataObj) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Sort entries descending by amount
    const entries = Object.entries(dataObj).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);

    // Auto-adjust canvas height based on number of entries to ensure bars fit nicely
    const barHeight = 30;
    const barSpacing = 20;
    const topPadding = 20;
    const bottomPadding = 30;
    const requiredHeight = topPadding + bottomPadding + (entries.length * (barHeight + barSpacing));

    // Set internal resolution height, but keep CSS max-width/height logic from HTML
    canvas.height = Math.max(300, requiredHeight);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    chartInteractions[canvasId] = [];
    attachChartClickListener(canvasId);

    if (entries.length === 0) {
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("Aucune dépense pour cette période", canvas.width/2, canvas.height/2);
        return;
    }

    const maxVal = Math.max(...entries.map(e => e[1]));

    // Label padding (left area for text)
    const labelWidth = 250;
    const paddingRight = 80; // space for amount text on the right
    const width = canvas.width - labelWidth - paddingRight;

    const textColor = getComputedStyle(document.body).getPropertyValue('--text-color').trim() || '#333';
    const barColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim() || '#4299e1';
    const borderColor = getComputedStyle(document.body).getPropertyValue('--border-color').trim() || '#e2e8f0';

    // Draw vertical axis line
    ctx.beginPath();
    ctx.moveTo(labelWidth, topPadding);
    ctx.lineTo(labelWidth, canvas.height - bottomPadding);
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    entries.forEach((entry, i) => {
        const [label, val] = entry;
        const y = topPadding + i * (barHeight + barSpacing);

        // Calculate bar width based on max value
        const currentBarWidth = (val / maxVal) * width;

        // Draw category label
        ctx.fillStyle = textColor;
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Truncate label if too long
        let displayLabel = label;
        if (ctx.measureText(displayLabel).width > labelWidth - 10) {
            displayLabel = displayLabel.substring(0, 30) + '...';
        }

        ctx.fillText(displayLabel, labelWidth - 10, y + barHeight / 2);

        // Draw bar
        ctx.fillStyle = barColor;
        ctx.beginPath();
        ctx.roundRect(labelWidth, y, currentBarWidth, barHeight, [0, 4, 4, 0]);
        ctx.fill();

        // Draw amount value
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.font = 'bold 13px Arial';
        ctx.fillText(`${val.toFixed(2)} €`, labelWidth + currentBarWidth + 10, y + barHeight / 2);

        // Store hit region
        chartInteractions[canvasId].push({
            type: 'rect', x: 0, y: y, w: canvas.width, h: barHeight,
            action: 'showCategory', label: label, amount: val
        });
    });
}


function renderSavings() {
    let allMonths = new Set();

    // Add all months with transactions
    appData.transactions.forEach(t => {
        if (t.date && t.date.length >= 7) {
            allMonths.add(t.date.substring(0, 7));
        }
    });

    // Add all months with specific goals
    if (appData.monthlyGoals) {
        Object.keys(appData.monthlyGoals).forEach(month => {
            allMonths.add(month);
        });
    }

    // Sort months descending (newest first)
    const sortedMonths = Array.from(allMonths).sort().reverse();

    let totalSavings = 0;
    const tbody = document.querySelector('#table-savings-history tbody');
    tbody.innerHTML = '';

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    sortedMonths.forEach(monthStr => {
        const parts = monthStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);

        const data = getMonthData(year, month);

        let goal = appData.spendingGoal;
        if (appData.monthlyGoals && appData.monthlyGoals[monthStr] !== undefined) {
            goal = appData.monthlyGoals[monthStr];
        }

        const savingsForMonth = goal - data.expense;
        totalSavings += savingsForMonth;

        const tr = document.createElement('tr');

        const formattedMonth = `${monthNames[month - 1]} ${year}`;

        // Define colors for UI
        const savingsClass = savingsForMonth >= 0 ? 'text-green' : 'text-red';
        const savingsSign = savingsForMonth >= 0 ? '+' : '';

        tr.innerHTML = `
            <td data-label="Mois">${formattedMonth}</td>
            <td data-label="Objectif">${goal.toFixed(2)} €</td>
            <td data-label="Dépenses réelles" class="text-red">-${data.expense.toFixed(2)} €</td>
            <td data-label="Économie (Bilan)" class="${savingsClass}">${savingsSign}${savingsForMonth.toFixed(2)} €</td>
        `;
        tbody.appendChild(tr);
    });

    if (sortedMonths.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Aucune donnée disponible.</td></tr>';
    }

    // Update Total Savings view
    const totalSavingsElement = document.getElementById('savings-view-total');
    if (totalSavings >= 0) {
        totalSavingsElement.textContent = `+${totalSavings.toFixed(2)} €`;
        totalSavingsElement.className = 'text-green';
    } else {
        totalSavingsElement.textContent = `${totalSavings.toFixed(2)} €`;
        totalSavingsElement.className = 'text-red';
    }
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

// --- TAGS MANAGEMENT (UI FORM) ---
function renderTransactionTagsSelector() {
    const container = document.getElementById('trans-tags-container');
    if (!container) return;
    container.innerHTML = '';

    const selectedTagsStr = document.getElementById('trans-selected-tags').value;
    let selectedTags = [];
    try {
        selectedTags = JSON.parse(selectedTagsStr);
    } catch (e) { selectedTags = []; }

    appData.tags.forEach(tag => {
        const isSelected = selectedTags.includes(tag.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn btn-small filter-chip tag-filter-chip ${isSelected ? 'active' : ''}`;

        btn.innerHTML = `<span class="tag-dot" style="background-color: ${tag.color};"></span>${tag.name}`;
        btn.onclick = () => toggleTransactionTag(tag.id);
        container.appendChild(btn);
    });
}

function toggleTransactionTag(tagId) {
    const input = document.getElementById('trans-selected-tags');
    let selectedTags = [];
    try { selectedTags = JSON.parse(input.value); } catch(e) {}

    if (selectedTags.includes(tagId)) {
        selectedTags = selectedTags.filter(id => id !== tagId);
    } else {
        selectedTags.push(tagId);
    }

    input.value = JSON.stringify(selectedTags);
    renderTransactionTagsSelector();
}

window.toggleTransactionTag = toggleTransactionTag;

// --- DASHBOARD & CHARTS MANAGEMENT ---

    // Update current month summary cards
    const currentData = getMonthData(currentYear, currentMonth);
    document.getElementById('dash-income').textContent = '+' + currentData.income.toFixed(2) + ' €';
    document.getElementById('dash-expense').textContent = '-' + currentData.expense.toFixed(2) + ' €';

    // Update Goal Progress Bar
    const progressBar = document.getElementById('goal-progress-bar');
    const progressText = document.getElementById('goal-progress-text');

    let goal = appData.spendingGoal;
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    if (appData.monthlyGoals && appData.monthlyGoals[monthStr] !== undefined) {
        goal = appData.monthlyGoals[monthStr];
    }

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

    // Draw Detailed Category Bar Chart for Dashboard (Current month)
    const dashboardDetailedData = getMultiMonthCategoryData(currentYear, currentMonth, 1);
    drawHorizontalBarChart('dashboardBarChartCategory', dashboardDetailedData);

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
        data.month = m;
        data.year = y;
        last6Months.push(data);
    }

    drawBarChart('barChartEvolution', last6Months);

    updateHorizontalBarChart(currentYear, currentMonth);
}

function updateHorizontalBarChart(year, month) {
    const periodSelect = document.getElementById('chart-period-select');
    if (!periodSelect) return;

    const months = parseInt(periodSelect.value, 10);
    const multiMonthData = getMultiMonthCategoryData(year, month, months);
    drawHorizontalBarChart('horizontalBarChartCategory', multiMonthData);

    const title = document.getElementById('horizontalBarChartTitle');
    if (title) {
        if (months === 1) title.textContent = "Dépenses par catégorie (Ce mois)";
        else if (months === 12) title.textContent = "Dépenses par catégorie (Cette année)";
        else title.textContent = `Dépenses par catégorie (${months} derniers mois)`;
    }
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

    // --- DRAG AND DROP START ---
    let draggedCategoryId = null;

    // Check if a category is a descendant of another
    const isDescendant = (parentId, childId) => {
        if (parentId === childId) return true;
        const child = appData.categories.find(c => c.id === childId);
        if (!child || !child.parentId) return false;
        return isDescendant(parentId, child.parentId);
    };

    const handleDragStart = (e, catId) => {
        draggedCategoryId = catId;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', catId);
        setTimeout(() => e.target.classList.add('dragging'), 0);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Add visual cue
        const dropTarget = e.target.closest('.cat-dropzone');
        if (dropTarget) {
            const targetId = dropTarget.dataset.id;
            // Prevent dropping into itself or its descendants
            if (targetId === draggedCategoryId || isDescendant(draggedCategoryId, targetId)) {
                dropTarget.classList.add('drop-invalid');
            } else {
                dropTarget.classList.add('drop-hover');
            }
        }
    };

    const handleDragLeave = (e) => {
        const dropTarget = e.target.closest('.cat-dropzone');
        if (dropTarget) {
            dropTarget.classList.remove('drop-hover');
            dropTarget.classList.remove('drop-invalid');
        }
    };

    const handleDrop = async (e, targetId) => {
        e.preventDefault();
        const dropTarget = e.target.closest('.cat-dropzone');
        if (dropTarget) {
            dropTarget.classList.remove('drop-hover');
            dropTarget.classList.remove('drop-invalid');
        }

        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === targetId) return;

        // Prevent dropping a parent into its own child
        if (targetId && isDescendant(draggedId, targetId)) {
            alert("Action impossible : vous ne pouvez pas déplacer une catégorie dans l'une de ses propres sous-catégories.");
            return;
        }

        const cat = appData.categories.find(c => c.id === draggedId);
        if (!cat) return;

        // Set new parent, targetId is null if dropped in root dropzone
        cat.parentId = targetId;

        // If it becomes a sub-category, it must adopt the parent's type
        if (targetId) {
            const parentCat = appData.categories.find(c => c.id === targetId);
            if (parentCat) {
                cat.type = parentCat.type;
            }
        }

        await saveData();
        updateCategorySelects();
        renderCategoryTree();
        renderTransactions(); // Refresh UI in case type changed
        updateDashboard();
    };

    const handleDragEnd = (e) => {
        e.target.classList.remove('dragging');
        draggedCategoryId = null;
    };
    // --- DRAG AND DROP END ---

    // Add root dropzone
    const rootDropzone = document.createElement('div');
    rootDropzone.className = 'cat-dropzone root-dropzone';
    rootDropzone.textContent = 'Déposer ici pour mettre à la racine';
    rootDropzone.dataset.id = ''; // null equivalent

    rootDropzone.addEventListener('dragover', handleDragOver);
    rootDropzone.addEventListener('dragleave', handleDragLeave);
    rootDropzone.addEventListener('drop', (e) => handleDrop(e, null));

    container.appendChild(rootDropzone);

    const buildTree = (parentId, parentElement) => {
        const children = appData.categories.filter(c => c.parentId === parentId);

        if (children.length === 0) return;

        const childrenContainer = document.createElement('div');
        if (parentId) {
            childrenContainer.className = 'cat-children-container';
        }

        children.forEach(cat => {
            const wrapper = document.createElement('div');
            wrapper.className = 'cat-wrapper';

            const el = document.createElement('div');
            el.className = 'cat-item cat-dropzone';
            el.draggable = true;
            el.dataset.id = cat.id;

            el.addEventListener('dragstart', (e) => handleDragStart(e, cat.id));
            el.addEventListener('dragend', handleDragEnd);
            el.addEventListener('dragover', handleDragOver);
            el.addEventListener('dragleave', handleDragLeave);
            el.addEventListener('drop', (e) => handleDrop(e, cat.id));

            const badge = `<span class="cat-type-badge ${cat.type === 'income' ? 'badge-income' : 'badge-expense'}">${cat.type === 'income' ? 'Revenu' : 'Dépense'}</span>`;

            el.innerHTML = `
                <div>
                    <span class="drag-handle">☰</span>
                    <strong>${cat.name}</strong> ${!parentId ? badge : ''}
                </div>
                <button class="btn btn-danger btn-small" onclick="deleteCategory('${cat.id}')">Supprimer</button>
            `;

            wrapper.appendChild(el);
            childrenContainer.appendChild(wrapper);

            // Recursively build children inside this wrapper
            buildTree(cat.id, wrapper);
        });

        parentElement.appendChild(childrenContainer);
    };

    buildTree(null, container);
}

async function deleteCategory(id) {
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
        await saveData();
        updateCategorySelects();
        renderCategoryTree();
    }
}


// --- AUTHENTICATION & INITIALIZATION ---

function showLoginScreen() {
    document.getElementById('login-overlay').classList.add('active');
    document.getElementById('app-content').style.display = 'none';
}

function hideLoginScreen() {
    document.getElementById('login-overlay').classList.remove('active');
    document.getElementById('app-content').style.display = 'block';
}

async function checkLocalDataForMigration() {
    const localDataStr = localStorage.getItem(STORAGE_KEY);
    const hasLocalData = localDataStr !== null;
    const hasBeenMigrated = localStorage.getItem('budget_app_migrated') === 'true';

    if (hasLocalData && !hasBeenMigrated) {
        // Demander si on veut migrer
        document.getElementById('migration-overlay').classList.add('active');

        return new Promise((resolve) => {
            document.getElementById('btn-migrate-yes').onclick = async () => {
                document.getElementById('migration-status').style.display = 'block';
                document.getElementById('migration-status').textContent = 'Migration en cours...';
                document.getElementById('migration-status').className = 'text-green';

                try {
                    const parsedLocal = JSON.parse(localDataStr);
                    // Remplacer appData courant (celui de firestore s'il y en avait, mais logiquement on migre vers un compte vide)
                    if(parsedLocal.spendingGoal) appData.spendingGoal = parsedLocal.spendingGoal;
                    if(parsedLocal.monthlyGoals) appData.monthlyGoals = parsedLocal.monthlyGoals;
                    if(parsedLocal.transactions) appData.transactions = parsedLocal.transactions.map(t => ({ ...t, tagIds: t.tagIds || [] }));
                    if(parsedLocal.subscriptions) appData.subscriptions = parsedLocal.subscriptions;
                    if(parsedLocal.tags) appData.tags = parsedLocal.tags;
                    if(parsedLocal.categories) appData.categories = parsedLocal.categories;

                    await saveData(); // Sauvegarder sur Firebase

                    localStorage.setItem('budget_app_migrated', 'true');
                    document.getElementById('migration-overlay').classList.remove('active');
                    alert("Migration terminée avec succès !");
                    resolve();
                } catch(e) {
                    console.error("Erreur de migration", e);
                    document.getElementById('migration-status').textContent = "Erreur pendant la migration.";
                    document.getElementById('migration-status').className = 'text-red';
                }
            };

            document.getElementById('btn-migrate-no').onclick = () => {
                if(confirm("Toutes les données locales seront ignorées et effacées. Êtes-vous sûr ?")) {
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.setItem('budget_app_migrated', 'true'); // On le marque migré pour ne plus demander
                    document.getElementById('migration-overlay').classList.remove('active');
                    resolve();
                }
            };
        });
    }
}

async function initializeAppAfterAuth() {
    await loadData(); // Load from Firestore
    await checkLocalDataForMigration();

    // Set default dashboard month to current
    const now = new Date();
    document.getElementById('dash-filter-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    updateDashboard(); // Initial render

    // Refresh all views based on new data
    renderTransactions();
    renderSubscriptions();
    processSubscriptions();
    updateCategorySelects();
    renderCategoryTree();

    const goalInput = document.getElementById('setting-spending-goal');
    goalInput.value = appData.spendingGoal;
}

document.addEventListener('DOMContentLoaded', () => {
    // Auth Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            isAuthenticated = true;
            hideLoginScreen();
            await initializeAppAfterAuth();
        } else {
            // User is signed out
            isAuthenticated = false;
            showLoginScreen();
        }
    });

    // Login Form Submit
    const loginForm = document.getElementById('form-login');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = document.getElementById('login-password').value;
        const errP = document.getElementById('login-error');
        errP.style.display = 'none';

        try {
            // Tentative de connexion avec l'email administrateur caché
            await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pwd);
        } catch (error) {
            // Si l'utilisateur n'existe pas, on le crée (c'est la première connexion)
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                 try {
                     await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, pwd);
                 } catch (createError) {
                     console.error("Erreur de création de compte", createError);
                     errP.style.display = 'block';
                     if (createError.code === 'auth/weak-password') {
                         errP.textContent = "Le mot de passe doit faire au moins 6 caractères.";
                     } else if(createError.code === 'auth/operation-not-allowed') {
                         errP.textContent = "L'authentification Email/Mot de passe n'est pas activée sur Firebase.";
                     } else {
                        errP.textContent = "Erreur lors de la création. " + createError.message;
                     }
                 }
            } else {
                console.error("Erreur de connexion", error);
                errP.style.display = 'block';
                if (error.code === 'auth/wrong-password') {
                    errP.textContent = "Mot de passe incorrect.";
                } else {
                    errP.textContent = "Erreur de connexion. " + error.message;
                }
            }
        }
    });

    // Theme switching logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIconLight = document.getElementById('theme-icon-light');
    const themeIconDark = document.getElementById('theme-icon-dark');

    function updateThemeIcons(theme) {
        if (theme === 'dark') {
            themeIconLight.style.display = 'block';
            themeIconDark.style.display = 'none';
        } else {
            themeIconLight.style.display = 'none';
            themeIconDark.style.display = 'block';
        }
    }

    // Load saved theme or check OS preference
    const savedTheme = localStorage.getItem('budget_app_theme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
        updateThemeIcons(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.setAttribute('data-theme', 'dark');
        updateThemeIcons('dark');
    } else {
        updateThemeIcons('light');
    }

    themeToggleBtn.addEventListener('click', () => {
        if (document.body.getAttribute('data-theme') === 'dark') {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('budget_app_theme', 'light');
            updateThemeIcons('light');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('budget_app_theme', 'dark');
            updateThemeIcons('dark');
        }
        updateDashboard(); // Redraw charts with new colors
    });

    document.getElementById('dash-filter-month').addEventListener('change', updateDashboard);

    // Period select listener for horizontal chart
    document.getElementById('chart-period-select').addEventListener('change', () => {
        const dashMonthFilter = document.getElementById('dash-filter-month').value;
        let year, month;
        if (dashMonthFilter) {
            const parts = dashMonthFilter.split('-');
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
        } else {
            const now = new Date();
            year = now.getFullYear();
            month = now.getMonth() + 1;
        }
        updateHorizontalBarChart(year, month);
    });

    // Handle FAB display based on current view
    function updateFabVisibility(targetId) {
        const fab = document.getElementById('fab-add');
        if (targetId === 'transactions' || targetId === 'subscriptions') {
            fab.style.display = 'flex';
        } else {
            fab.style.display = 'none';
        }
    }

    // Listen to tab changes to refresh dashboard
    document.addEventListener('viewChanged', (e) => {
        const targetId = e.detail;
        updateFabVisibility(targetId);

        if(targetId === 'dashboard' || targetId === 'charts') {
            updateDashboard();
        } else if(targetId === 'transactions') {
            renderTransactions();
        } else if(targetId === 'subscriptions') {
            renderSubscriptions();
        } else if(targetId === 'categories') {
            updateCategorySelects();
            renderCategoryTree();
        } else if(targetId === 'tags') {
            renderTagsOverview();
        } else if(targetId === 'savings') {
            renderSavings();
        }
    });

    // Default FAB visibility on load
    updateFabVisibility('dashboard');

    // FAB Logic
    const fabBtn = document.getElementById('fab-add');
    const mobileModal = document.getElementById('mobile-form-modal');
    const mobileModalContainer = document.getElementById('mobile-form-container');
    const btnCloseMobileModal = document.getElementById('btn-close-mobile-modal');
    const modalTitle = document.getElementById('mobile-modal-title');

    // Store original parents to put forms back
    const formOriginalParents = {
        'form-transaction': document.querySelector('#transactions .form-panel'),
        'form-subscription': document.querySelector('#subscriptions .form-panel')
    };

    fabBtn.addEventListener('click', () => {
        // Detect current view
        let activeSection = null;
        document.querySelectorAll('.view-section').forEach(sec => {
            if (sec.classList.contains('active')) {
                activeSection = sec.id;
            }
        });

        if (activeSection === 'transactions') {
            modalTitle.textContent = "Ajouter une transaction";
            mobileModalContainer.appendChild(document.getElementById('form-transaction'));
            resetTransactionForm();
        } else if (activeSection === 'subscriptions') {
            modalTitle.textContent = "Ajouter un abonnement";
            mobileModalContainer.appendChild(document.getElementById('form-subscription'));
            resetSubscriptionForm();
        }

        mobileModal.classList.add('active');
    });

    btnCloseMobileModal.addEventListener('click', () => {
        mobileModal.classList.remove('active');
        // Restore forms to their original locations
        if (document.getElementById('form-transaction').parentElement === mobileModalContainer) {
            formOriginalParents['form-transaction'].appendChild(document.getElementById('form-transaction'));
        }
        if (document.getElementById('form-subscription').parentElement === mobileModalContainer) {
            formOriginalParents['form-subscription'].appendChild(document.getElementById('form-subscription'));
        }
    });

    // Handle Edit button click on mobile to open modal
    const originalEditTransaction = window.editTransaction;
    window.editTransaction = function(id) {
        originalEditTransaction(id);
        if (window.innerWidth <= 768) {
            modalTitle.textContent = "Modifier la transaction";
            mobileModalContainer.appendChild(document.getElementById('form-transaction'));
            mobileModal.classList.add('active');
        }
    };

    const originalEditSubscription = window.editSubscription;
    window.editSubscription = function(id) {
        originalEditSubscription(id);
        if (window.innerWidth <= 768) {
            modalTitle.textContent = "Modifier l'abonnement";
            mobileModalContainer.appendChild(document.getElementById('form-subscription'));
            mobileModal.classList.add('active');
        }
    };

    // Close modal on submit
    document.getElementById('form-transaction').addEventListener('submit', () => {
         if(mobileModal.classList.contains('active')) {
             btnCloseMobileModal.click();
         }
    });
    document.getElementById('form-subscription').addEventListener('submit', () => {
         if(mobileModal.classList.contains('active')) {
             btnCloseMobileModal.click();
         }
    });

    // 2. Navigation Logic
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Allow settings icon click
            const isSettingsIcon = link.getAttribute('data-target') === 'settings';
            const targetId = link.getAttribute('data-target');

            // Update active link for ALL nav links pointing to the same target (desktop + mobile)
            // Exclude icon buttons from active styling logic, but still handle settings properly if needed
            if (!link.classList.contains('icon-btn') || isSettingsIcon) {
                navLinks.forEach(l => {
                    if (l.getAttribute('data-target') === targetId) {
                        l.classList.add('active');
                    } else {
                        // Don't remove active from settings icon btn if it wasn't the one clicked, wait actually we want to highlight active section.
                        l.classList.remove('active');
                    }
                });
            }

            // Update active section
            sections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            // Dispatch event for view change
            document.dispatchEvent(new CustomEvent('viewChanged', { detail: targetId }));
        });
    });

    // 4. Handle Category Form
    document.getElementById('form-category').addEventListener('submit', async (e) => {
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
        await saveData();

        document.getElementById('form-category').reset();
        updateCategorySelects();
        renderCategoryTree();
    });


    // 4.5 Handle Tags creation
    document.getElementById('btn-add-tag').addEventListener('click', async () => {
        const nameInput = document.getElementById('trans-new-tag-name');
        const colorInput = document.getElementById('trans-new-tag-color');

        const name = nameInput.value.trim();
        if (!name) return;

        // Check if exists (case insensitive)
        const exists = appData.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            alert("Ce tag existe déjà !");
            return;
        }

        const newTag = {
            id: 'tag-' + generateId(),
            name: name,
            color: colorInput.value
        };

        appData.tags.push(newTag);

        // Auto select it
        const input = document.getElementById('trans-selected-tags');
        let selectedTags = [];
        try { selectedTags = JSON.parse(input.value); } catch(e) {}
        selectedTags.push(newTag.id);
        input.value = JSON.stringify(selectedTags);

        await saveData();

        nameInput.value = '';
        renderTransactionTagsSelector();
    });

    // 5. Handle Transactions
    document.getElementById('form-transaction').addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = document.getElementById('trans-type').value;
        const amount = parseFloat(document.getElementById('trans-amount').value);
        const date = document.getElementById('trans-date').value;
        const categoryId = document.getElementById('trans-category').value;
        const note = document.getElementById('trans-note').value;
        const transId = document.getElementById('trans-id').value;

        let tagIds = [];
        try {
            tagIds = JSON.parse(document.getElementById('trans-selected-tags').value);
        } catch(e) {}

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
                    note,
                    tagIds
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
                note,
                tagIds
            };
            appData.transactions.push(newTrans);
        }

        await saveData();
        resetTransactionForm();
        renderTransactions();
        updateDashboard();
    });

    document.getElementById('btn-cancel-edit-trans').addEventListener('click', resetTransactionForm);
    document.getElementById('filter-month').addEventListener('change', renderTransactions);
    // Set default date to today
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];


    // 6. Handle Subscriptions
    document.getElementById('form-subscription').addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = document.getElementById('sub-type').value;
        const name = document.getElementById('sub-name').value;
        const amount = parseFloat(document.getElementById('sub-amount').value);
        const categoryId = document.getElementById('sub-category').value;
        const frequency = document.getElementById('sub-frequency').value;
        const startDate = document.getElementById('sub-start-date').value;
        const subId = document.getElementById('sub-id').value;
        const applyToPast = document.getElementById('sub-apply-past').checked;

        if (subId) {
            // Update
            const subIndex = appData.subscriptions.findIndex(s => s.id === subId);
            if (subIndex !== -1) {
                const oldName = appData.subscriptions[subIndex].name;

                appData.subscriptions[subIndex] = {
                    ...appData.subscriptions[subIndex],
                    type,
                    name,
                    amount,
                    categoryId,
                    frequency,
                    // Note: If they changed start date and we need to retroactively change nextDate, it's tricky, we'll just leave nextDate as is or reset if they moved start date far in future
                };

                // Apply changes to past transactions (Option A)
                if (applyToPast) {
                    appData.transactions.forEach(t => {
                        if (t.subscriptionId === subId || (t.note && t.note.includes(`[Auto] ${oldName}`))) {
                            t.type = type;
                            t.amount = amount;
                            t.categoryId = categoryId;
                            t.note = `[Auto] ${name}`;
                            // Dates are untouched
                        }
                    });
                }
            }
        } else {
            // Add new
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
        }

        await saveData();
        resetSubscriptionForm();
        renderSubscriptions();
        processSubscriptions(); // Au cas où la date de début est déjà passée, on génère la transaction de suite

        // Also refresh transactions to reflect any retroactive changes
        renderTransactions();
        updateDashboard();
    });

    document.getElementById('btn-cancel-edit-sub').addEventListener('click', resetSubscriptionForm);
    document.getElementById('sub-start-date').value = new Date().toISOString().split('T')[0];


    // 7. Settings - Spending Goal
    const settingsMonthInput = document.getElementById('setting-spending-month');
    const settingsGoalInput = document.getElementById('setting-spending-goal');

    settingsMonthInput.addEventListener('change', () => {
        const selectedMonth = settingsMonthInput.value;
        if (selectedMonth && appData.monthlyGoals && appData.monthlyGoals[selectedMonth] !== undefined) {
            settingsGoalInput.value = appData.monthlyGoals[selectedMonth];
        } else {
            settingsGoalInput.value = appData.spendingGoal;
        }
    });

    document.getElementById('form-settings-goal').addEventListener('submit', async (e) => {
        e.preventDefault();
        const goalValue = parseFloat(settingsGoalInput.value);
        const selectedMonth = settingsMonthInput.value;

        if (selectedMonth) {
            if (!appData.monthlyGoals) appData.monthlyGoals = {};
            appData.monthlyGoals[selectedMonth] = goalValue;
            alert(`Objectif de dépense mis à jour pour le mois de ${selectedMonth} !`);
        } else {
            appData.spendingGoal = goalValue;
            alert("Objectif de dépense par défaut mis à jour !");
        }

        await saveData();
        updateDashboard();
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
        reader.onload = async function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if(importedData.categories && importedData.transactions) {
                    appData = importedData;
                    await saveData();
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

    document.getElementById('btn-reset').addEventListener('click', async () => {
        if(confirm("Êtes-vous sûr de vouloir tout effacer ? Cette action est irréversible.")) {
            // Effacer localStorage
            localStorage.removeItem(STORAGE_KEY);
            // Remettre à zéro Firestore
            appData = {
                spendingGoal: 600,
                monthlyGoals: {},
                transactions: [],
                subscriptions: [],
                tags: [],
                categories: []
            };
            await saveData();
            location.reload();
        }
    });
});

// --- MODAL GENERIQUE ---
function openDataModal(title, transactions, totalAmount, totalType = 'expense') {
    document.getElementById('data-modal-title').textContent = title;

    const totalSpan = document.getElementById('data-modal-total');
    const prefixStr = totalType === 'income' ? '+' : '-';
    totalSpan.textContent = prefixStr + totalAmount.toFixed(2) + ' €';
    totalSpan.className = totalType === 'income' ? 'text-green' : 'text-red';

    const tbody = document.querySelector('#table-modal-transactions tbody');
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucune transaction trouvée.</td></tr>';
    } else {
        transactions.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'clickable-row';
            tr.onclick = () => {
                closeDataModal();
                // Navigate to transactions and edit
                document.querySelector('.nav-link[data-target="transactions"]').click();
                editTransaction(t.id);
            };
            const catName = getCategoryPath(t.categoryId);

            tr.innerHTML = `
                <td data-label="Date">${t.date}</td>
                <td data-label="Type"><span class="${t.type === 'income' ? 'text-green' : 'text-red'}">${t.type === 'income' ? 'Revenu' : 'Dépense'}</span></td>
                <td data-label="Catégorie">${catName}</td>
                <td data-label="Note">${t.note || ''}</td>
                <td data-label="Montant" class="${t.type === 'income' ? 'text-green' : 'text-red'}">${t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)} €</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('data-modal-overlay').classList.add('active');
}

function closeDataModal() {
    document.getElementById('data-modal-overlay').classList.remove('active');
}

document.getElementById('btn-close-modal').addEventListener('click', closeDataModal);

// Close modal on click outside
document.getElementById('data-modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('data-modal-overlay')) {
        closeDataModal();
    }
});

// Exposer les fonctions au contexte global (car module)
window.deleteTransaction = deleteTransaction;
window.editTransaction = editTransaction;
window.deleteSubscription = deleteSubscription;
window.editSubscription = editSubscription;
window.viewSubscriptionHistory = viewSubscriptionHistory;
window.deleteCategory = deleteCategory;
// --- TAGS OVERVIEW ---
function renderTagsOverview() {
    const tbody = document.querySelector('#table-tags-overview tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (appData.tags.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucun tag créé pour le moment. Vous pouvez en créer un lors de l\'ajout d\'une transaction.</td></tr>';
        return;
    }

    appData.tags.forEach(tag => {
        let income = 0;
        let expense = 0;

        appData.transactions.forEach(t => {
            if (t.tagIds && t.tagIds.includes(tag.id)) {
                if (t.type === 'income') income += t.amount;
                else expense += t.amount;
            }
        });

        const balance = income - expense;
        const balanceClass = balance >= 0 ? 'text-green' : 'text-red';
        const balanceSign = balance >= 0 ? '+' : '';

        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td data-label="Tag">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="color" value="${tag.color}" onchange="updateTagColor('${tag.id}', this.value)" style="width: 25px; height: 25px; padding: 0; border: none; border-radius: 4px; cursor: pointer;" title="Changer la couleur">
                    <span class="tag-chip"><span class="tag-dot" style="background-color: ${tag.color};"></span>${tag.name}</span>
                </div>
            </td>
            <td data-label="Revenus Totaux" class="text-green">+${income.toFixed(2)} €</td>
            <td data-label="Dépenses Totales" class="text-red">-${expense.toFixed(2)} €</td>
            <td data-label="Bilan" class="${balanceClass}">${balanceSign}${balance.toFixed(2)} €</td>
            <td data-label="Actions">
                <button class="btn btn-primary btn-small" onclick="viewTagHistory('${tag.id}')">Historique</button>
                <button class="btn btn-secondary btn-small" onclick="renameTagPrompt('${tag.id}')">Renommer</button>
                <button class="btn btn-danger btn-small" onclick="deleteTag('${tag.id}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function viewTagHistory(tagId) {
    const tag = appData.tags.find(t => t.id === tagId);
    if (!tag) return;

    const trans = appData.transactions.filter(t => t.tagIds && t.tagIds.includes(tagId));
    trans.sort((a, b) => new Date(b.date) - new Date(a.date));

    let total = 0;
    trans.forEach(t => {
        if(t.type === 'expense') total -= t.amount;
        else total += t.amount;
    });

    // openDataModal prend (title, transactions, totalAmount, totalType)
    // Ici total peut être positif ou négatif, on adapte
    const totalType = total >= 0 ? 'income' : 'expense';
    openDataModal(`Historique du tag : ${tag.name}`, trans, Math.abs(total), totalType);
}

async function updateTagColor(tagId, newColor) {
    const tag = appData.tags.find(t => t.id === tagId);
    if (tag) {
        tag.color = newColor;
        await saveData();
        renderTagsOverview(); // Mettre à jour la vue des tags
        renderTransactions(); // Mettre à jour l'historique des transactions
        renderTransactionTagsSelector(); // Mettre à jour le formulaire
        updateFilterChips();
    }
}

async function renameTagPrompt(tagId) {
    const tag = appData.tags.find(t => t.id === tagId);
    if (!tag) return;

    const newName = prompt("Nouveau nom pour le tag :", tag.name);
    if (newName && newName.trim() !== "") {
        // Vérifier doublon
        const exists = appData.tags.find(t => t.id !== tagId && t.name.toLowerCase() === newName.trim().toLowerCase());
        if(exists) {
            alert("Un autre tag porte déjà ce nom.");
            return;
        }
        tag.name = newName.trim();
        await saveData();
        renderTagsOverview();
        renderTransactions();
        renderTransactionTagsSelector();
        updateFilterChips();
    }
}

async function deleteTag(tagId) {
    if (confirm("Voulez-vous vraiment supprimer ce tag ? Il sera retiré de toutes les transactions (les transactions elles-mêmes ne seront pas supprimées).")) {
        // Retirer le tag de toutes les transactions
        appData.transactions.forEach(t => {
            if (t.tagIds) {
                t.tagIds = t.tagIds.filter(id => id !== tagId);
            }
        });

        // Supprimer le tag de la liste
        appData.tags = appData.tags.filter(t => t.id !== tagId);

        // Mettre à jour les filtres si le tag supprimé était sélectionné
        currentTransactionTagFilters = currentTransactionTagFilters.filter(id => id !== tagId);

        await saveData();
        renderTagsOverview();
        renderTransactions();
        renderTransactionTagsSelector();
    }
}

window.updateTagColor = updateTagColor;
window.renameTagPrompt = renameTagPrompt;
window.deleteTag = deleteTag;
window.viewTagHistory = viewTagHistory;

window.openDataModal = openDataModal;
window.setTransactionFilter = setTransactionFilter;
