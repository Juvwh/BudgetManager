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
window.appData = window.appData || {
    spendingGoal: 600,
    monthlyGoals: {},
    transactions: [],
    subscriptions: [],
    tags: [],
    simulations: [],
    simulationBalance: 0,
    mealVoucherCredits: [],
    mealVoucherExpenses: [],
    mealVouchersEnabled: false,
    mealVoucherEligibleCategories: [],
    mealVoucherExpectedMonthlyAmount: 0,
    investments: [],
    investmentsEnabled: true,
    trips: [],
    tripCategories: [],
    tripsSeeded: false,
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

// Variables pour les modes de sélection
window.isCategorySelectionMode = false;
window.selectedCategories = new Set();
window.isTransactionSelectionMode = false;
window.selectedTransactionIds = new Set();

// Helper pour retirer les valeurs undefined avant l'envoi vers Firestore
function cleanDataForFirestore(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(cleanDataForFirestore);
    }

    const cleaned = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (obj[key] !== undefined) {
                cleaned[key] = cleanDataForFirestore(obj[key]);
            }
        }
    }
    return cleaned;
}

async function saveData() {
    if (!isAuthenticated) return; // Ne pas sauvegarder si pas connecté

    try {
        const userDocRef = doc(db, "users", "admin");

        const dataToSave = {
            spendingGoal: appData.spendingGoal,
            monthlyGoals: appData.monthlyGoals || {},
            transactions: appData.transactions,
            subscriptions: appData.subscriptions,
            tags: appData.tags || [],
            simulations: appData.simulations || [],
            simulationBalance: appData.simulationBalance || 0,
            categories: appData.categories,
            mealVouchersEnabled: appData.mealVouchersEnabled || false,
            mealVoucherEligibleCategories: appData.mealVoucherEligibleCategories || [],
            mealVoucherExpectedMonthlyAmount: appData.mealVoucherExpectedMonthlyAmount || 0,
            mealVoucherCredits: appData.mealVoucherCredits || [],
            mealVoucherExpenses: appData.mealVoucherExpenses || [],
            investments: appData.investments || [],
            investmentsEnabled: appData.investmentsEnabled !== undefined ? appData.investmentsEnabled : true,
            trips: appData.trips || [],
            tripCategories: appData.tripCategories || [],
            tripsSeeded: appData.tripsSeeded || false,
            updatedAt: new Date().toISOString()
        };

        // Firestore rejette les valeurs `undefined`
        const cleanedData = cleanDataForFirestore(dataToSave);

        await setDoc(userDocRef, cleanedData);
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
            if(parsed.simulations) appData.simulations = parsed.simulations;
            if(parsed.simulationBalance !== undefined) appData.simulationBalance = parsed.simulationBalance;
            if(parsed.categories) appData.categories = parsed.categories;

            if(parsed.mealVouchersEnabled !== undefined) appData.mealVouchersEnabled = parsed.mealVouchersEnabled;
            if(parsed.mealVoucherEligibleCategories) appData.mealVoucherEligibleCategories = parsed.mealVoucherEligibleCategories;
            if(parsed.mealVoucherExpectedMonthlyAmount !== undefined) appData.mealVoucherExpectedMonthlyAmount = parsed.mealVoucherExpectedMonthlyAmount;
            if(parsed.mealVoucherCredits) appData.mealVoucherCredits = parsed.mealVoucherCredits;
            if(parsed.mealVoucherExpenses) appData.mealVoucherExpenses = parsed.mealVoucherExpenses;

            if(parsed.investments) appData.investments = parsed.investments;
            if(parsed.investmentsEnabled !== undefined) appData.investmentsEnabled = parsed.investmentsEnabled;

            // Vacances (module independant du budget)
            if(parsed.trips) appData.trips = parsed.trips;
            if(parsed.tripCategories) appData.tripCategories = parsed.tripCategories;
            if(parsed.tripsSeeded !== undefined) appData.tripsSeeded = parsed.tripsSeeded;
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
let currentCategoryFilter = '';
let currentTransactionTagFilters = [];
let currentTransactionSearch = '';

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

function updateTransactionSelectionTotal() {
    const totalSpan = document.getElementById('transaction-selection-total');
    if (!totalSpan) return;

    let total = 0;
    selectedTransactionIds.forEach(id => {
        const t = appData.transactions.find(t => t.id === id);
        if (t && !isNaN(t.amount)) {
            // Expenses negative, Incomes/Salaries positive
            if (t.type === 'expense') {
                total -= Number(t.amount);
            } else {
                total += Number(t.amount);
            }
        }
    });

    totalSpan.textContent = total.toFixed(2);
}

function renderTransactions() {
    const list = document.getElementById('transactions-list');
    if (!list) return;
    list.innerHTML = '';

    const filterMonth = document.getElementById('filter-month').value;

    // Remboursements rattachés à une dépense
    const refundsByExpense = {};
    const refundLinks = {};
    appData.transactions.forEach(t => {
        if (t.type === 'income' && t.linkedExpenseId) {
            refundsByExpense[t.linkedExpenseId] = (refundsByExpense[t.linkedExpenseId] || 0) + t.amount;
            refundLinks[t.id] = t.linkedExpenseId;
        }
    });

    let filteredTrans = appData.transactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filterMonth) {
        filteredTrans = filteredTrans.filter(t => t.date && t.date.startsWith(filterMonth));
    }

    if (currentTransactionFilter === 'income') {
        filteredTrans = filteredTrans.filter(t => t.type === 'income');
    } else if (currentTransactionFilter === 'expense') {
        filteredTrans = filteredTrans.filter(t => t.type === 'expense');
    } else if (currentTransactionFilter === 'salary') {
        filteredTrans = filteredTrans.filter(t => t.type === 'salary');
    }

    if (currentCategoryFilter) {
        // La catégorie choisie inclut ses sous-catégories, à tous les niveaux
        const matchesCategory = (categoryId) => {
            let cursor = appData.categories.find(c => c.id === categoryId);
            const guard = new Set();
            while (cursor && !guard.has(cursor.id)) {
                if (cursor.id === currentCategoryFilter) return true;
                guard.add(cursor.id);
                cursor = appData.categories.find(c => c.id === cursor.parentId);
            }
            return false;
        };
        filteredTrans = filteredTrans.filter(t => matchesCategory(t.categoryId));
    }

    if (currentTransactionTagFilters.length > 0) {
        filteredTrans = filteredTrans.filter(t => {
            if (!t.tagIds) return false;
            return currentTransactionTagFilters.some(filterTagId => t.tagIds.includes(filterTagId));
        });
    }

    if (currentTransactionSearch) {
        // Recherche sur le titre de la transaction, insensible à la casse et aux accents
        const needle = normalizeSearchText(currentTransactionSearch);
        filteredTrans = filteredTrans.filter(t => normalizeSearchText(t.note || '').includes(needle));
    }

    // Compteur + total filtré
    const counter = document.getElementById('transactions-count');
    if (counter) {
        const net = filteredTrans.reduce((sum, t) => {
            if (t.type === 'expense' || t.type === 'investment_transfer') return sum - (Number(t.amount) || 0);
            return sum + (Number(t.amount) || 0);
        }, 0);
        counter.textContent = filteredTrans.length + (filteredTrans.length > 1 ? ' transactions · ' : ' transaction · ')
            + (net >= 0 ? '+' : '-') + Math.abs(net).toFixed(2) + ' €';
    }

    if (filteredTrans.length === 0) {
        list.innerHTML = '<div class="feed-empty">Aucune transaction pour ces filtres.</div>';
        updateFilterChips();
        return;
    }

    // Regroupement par jour
    const groups = [];
    const byDate = {};
    filteredTrans.forEach(t => {
        const key = t.date || 'inconnu';
        if (!byDate[key]) { byDate[key] = []; groups.push(key); }
        byDate[key].push(t);
    });

    const ICONS = {
        edit: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        refund: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
        del: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
    };

    const TYPE_LABELS = {
        expense: 'Dépense', income: 'Revenu', salary: 'Salaire',
        investment_transfer: 'Transfert', investment_return: 'Retour'
    };

    groups.forEach(dateKey => {
        const items = byDate[dateKey];

        // Solde du jour
        const dayNet = items.reduce((sum, t) => {
            if (t.type === 'expense' || t.type === 'investment_transfer') return sum - (Number(t.amount) || 0);
            return sum + (Number(t.amount) || 0);
        }, 0);

        let dayLabel = 'Date inconnue';
        if (dateKey !== 'inconnu') {
            const d = new Date(dateKey);
            if (!isNaN(d.getTime())) {
                dayLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                dayLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
            }
        }

        const group = document.createElement('div');
        group.className = 'txn-group';
        const body = document.createElement('div');
        body.className = 'txn-group-body';
        const head = document.createElement('div');
        head.className = 'txn-day';
        head.innerHTML = '<span>' + dayLabel + '</span>'
            + (items.length > 1
                ? '<span class="txn-day-total ' + (dayNet >= 0 ? 'text-green' : 'text-red') + '">'
                  + (dayNet >= 0 ? '+' : '-') + Math.abs(dayNet).toFixed(2) + ' €</span>'
                : '');
        group.appendChild(head);

        items.forEach(t => {
            const isCorrupted = isNaN(t.amount) || t.amount === null || t.amount === undefined || !t.date;
            const isIncome = t.type === 'income' || t.type === 'salary' || t.type === 'investment_return';
            const catName = getCategoryPath(t.categoryId);

            const row = document.createElement('div');
            row.className = 'txn-row' + (isCorrupted ? ' is-corrupted' : '');
            row.dataset.id = t.id;
            row.ondblclick = () => editTransaction(t.id);

            // Colonne de gauche : case à cocher ou pastille
            let leadHtml;
            if (isTransactionSelectionMode) {
                const checked = selectedTransactionIds.has(t.id) ? 'checked' : '';
                leadHtml = '<input type="checkbox" class="transaction-checkbox" data-id="' + t.id + '" ' + checked + '>';
            } else {
                // Rouge = dépense, vert = revenu, bleu = salaire
                let cls = 'is-out';
                if (t.type === 'salary') cls = 'is-salary';
                else if (isIncome) cls = 'is-in';
                leadHtml = '<span class="txn-dot ' + cls + '" aria-hidden="true"></span>';
            }

            // Titre + sous-titre
            const title = t.note ? t.note : catName;
            let subParts = [];
            if (t.note) subParts.push(catName);
            const typeLabel = TYPE_LABELS[t.type] || t.type;
            // "Dépense"/"Revenu" sont déjà lisibles au signe et à la couleur du montant
            if (t.type !== 'expense' && t.type !== 'income' && typeLabel !== catName) {
                subParts.push(typeLabel);
            }
            if (subParts.length === 0) subParts.push(catName);
            if (refundLinks[t.id]) {
                const linkedExp = appData.transactions.find(x => x.id === refundLinks[t.id]);
                if (linkedExp) subParts.push('remboursement de ' + (linkedExp.note || getCategoryPath(linkedExp.categoryId)));
            }

            let tagsHtml = '';
            if (t.tagIds && t.tagIds.length > 0) {
                t.tagIds.forEach(tagId => {
                    const tag = appData.tags.find(g => g.id === tagId);
                    if (tag) {
                        tagsHtml += '<span class="tag-chip tag-display"><span class="tag-dot" style="background-color:' + tag.color + '"></span>' + tag.name + '</span>';
                    }
                });
            }

            // Montant et détails
            let amountHtml;
            let extras = [];
            if (isCorrupted) {
                amountHtml = '<span class="text-red">Erreur (NaN)</span>';
            } else {
                const sign = isIncome ? '+' : '-';
                amountHtml = '<span class="' + (isIncome ? 'text-green' : 'text-red') + '">' + sign + Number(t.amount).toFixed(2) + ' €</span>';

                if (t.type === 'salary' && t.savedAmount) {
                    extras.push('épargné ' + Number(t.savedAmount).toFixed(2) + ' €');
                }
                if (t.type === 'expense' && t.mealVoucherPart > 0) {
                    extras.push('dont ' + Number(t.mealVoucherPart).toFixed(2) + ' € en CR');
                }
                if (t.type === 'expense' && refundsByExpense[t.id]) {
                    const remains = Math.max(0, t.amount - refundsByExpense[t.id]);
                    extras.push('reste à charge ' + remains.toFixed(2) + ' €');
                }
            }

            row.innerHTML =
                '<div class="txn-lead">' + leadHtml + '</div>' +
                '<div class="txn-main">' +
                    '<div class="txn-title">' + title + (isCorrupted ? ' <span class="cat-type-badge badge-expense">Corrompu</span>' : '') + '</div>' +
                    '<div class="txn-sub">' + subParts.join(' · ') + '</div>' +
                    (tagsHtml ? '<div class="txn-tags">' + tagsHtml + '</div>' : '') +
                '</div>' +
                '<div class="txn-right">' +
                    '<div class="txn-amount">' + amountHtml + '</div>' +
                    (extras.length ? '<div class="txn-extra">' + extras.join(' · ') + '</div>' : '') +
                '</div>' +
                '<div class="txn-actions">' +
                    '<button class="icon-action" title="Modifier" aria-label="Modifier" data-action="edit">' + ICONS.edit + '</button>' +
                    (t.type === 'expense' ? '<button class="icon-action is-refund" title="Ajouter un remboursement" aria-label="Remboursement" data-action="refund">' + ICONS.refund + '</button>' : '') +
                    '<button class="icon-action is-delete" title="Supprimer" aria-label="Supprimer" data-action="delete">' + ICONS.del + '</button>' +
                '</div>';

            row.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.getAttribute('data-action');
                    if (action === 'edit') editTransaction(t.id);
                    else if (action === 'refund') addRefund(t.id);
                    else if (action === 'delete') deleteTransaction(t.id);
                });
            });

            const checkbox = row.querySelector('.transaction-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) selectedTransactionIds.add(t.id);
                    else selectedTransactionIds.delete(t.id);
                    row.classList.toggle('is-selected', e.target.checked);
                    updateTransactionSelectionTotal();
                });
                if (checkbox.checked) row.classList.add('is-selected');
            }

            body.appendChild(row);
        });

        group.appendChild(body);
        list.appendChild(group);
    });

    updateFilterChips();
}

function setTransactionFilter(filter) {
    // Les catégories et les types sont deux filtres indépendants qui se cumulent
    if (typeof filter === 'string' && filter.startsWith('cat-')) {
        currentCategoryFilter = currentCategoryFilter === filter ? '' : filter;
    } else {
        currentTransactionFilter = filter;
    }
    renderTransactions();
}

function setCategoryFilter(categoryId) {
    currentCategoryFilter = categoryId || '';
    renderTransactions();
}

function clearTransactionFilters() {
    currentTransactionFilter = 'all';
    currentCategoryFilter = '';
    currentTransactionTagFilters = [];
    currentTransactionSearch = '';
    const month = document.getElementById('filter-month');
    if (month) month.value = '';
    const search = document.getElementById('filter-search');
    if (search) search.value = '';
    renderTransactions();
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
}

function setTransactionSearch(value) {
    currentTransactionSearch = value || '';
    renderTransactions();
}

function updateFilterChips() {
    // --- Recherche par titre ---
    const searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.classList.toggle('is-active', !!currentTransactionSearch);

    // --- Type (contrôle segmenté) ---
    document.querySelectorAll('#type-filters .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === currentTransactionFilter);
    });

    // --- Catégorie (liste déroulante) ---
    const catSelect = document.getElementById('filter-category');
    if (catSelect) {
        const mainCategories = appData.categories.filter(c => c.parentId === null);
        const wanted = '<option value="">Toutes les catégories</option>'
            + mainCategories.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');
        if (catSelect.dataset.signature !== wanted) {
            catSelect.innerHTML = wanted;
            catSelect.dataset.signature = wanted;
        }
        catSelect.value = currentCategoryFilter || '';
        catSelect.classList.toggle('is-active', !!currentCategoryFilter);
    }

    // --- Tags (menu déroulant à cocher) ---
    const tagsContainer = document.getElementById('tag-filters');
    if (tagsContainer) {
        tagsContainer.innerHTML = appData.tags.map(tag => {
            const isSelected = currentTransactionTagFilters.includes(tag.id);
            return '<button type="button" class="btn btn-small filter-chip tag-filter-chip ' + (isSelected ? 'active' : '') + '"'
                + ' onclick="toggleTransactionTagFilter(\'' + tag.id + '\')">'
                + '<span class="tag-dot" style="background-color: ' + tag.color + ';"></span>' + tag.name + '</button>';
        }).join('') || '<span class="muted">Aucun tag pour le moment.</span>';
    }

    const tagCount = document.getElementById('tag-filter-count');
    if (tagCount) {
        tagCount.textContent = currentTransactionTagFilters.length;
        tagCount.style.display = currentTransactionTagFilters.length ? 'inline-flex' : 'none';
    }
    const tagBtn = document.getElementById('btn-tag-filter');
    if (tagBtn) tagBtn.classList.toggle('is-active', currentTransactionTagFilters.length > 0);

    // --- Bouton de réinitialisation ---
    const clearBtn = document.getElementById('btn-clear-filters');
    if (clearBtn) {
        const monthValue = (document.getElementById('filter-month') || {}).value;
        const dirty = currentTransactionFilter !== 'all' || !!currentCategoryFilter
            || currentTransactionTagFilters.length > 0 || !!monthValue || !!currentTransactionSearch;
        clearBtn.style.display = dirty ? 'inline-flex' : 'none';
    }
}

window.addRefund = function(expenseId) {
    const expense = appData.transactions.find(t => t.id === expenseId);
    if (!expense) return;

    // Detect current view
    let activeSection = null;
    document.querySelectorAll('.view-section').forEach(sec => {
        if (sec.classList.contains('active')) {
            activeSection = sec.id;
        }
    });

    if (activeSection === 'transactions') {
        const modalTitle = document.getElementById('mobile-modal-title');
        const mobileModal = document.getElementById('mobile-form-modal');
        const mobileModalContainer = document.getElementById('mobile-form-container');
        const formOriginalParents = {
            'form-transaction': document.querySelector('#transactions .form-panel'),
            'form-subscription': document.querySelector('#subscriptions .form-panel')
        };

        if (window.innerWidth <= 768) {
            modalTitle.textContent = "Ajouter un remboursement";
            if (formOriginalParents['form-transaction'].parentElement !== mobileModalContainer) {
                mobileModalContainer.appendChild(formOriginalParents['form-transaction']);
            }
            mobileModal.classList.add('active');
        } else {
            // Desktop
            openEditModal('form-transaction', "Ajouter un remboursement");
        }
    }

    resetTransactionForm();

    // Set form to income
    document.getElementById('trans-type').value = 'income';
    document.getElementById('trans-type').dispatchEvent(new Event('change'));

    // Pre-fill fields
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];

    // We cannot pre-fill with an expense category since the type is now 'income'.
    // We'll leave it blank or let the user choose an appropriate income category.
    document.getElementById('trans-category').value = '';

    document.getElementById('trans-note').value = `Remboursement: ${expense.note || getCategoryPath(expense.categoryId)}`;

    // Wait slightly for DOM to update from the 'change' event to set linked expense
    setTimeout(() => {
        // Create a fake option if it doesn't exist so it can be selected immediately
        // The real list is populated asynchronously or might not contain it if > 6 months
        const select = document.getElementById('trans-linked-expense');
        if (!Array.from(select.options).some(opt => opt.value === expenseId)) {
            const opt = document.createElement('option');
            opt.value = expenseId;
            opt.textContent = `${expense.date} - ${getCategoryPath(expense.categoryId)} - ${expense.note ? expense.note + ' - ' : ''}${expense.amount.toFixed(2)}€`;
            select.appendChild(opt);
        }
        select.value = expenseId;

        // Optionally pre-fill amount with the remaining unrefunded amount
        const effectiveTrans = getEffectiveTransactions();
        const effectiveExp = effectiveTrans.find(t => t.id === expenseId);
        if (effectiveExp) {
            document.getElementById('trans-amount').value = effectiveExp.amount.toFixed(2);
        } else {
            document.getElementById('trans-amount').value = expense.amount.toFixed(2);
        }
    }, 100);
}

async function deleteTransaction(id) {
    if (confirm("Supprimer cette transaction ?")) {
        // Also remove linkedExpenseId from any refunds that were linked to this expense
        appData.transactions.forEach(t => {
            if (t.linkedExpenseId === id) {
                delete t.linkedExpenseId;
            }
        });

        appData.transactions = appData.transactions.filter(t => t.id !== id);
        if(typeof updateInvestmentsStatus === 'function') updateInvestmentsStatus();
        await saveData();
        renderTransactions();
        updateDashboard();
    }
}

// Helper to move form into edit modal
function openEditModal(formId, title) {
    const editModal = document.getElementById('edit-modal-overlay');
    const editModalContainer = document.getElementById('edit-modal-container');
    const modalTitle = document.getElementById('edit-modal-title');
    const formElement = document.getElementById(formId);

    // Save original parent
    if (!formElement.dataset.originalParentId) {
        formElement.dataset.originalParentId = formElement.parentElement.className;
        formElement.originalParent = formElement.parentElement;
    }

    modalTitle.textContent = title;
    editModalContainer.innerHTML = '';
    editModalContainer.appendChild(formElement);
    editModal.classList.add('active');
}

window.closeEditModal = function() {
    const editModal = document.getElementById('edit-modal-overlay');
    const editModalContainer = document.getElementById('edit-modal-container');
    const formElement = editModalContainer.querySelector('form');

    if (formElement && formElement.originalParent) {
        formElement.originalParent.appendChild(formElement);
    }

    editModal.classList.remove('active');

    // Reset forms after closing modal
    if (formElement && formElement.id === 'form-transaction') {
        resetTransactionForm();
    } else if (formElement && formElement.id === 'form-subscription') {
        resetSubscriptionForm();
    }
};

function editTransaction(id) {
    const trans = appData.transactions.find(t => t.id === id);
    if (!trans) return;

    // Remplir le formulaire
    document.getElementById('trans-id').value = trans.id;
    document.getElementById('trans-type').value = trans.type;
    document.getElementById('trans-type').dispatchEvent(new Event('change')); // Mettre à jour les catégories
    document.getElementById('trans-amount').value = trans.amount;
    if (trans.type === 'salary') {
        document.getElementById('trans-savings-amount').value = trans.savedAmount || 0;
    }
    document.getElementById('trans-date').value = trans.date;
    document.getElementById('trans-category').value = trans.categoryId;
    document.getElementById('trans-note').value = trans.note || '';

    document.getElementById('trans-category').dispatchEvent(new Event('change')); // Mettre à jour les champs MV
    if (trans.mealVoucherPart > 0) {
        document.getElementById('trans-mv-part').value = trans.mealVoucherPart;
    } else {
        document.getElementById('trans-mv-part').value = '';
    }

    if (trans.type === 'investment_transfer' || trans.type === 'investment_return') {
        document.getElementById('trans-investment-id').value = trans.investmentId || '';
        document.getElementById('trans-investment-id').dispatchEvent(new Event('change'));
    }

    // Gérer les tags
    document.getElementById('trans-selected-tags').value = JSON.stringify(trans.tagIds || []);
    renderTransactionTagsSelector();

    if (trans.type === 'income' && trans.linkedExpenseId) {
        document.getElementById('trans-linked-expense').value = trans.linkedExpenseId;
    } else {
        document.getElementById('trans-linked-expense').value = '';
    }

    // Changer l'état des boutons
    document.getElementById('btn-submit-trans').textContent = "Mettre à jour";
    document.getElementById('btn-cancel-edit-trans').style.display = 'none'; // Pas besoin dans la modale, on a la croix

    openEditModal('form-transaction', "Modifier la transaction");
}

function resetTransactionForm() {
    const form = document.getElementById('form-transaction');
    if (!form) return;
    form.reset();
    document.getElementById('trans-id').value = '';
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('trans-type').value = 'expense';
    document.getElementById('trans-type').dispatchEvent(new Event('change'));

    document.getElementById('trans-selected-tags').value = '[]';
    renderTransactionTagsSelector();

    document.getElementById('btn-submit-trans').textContent = "Ajouter";
    const cancelBtn = document.getElementById('btn-cancel-edit-trans');
    if (cancelBtn) cancelBtn.style.display = 'none';
    document.getElementById('trans-mv-part').value = '';
    document.getElementById('trans-linked-expense').value = '';
    document.getElementById('trans-investment-id').value = '';
    document.getElementById('trans-investment-name').value = '';
    document.getElementById('trans-investment-type').value = 'metaux';
    document.getElementById('trans-investment-id').dispatchEvent(new Event('change'));
    document.getElementById('trans-category').dispatchEvent(new Event('change'));
}

// --- SUBSCRIPTIONS MANAGEMENT ---
function getNextDate(dateStr, frequency) {
    const d = new Date(dateStr);
    if (frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'monthly' || frequency === 'installments') d.setMonth(d.getMonth() + 1);
    else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
}

async function processSubscriptions() {
    let hasNewTransactions = false;
    const today = new Date().toISOString().split('T')[0];

    appData.subscriptions.forEach(sub => {
        if (sub.status === 'completed') return;

        let nextDate = sub.nextDate || sub.startDate;

        while (nextDate <= today) {
            // Check end date condition
            if (sub.endDate && nextDate > sub.endDate) {
                sub.status = 'completed';
                break;
            }

            // Generate a transaction
            let note = `[Auto] ${sub.name}`;

            if (sub.frequency === 'installments') {
                const currentPaid = (sub.installmentsPaid || 0) + 1;
                note += ` (Mois ${currentPaid}/${sub.totalInstallments})`;
                sub.installmentsPaid = currentPaid;
            }

            appData.transactions.push({
                id: 'trans-auto-' + generateId(),
                type: sub.type,
                amount: sub.amount,
                date: nextDate,
                categoryId: sub.categoryId,
                note: note,
                subscriptionId: sub.id
            });
            hasNewTransactions = true;

            // Check if installments are finished
            if (sub.frequency === 'installments' && sub.installmentsPaid >= sub.totalInstallments) {
                 sub.status = 'completed';
                 break; // Stop generating more for this subscription
            }

            // Advance next date
            nextDate = getNextDate(nextDate, sub.frequency);
            sub.nextDate = nextDate;
        }

        // Final check for end date exactly matching today and we just processed it
        if (sub.status !== 'completed' && sub.endDate && sub.nextDate > sub.endDate) {
             sub.status = 'completed';
        }
    });

    if (hasNewTransactions) {
        await saveData();
        renderTransactions();
        updateDashboard();
    }
}

function renderSubscriptions() {
    const list = document.getElementById('subscriptions-list');
    if (!list) return;
    list.innerHTML = '';

    const sortedSubs = [...appData.subscriptions].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        const da = a.nextDate || a.startDate || '';
        const db = b.nextDate || b.startDate || '';
        return da < db ? -1 : (da > db ? 1 : 0);
    });

    // Bandeau de synthèse : poids mensuel des récurrences
    const summaryEl = document.getElementById('subscriptions-summary');
    if (summaryEl) {
        let monthlyExpense = 0;
        let monthlyIncome = 0;
        appData.subscriptions.forEach(sub => {
            if (sub.status === 'completed') return;
            const amount = Number(sub.amount) || 0;
            let perMonth = amount;
            if (sub.frequency === 'weekly') perMonth = amount * 52 / 12;
            else if (sub.frequency === 'yearly') perMonth = amount / 12;
            if (sub.type === 'income') monthlyIncome += perMonth;
            else monthlyExpense += perMonth;
        });
        summaryEl.textContent = '-' + monthlyExpense.toFixed(2) + ' € / mois'
            + (monthlyIncome > 0 ? '  ·  +' + monthlyIncome.toFixed(2) + ' € / mois' : '');
    }

    if (sortedSubs.length === 0) {
        list.innerHTML = '<div class="feed-empty">Aucune récurrence. Ajoutez un abonnement ou un prélèvement pour qu\'il soit généré automatiquement.</div>';
        return;
    }

    const ICONS = {
        advance: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5l7 7-7 7"/><path d="M4 5l7 7-7 7"/></svg>',
        history: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        edit: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        del: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
    };

    sortedSubs.forEach(sub => {
        const isCorrupted = isNaN(sub.amount) || sub.amount === null || sub.amount === undefined || !sub.startDate;
        const isCompleted = sub.status === 'completed';
        const isIncome = sub.type === 'income';

        const card = document.createElement('div');
        card.className = 'sub-card' + (isCompleted ? ' is-done' : '') + (isCorrupted ? ' is-corrupted' : '');
        card.ondblclick = () => editSubscription(sub.id);

        // Fréquence lisible
        let freqText = 'Fréquence inconnue';
        let freqShort = '?';
        if (sub.frequency === 'monthly' && sub.startDate) {
            freqText = 'Tous les ' + parseInt(sub.startDate.split('-')[2], 10) + ' du mois';
            freqShort = 'M';
        } else if (sub.frequency === 'weekly') {
            freqText = 'Chaque semaine';
            freqShort = 'S';
        } else if (sub.frequency === 'yearly') {
            freqText = 'Chaque année';
            freqShort = 'A';
        } else if (sub.frequency === 'installments') {
            freqText = 'Paiement en plusieurs fois';
            freqShort = 'X';
        } else if (sub.frequency === 'monthly') {
            freqText = 'Chaque mois';
            freqShort = 'M';
        }

        // Métadonnées secondaires
        const meta = [freqText, getCategoryPath(sub.categoryId)];
        if (!isCompleted && (sub.nextDate || sub.startDate)) {
            meta.push('prochaine le ' + fmtShortDate(sub.nextDate || sub.startDate));
        }
        if (sub.endDate) meta.push('jusqu\'au ' + fmtShortDate(sub.endDate));

        // Coût ramené au mois
        let perMonthText = '';
        const amount = Number(sub.amount) || 0;
        if (!isCorrupted && !isCompleted) {
            if (sub.frequency === 'weekly') perMonthText = '≈ ' + (amount * 52 / 12).toFixed(2) + ' € / mois';
            else if (sub.frequency === 'yearly') perMonthText = '≈ ' + (amount / 12).toFixed(2) + ' € / mois';
        }

        let badges = '';
        if (isCompleted) badges += ' <span class="badge badge-closed">Terminé</span>';
        if (isCorrupted) badges += ' <span class="cat-type-badge badge-expense">Corrompu</span>';

        // Avancement des paiements en plusieurs fois
        let progressHtml = '';
        if (sub.frequency === 'installments' && sub.totalInstallments) {
            const paid = sub.installmentsPaid || 0;
            const pct = Math.min(100, (paid / sub.totalInstallments) * 100);
            progressHtml =
                '<div class="sub-progress">' +
                    '<div class="sub-progress-head"><span>' + paid + ' / ' + sub.totalInstallments + ' mensualités</span>' +
                    '<span>' + Math.round(pct) + '%</span></div>' +
                    '<div class="bar-track"><div class="bar-value" style="width:' + pct + '%"></div></div>' +
                '</div>';
        }

        card.innerHTML =
            '<div class="sub-icon ' + (isIncome ? 'is-in' : 'is-out') + '">' + freqShort + '</div>' +
            '<div class="sub-main">' +
                '<div class="sub-name">' + (sub.name || 'Sans nom') + badges + '</div>' +
                '<div class="sub-meta">' + meta.join(' · ') + '</div>' +
                progressHtml +
            '</div>' +
            '<div class="sub-right">' +
                '<div class="sub-amount ' + (isIncome ? 'text-green' : 'text-red') + '">' +
                    (isCorrupted ? 'Erreur (NaN)' : (isIncome ? '+' : '-') + amount.toFixed(2) + ' €') +
                '</div>' +
                (perMonthText ? '<div class="sub-permonth">' + perMonthText + '</div>' : '') +
            '</div>' +
            '<div class="sub-actions">' +
                (sub.frequency === 'installments' && !isCompleted
                    ? '<button class="icon-action is-advance" title="Avancer une mensualité" data-action="advance">' + ICONS.advance + '</button>' : '') +
                '<button class="icon-action" title="Historique" data-action="history">' + ICONS.history + '</button>' +
                '<button class="icon-action" title="Modifier" data-action="edit">' + ICONS.edit + '</button>' +
                '<button class="icon-action is-delete" title="Supprimer" data-action="delete">' + ICONS.del + '</button>' +
            '</div>';

        card.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                if (action === 'advance') advanceSubscription(sub.id);
                else if (action === 'history') viewSubscriptionHistory(sub.id);
                else if (action === 'edit') editSubscription(sub.id);
                else if (action === 'delete') deleteSubscription(sub.id);
            });
        });

        list.appendChild(card);
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

    document.getElementById('sub-frequency').value = sub.frequency;
    document.getElementById('sub-frequency').dispatchEvent(new Event('change')); // Mettre à jour les champs de montant

    if (sub.frequency === 'installments') {
        document.getElementById('sub-total-amount').value = sub.totalAmount;
        document.getElementById('sub-installments-count').value = sub.totalInstallments;
    } else {
        document.getElementById('sub-amount').value = sub.amount;
    }

    document.getElementById('sub-category').value = sub.categoryId;
    document.getElementById('sub-start-date').value = sub.startDate; // Note: editing start date won't change nextDate unless handled explicitly
    document.getElementById('sub-end-date').value = sub.endDate || '';

    // Show apply to past checkbox and change buttons
    document.getElementById('sub-apply-past-container').style.display = 'flex';
    document.getElementById('sub-apply-past').checked = false;
    document.getElementById('btn-submit-sub').textContent = "Mettre à jour";
    document.getElementById('btn-cancel-edit-sub').style.display = 'none'; // Pas besoin dans la modale

    openEditModal('form-subscription', "Modifier l'abonnement");
}

function resetSubscriptionForm() {
    const form = document.getElementById('form-subscription');
    if (!form) return;
    form.reset();
    document.getElementById('sub-id').value = '';
    document.getElementById('sub-start-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('sub-end-date').value = '';
    document.getElementById('sub-type').value = 'expense';
    document.getElementById('sub-type').dispatchEvent(new Event('change'));

    document.getElementById('sub-frequency').value = 'monthly';
    document.getElementById('sub-frequency').dispatchEvent(new Event('change'));

    document.getElementById('sub-apply-past-container').style.display = 'none';
    document.getElementById('btn-submit-sub').textContent = "Ajouter";
    const cancelBtn = document.getElementById('btn-cancel-edit-sub');
    if(cancelBtn) cancelBtn.style.display = 'none';
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
    const effectiveTrans = getEffectiveTransactions();
    const trans = effectiveTrans.filter(t => t.date.startsWith(prefix));

    let income = 0;
    let expense = 0;
    let savings = 0;
    let investmentTransfers = 0;
    let categoryExpenses = {};

    trans.forEach(t => {
        if (t.type === 'investment_transfer') {
            investmentTransfers += t.amount;
        }

        if (t.type === 'investment_transfer' || t.type === 'investment_return') {
            // Ces types n'entrent pas dans le budget
            return;
        }

        if (t.type === 'income') {
            income += t.amount;
        } else if (t.type === 'salary') {
            const saved = t.savedAmount || 0;
            savings += saved;
            income += (t.amount - saved); // Only non-saved part goes to income
        } else if (t.type === 'expense') {
            let actualAmount = t.amount;
            let chartMode = window.currentChartMode || 'real';

            if (chartMode === 'real' && t.mealVoucherPart > 0) {
                actualAmount = t.amount - t.mealVoucherPart;
            }

            expense += actualAmount;
            // Get main category (if it's a sub, we get its parent for high-level charts, or just use it direct. Let's group by top-level category for clarity)
            const cat = appData.categories.find(c => c.id === t.categoryId);
            if (cat) {
                const topLevelId = cat.parentId ? cat.parentId : cat.id;
                const topLevelName = getCategoryPath(topLevelId).split(' > ')[0];
                categoryExpenses[topLevelName] = (categoryExpenses[topLevelName] || 0) + actualAmount;
            }
        }
    });

    return { income, expense, savings, investmentTransfers, balance: income - expense, categoryExpenses };
}

function getSpecificMonthsCategoryData(monthPrefixes) {
    // Filter transactions by these prefixes
    const effectiveTrans = getEffectiveTransactions();
    const trans = effectiveTrans.filter(t =>
        monthPrefixes.some(prefix => t.date && t.date.startsWith(prefix))
    );

    let chartMode = window.currentChartMode || 'real';
    const categoryTotals = {};
    trans.forEach(t => {
        if (t.type === 'expense') {
            let actualAmount = Math.abs(t.amount);
            if (chartMode === 'real' && t.mealVoucherPart > 0) {
                actualAmount = actualAmount - t.mealVoucherPart;
            }

            const catId = t.categoryId || 'unknown';
            const catName = getCategoryPath(catId);
            categoryTotals[catName] = (categoryTotals[catName] || 0) + actualAmount;
        }
    });

    return categoryTotals;
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

    let chartMode = window.currentChartMode || 'real';
    let detailedCategoryExpenses = {};

    trans.forEach(t => {
        if (t.type === 'expense') {
            let actualAmount = t.amount;
            if (chartMode === 'real' && t.mealVoucherPart > 0) {
                actualAmount = actualAmount - t.mealVoucherPart;
            }

            const catPath = getCategoryPath(t.categoryId);
            detailedCategoryExpenses[catPath] = (detailedCategoryExpenses[catPath] || 0) + actualAmount;
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

    // Les régions sont stockées en pixels logiques (voir prepareCanvas)
    const scaleX = (e.target._logicalW || e.target.width) / rect.width;
    const scaleY = (e.target._logicalH || e.target.height) / rect.height;

    const clickX = x * scaleX;
    const clickY = y * scaleY;

    for (const region of regions) {
        if (region.type === 'arc') {
            const dx = clickX - region.cx;
            const dy = clickY - region.cy;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance <= region.radius && distance >= (region.innerRadius || 0)) {
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
                    if (isCategorySelectionMode) {
                        if (selectedCategories.has(region.label)) {
                            selectedCategories.delete(region.label);
                        } else {
                            selectedCategories.add(region.label);
                        }
                        updateCategorySelectionTotal();
                        updateDashboardCategoryChart(); // Re-render to show selection
                    } else {
                        showCategoryDetails(region.label, region.amount);
                    }
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
        const logicalW = e.target._logicalW || e.target.width;
        const logicalH = e.target._logicalH || e.target.height;
        const x = (e.clientX - rect.left) * (logicalW / rect.width);
        const y = (e.clientY - rect.top) * (logicalH / rect.height);

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

function showCategoryDetails(categoryName, totalAmount, options = {}) {
    // Determine the source view (dashboard or charts)
    const isChartsView = document.querySelector('#charts').classList.contains('active');

    let filterPrefixes = [];
    if (isChartsView) {
        // Chart view logic: use dash-filter-month and chart-period-select (months backwards)
        const periodSelect = document.getElementById('chart-period-select');
        let months = periodSelect ? parseInt(periodSelect.value, 10) : 1;
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
    } else {
        // Dashboard logic: use dashboard-category-month-selector directly
        const selector = document.getElementById('dashboard-category-month-selector');
        if (selector && selector.selectedOptions.length > 0) {
            filterPrefixes = Array.from(selector.selectedOptions).map(opt => opt.value);
        } else {
            // Fallback to dash-filter-month if selector is empty or missing
            const dashMonthFilter = document.getElementById('dash-filter-month').value;
            if (dashMonthFilter) {
                filterPrefixes.push(dashMonthFilter);
            }
        }
    }

    // Determine if the categoryName has any descendants
    let isMainCategory = false;
    const allPaths = appData.categories.map(c => getCategoryPath(c.id));
    if (allPaths.some(p => p.startsWith(categoryName + ' > '))) {
        isMainCategory = true;
    }

    // Setup global state for the modal to use
    window.currentModalCategory = categoryName;
    window.currentModalPrefixes = filterPrefixes;
    window.currentModalIsMainCategory = isMainCategory;

    // Reset filters to default state
    const periodField = document.getElementById('data-modal-period');
    const startField = document.getElementById('data-modal-date-start');
    const endField = document.getElementById('data-modal-date-end');

    document.getElementById('data-modal-cat-mode').value = 'with_subcategories';
    startField.value = '';
    endField.value = '';

    if (options.dateStart || options.dateEnd) {
        // Période imposée par l'appelant (écran Catégories) : on la reporte tel quel
        periodField.value = 'custom';
        startField.value = options.dateStart || '';
        endField.value = options.dateEnd || '';
    } else if (options.allTime || filterPrefixes.length === 0) {
        // Sans période héritée exploitable, « Période du tableau de bord » ne
        // filtrerait plus rien du tout et l'historique s'afficherait vide.
        periodField.value = 'all_time';
    } else {
        periodField.value = 'inherited';
    }

    // Call render to build the modal contents
    renderCategoryModal();

    // Show the modal
    document.getElementById('data-modal-overlay').classList.add('active');
}


function renderCategoryModal() {
    const categoryName = window.currentModalCategory;
    const filterPrefixes = window.currentModalPrefixes || [];
    const isMainCategory = window.currentModalIsMainCategory;

    const modalTitle = document.getElementById('data-modal-title');
    const filtersContainer = document.getElementById('data-modal-filters-container');
    const catModeGroup = document.getElementById('data-modal-cat-mode-group');
    const periodSelect = document.getElementById('data-modal-period');
    const customDatesGroup = document.getElementById('data-modal-custom-dates');
    const dateStartInput = document.getElementById('data-modal-date-start');
    const dateEndInput = document.getElementById('data-modal-date-end');

    if(!filtersContainer) return;

    // Make sure filters are visible
    filtersContainer.style.display = 'flex';

    // Hide or show category inclusion mode
    if (isMainCategory) {
        catModeGroup.style.display = 'flex';
    } else {
        catModeGroup.style.display = 'none';
    }

    // Custom dates visibility
    if (periodSelect.value === 'custom') {
        customDatesGroup.style.display = 'flex';
    } else {
        customDatesGroup.style.display = 'none';
    }

    modalTitle.innerHTML = `Détails : ${categoryName}`;

    // Read current filter settings
    const catMode = document.getElementById('data-modal-cat-mode').value;
    const periodMode = periodSelect.value;
    const dateStart = dateStartInput.value;
    const dateEnd = dateEndInput.value;

    // Une catégorie de revenu ne contient pas de dépenses : on adapte les types
    // retenus, sinon la modale reste désespérément vide.
    const isIncomeCategory = getCategoryTypeByPath(categoryName) === 'income';
    const matchesType = t => isIncomeCategory
        ? (t.type === 'income' || t.type === 'salary')
        : t.type === 'expense';

    // Filter transactions
    const trans = appData.transactions.filter(t => {
        if (!matchesType(t)) return false;

        const catPath = getCategoryPath(t.categoryId);

        let isMatch = false;
        if (isMainCategory) {
            if (catMode === 'with_subcategories') {
                isMatch = (catPath === categoryName || catPath.startsWith(categoryName + ' > '));
            } else {
                isMatch = (catPath === categoryName);
            }
        } else {
            isMatch = (catPath === categoryName);
        }

        if (!isMatch) return false;

        // Apply period filter
        if (periodMode === 'inherited') {
            return filterPrefixes.some(prefix => t.date && t.date.startsWith(prefix));
        } else if (periodMode === 'all_time') {
            return true;
        } else if (periodMode === 'last_month') {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

            // Format to YYYY-MM-DD
            const nowStr = now.toISOString().split('T')[0];
            const pastStr = thirtyDaysAgo.toISOString().split('T')[0];

            return t.date && t.date >= pastStr && t.date <= nowStr;
        } else if (periodMode === 'last_year') {
            const now = new Date();
            const yearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));

            const nowStr = now.toISOString().split('T')[0];
            const pastStr = yearAgo.toISOString().split('T')[0];

            return t.date && t.date >= pastStr && t.date <= nowStr;
        } else if (periodMode === 'custom') {
            if (dateStart && t.date < dateStart) return false;
            if (dateEnd && t.date > dateEnd) return false;
            return true;
        }

        return true;
    });

    trans.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate total
    let totalAmount = 0;
    const chartMode = window.currentChartMode || 'real';

    trans.forEach(t => {
        let actualAmount = Math.abs(t.amount);
        if (chartMode === 'real' && t.mealVoucherPart > 0) {
            actualAmount = actualAmount - t.mealVoucherPart;
        }
        totalAmount += actualAmount;
    });

    // Update UI
    const totalSpan = document.getElementById('data-modal-total');
    totalSpan.textContent = (isIncomeCategory ? '+' : '-') + totalAmount.toFixed(2) + ' €';
    totalSpan.className = isIncomeCategory ? 'text-green' : 'text-red';

    const totalLabel = document.getElementById('data-modal-total-label');
    if (totalLabel) {
        totalLabel.textContent = (isMainCategory && catMode === 'with_subcategories')
            ? 'Total (catégorie + sous-catégories) :'
            : 'Total :';
    }

    renderCategoryBreakdown(categoryName, trans, isMainCategory && catMode === 'with_subcategories', isIncomeCategory);

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
            const catName = getCategoryPath(t.categoryId, new Set(), true);

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
}

/**
 * Affiche la répartition du total d'une catégorie : le montant imputé à la
 * catégorie elle-même, puis le sous-total de chaque sous-catégorie directe
 * (sous-arbre complet inclus). Les transactions reçues sont déjà filtrées
 * par période et par mode d'inclusion.
 */
function renderCategoryBreakdown(categoryName, trans, enabled, isIncome = false) {
    const container = document.getElementById('data-modal-breakdown');
    if (!container) return;

    if (!enabled) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const chartMode = window.currentChartMode || 'real';
    const buckets = {};      // libellé de la sous-catégorie directe -> montant
    let ownAmount = 0;       // dépenses imputées directement à la catégorie

    trans.forEach(t => {
        let amount = Math.abs(t.amount);
        if (chartMode === 'real' && t.mealVoucherPart > 0) {
            amount = amount - t.mealVoucherPart;
        }

        const catPath = getCategoryPath(t.categoryId);
        if (catPath === categoryName) {
            ownAmount += amount;
            return;
        }

        // Premier niveau sous la catégorie courante
        const child = catPath.slice(categoryName.length + 3).split(' > ')[0];
        buckets[child] = (buckets[child] || 0) + amount;
    });

    const rows = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
    const total = ownAmount + rows.reduce((sum, [, amount]) => sum + amount, 0);

    if (rows.length === 0 && ownAmount === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const line = (label, amount) => {
        const share = total > 0 ? (amount / total) * 100 : 0;
        return `
            <div class="breakdown-row">
                <span class="breakdown-label">${label}</span>
                <span class="breakdown-share">${share.toFixed(0)}%</span>
                <span class="breakdown-amount ${isIncome ? 'text-green' : 'text-red'}">${isIncome ? '+' : '-'}${amount.toFixed(2)} €</span>
            </div>`;
    };

    container.innerHTML = `
        <div class="breakdown-title">Répartition</div>
        ${line(categoryName + ' (direct)', ownAmount)}
        ${rows.map(([label, amount]) => line(label, amount)).join('')}
    `;
    container.style.display = 'block';
}


function showMonthDetails(year, month, label, totalIncome, totalExpense) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const trans = appData.transactions.filter(t => t.date.startsWith(prefix));
    trans.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Show expenses total by default, unless income is specified
    const balance = totalIncome - totalExpense;

    // Add custom header info to the modal for this specific case
    document.getElementById('data-modal-title').innerHTML = `Mois : ${label} <small>(${year})</small>`;
    renderCategoryBreakdown(null, [], false);
    const monthTotalLabel = document.getElementById('data-modal-total-label');
    if (monthTotalLabel) monthTotalLabel.textContent = 'Total :';

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
            const catName = getCategoryPath(t.categoryId, new Set(), true);

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

/* -------------------------------------------------------------------------
   Socle commun des graphiques
   Les canvas sont dimensionnés selon la largeur réelle de leur conteneur et
   la densité de l'écran (devicePixelRatio) : le rendu reste net sur Retina
   et sur mobile, et aucun graphique ne déborde horizontalement.
   ------------------------------------------------------------------------- */
const CHART_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function chartColor(name, fallback) {
    const v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fallback;
}

// Prépare le canvas et renvoie le contexte + les dimensions logiques (en CSS px)
function prepareCanvas(canvas, logicalHeight, forcedWidth) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const parent = canvas.parentElement;
    let width = forcedWidth || (parent ? parent.clientWidth : 0) || canvas.clientWidth;
    if (!width || width < 60) width = 640; // section masquée : on redessine à l'affichage
    width = Math.floor(width);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(logicalHeight * dpr);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas._logicalW = width;
    canvas._logicalH = logicalHeight;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, logicalHeight);
    return { ctx, W: width, H: logicalHeight };
}

function chartEmptyState(ctx, W, H, message) {
    ctx.fillStyle = chartColor('--text-muted', '#999');
    ctx.font = '14px ' + CHART_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, W / 2, H / 2);
}

function fitText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 3 && ctx.measureText(out + '…').width > maxWidth) {
        out = out.slice(0, -1);
    }
    return out + '…';
}

const CHART_PALETTE = ['#0a6cff', '#12a150', '#f5a524', '#e5484d', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

/* ---------- Camembert (anneau) + légende ---------- */
function drawPieChart(canvasId, dataObj) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const entries = Object.entries(dataObj).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const probe = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
    const narrow = (probe || 640) < 460;

    const rowH = 24;
    const donut = narrow ? 170 : 200;
    const height = narrow ? donut + 28 + Math.max(1, entries.length) * rowH : Math.max(donut + 20, 40 + entries.length * rowH);

    const { ctx, W, H } = prepareCanvas(canvas, height);

    chartInteractions[canvasId] = [];
    attachChartClickListener(canvasId);

    if (entries.length === 0) {
        chartEmptyState(ctx, W, H, 'Aucune dépense sur la période');
        return;
    }

    const total = entries.reduce((sum, e) => sum + e[1], 0);
    const cx = narrow ? W / 2 : donut / 2 + 10;
    const cy = donut / 2 + 10;
    const outer = donut / 2 - 8;
    const inner = outer * 0.62;

    let startAngle = -Math.PI / 2;
    entries.forEach((entry, i) => {
        const sliceAngle = (entry[1] / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, outer, startAngle, startAngle + sliceAngle);
        ctx.arc(cx, cy, inner, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = CHART_PALETTE[i % CHART_PALETTE.length];
        ctx.fill();

        chartInteractions[canvasId].push({
            type: 'arc', cx, cy, radius: outer, innerRadius: inner,
            startAngle: startAngle < 0 ? startAngle + 2 * Math.PI : startAngle,
            endAngle: (startAngle + sliceAngle) < 0 ? startAngle + sliceAngle + 2 * Math.PI : startAngle + sliceAngle,
            label: entry[0], amount: entry[1]
        });

        startAngle += sliceAngle;
    });

    // Total au centre de l'anneau
    ctx.fillStyle = chartColor('--text-color', '#333');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 17px ' + CHART_FONT;
    ctx.fillText(total.toFixed(0) + ' €', cx, cy - 2);
    ctx.fillStyle = chartColor('--text-muted', '#888');
    ctx.font = '11px ' + CHART_FONT;
    ctx.fillText('Total', cx, cy + 16);

    // Légende
    const legendX = narrow ? 12 : donut + 26;
    const legendTop = narrow ? donut + 26 : Math.max(14, (H - entries.length * rowH) / 2);
    const legendW = W - legendX - 12;

    ctx.textBaseline = 'middle';
    entries.forEach((entry, i) => {
        const y = legendTop + i * rowH + rowH / 2;
        ctx.fillStyle = CHART_PALETTE[i % CHART_PALETTE.length];
        ctx.beginPath();
        ctx.roundRect(legendX, y - 5, 10, 10, 3);
        ctx.fill();

        const amountText = entry[1].toFixed(2) + ' € · ' + Math.round((entry[1] / total) * 100) + '%';
        ctx.font = '600 12px ' + CHART_FONT;
        const amountW = ctx.measureText(amountText).width;

        ctx.fillStyle = chartColor('--text-color', '#333');
        ctx.textAlign = 'right';
        ctx.fillText(amountText, legendX + legendW, y);

        ctx.font = '12px ' + CHART_FONT;
        ctx.textAlign = 'left';
        ctx.fillText(fitText(ctx, entry[0], legendW - amountW - 32), legendX + 18, y);

        chartInteractions[canvasId].push({
            type: 'rect', x: legendX, y: y - rowH / 2, w: legendW, h: rowH,
            action: 'showCategory', label: entry[0], amount: entry[1]
        });
    });
}

/* ---------- Histogramme revenus / dépenses ---------- */
function drawBarChart(canvasId, dataArr) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const { ctx, W, H } = prepareCanvas(canvas, 280);

    chartInteractions[canvasId] = [];
    attachChartClickListener(canvasId);

    if (!dataArr || dataArr.length === 0) {
        chartEmptyState(ctx, W, H, 'Aucune donnée');
        return;
    }

    const textColor = chartColor('--text-color', '#333');
    const mutedColor = chartColor('--text-muted', '#888');
    const gridColor = chartColor('--border-color', 'rgba(0,0,0,0.1)');
    const incomeColor = chartColor('--success-color', '#12a150');
    const expenseColor = chartColor('--danger-color', '#e5484d');

    const padLeft = 46;
    const padRight = 10;
    const padTop = 30;
    const padBottom = 26;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;

    const maxVal = Math.max(...dataArr.map(d => Math.max(d.income, d.expense)), 1);
    const niceMax = Math.ceil(maxVal / 100) * 100 || 100;

    // Grille + échelle
    ctx.font = '11px ' + CHART_FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const y = padTop + chartH * (i / 4);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padLeft, Math.round(y) + 0.5);
        ctx.lineTo(W - padRight, Math.round(y) + 0.5);
        ctx.stroke();

        ctx.fillStyle = mutedColor;
        ctx.fillText(Math.round(niceMax * (1 - i / 4)) + '€', padLeft - 8, y);
    }

    // Légende
    ctx.textAlign = 'left';
    ctx.fillStyle = incomeColor;
    ctx.beginPath(); ctx.roundRect(padLeft, 8, 9, 9, 2); ctx.fill();
    ctx.fillStyle = mutedColor;
    ctx.fillText('Revenus', padLeft + 15, 13);
    const off = padLeft + 15 + ctx.measureText('Revenus').width + 16;
    ctx.fillStyle = expenseColor;
    ctx.beginPath(); ctx.roundRect(off, 8, 9, 9, 2); ctx.fill();
    ctx.fillStyle = mutedColor;
    ctx.fillText('Dépenses', off + 15, 13);

    const groupW = chartW / dataArr.length;
    const barW = Math.max(6, Math.min(18, groupW * 0.3));
    const baseY = padTop + chartH;

    dataArr.forEach((d, i) => {
        const center = padLeft + groupW * (i + 0.5);
        const incomeH = (d.income / niceMax) * chartH;
        const expenseH = (d.expense / niceMax) * chartH;

        ctx.fillStyle = incomeColor;
        ctx.beginPath();
        ctx.roundRect(center - barW - 2, baseY - incomeH, barW, Math.max(incomeH, 1), [4, 4, 0, 0]);
        ctx.fill();

        ctx.fillStyle = expenseColor;
        ctx.beginPath();
        ctx.roundRect(center + 2, baseY - expenseH, barW, Math.max(expenseH, 1), [4, 4, 0, 0]);
        ctx.fill();

        ctx.fillStyle = mutedColor;
        ctx.font = '11px ' + CHART_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(d.label, center, baseY + 8);
        ctx.textBaseline = 'middle';

        chartInteractions[canvasId].push({
            type: 'rect', x: center - groupW / 2, y: padTop, w: groupW, h: chartH + 20,
            action: 'showMonth', label: d.label, year: d.year, month: d.month,
            income: d.income, expense: d.expense
        });
    });
}

/* ---------- Barres génériques (verticales ou horizontales) ----------
   items : [{ label, value, color?, sublabel? }]
   options : { horizontal, height, unit, emptyMessage, formatValue }
   -------------------------------------------------------------------- */
function drawSimpleBarChart(canvasId, items, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const opts = options || {};
    const data = (items || []).filter(d => Number.isFinite(Number(d.value)));
    const horizontal = !!opts.horizontal;
    const rowH = 30;
    const height = opts.height || (horizontal ? Math.max(140, 12 + data.length * rowH) : 240);

    const { ctx, W, H } = prepareCanvas(canvas, height);

    if (data.length === 0 || data.every(d => !d.value)) {
        chartEmptyState(ctx, W, H, opts.emptyMessage || 'Aucune donnée pour cette période');
        return;
    }

    const textColor = chartColor('--text-color', '#333');
    const mutedColor = chartColor('--text-muted', '#888');
    const gridColor = chartColor('--border-color', 'rgba(0,0,0,0.1)');
    const trackColor = chartColor('--surface-2', '#eee');
    const accent = chartColor('--accent-color', '#0a6cff');
    const fmt = opts.formatValue || (v => v.toFixed(2) + ' ' + (opts.unit || '€'));

    const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);

    if (horizontal) {
        // Une ligne par entrée : libellé + piste + valeur
        const labelW = Math.min(150, Math.max(80, W * 0.32));
        const valueW = 86;
        const trackX = labelW + 10;
        const trackW = Math.max(20, W - trackX - valueW - 6);

        data.forEach((d, i) => {
            const top = 8 + i * rowH;
            const cy = top + rowH / 2 - 4;

            ctx.font = '12px ' + CHART_FONT;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = textColor;
            ctx.fillText(fitText(ctx, d.label, labelW), 0, cy);

            ctx.fillStyle = trackColor;
            ctx.beginPath(); ctx.roundRect(trackX, cy - 7, trackW, 14, 7); ctx.fill();

            const w = Math.max(3, (Math.abs(d.value) / maxVal) * trackW);
            ctx.fillStyle = d.color || accent;
            ctx.beginPath(); ctx.roundRect(trackX, cy - 7, w, 14, 7); ctx.fill();

            ctx.font = '600 12px ' + CHART_FONT;
            ctx.textAlign = 'right';
            ctx.fillStyle = textColor;
            ctx.fillText(fmt(d.value), W, cy);
        });
        return;
    }

    // Barres verticales
    const padLeft = 46;
    const padRight = 8;
    const padTop = 14;
    const padBottom = 26;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;

    ctx.font = '11px ' + CHART_FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const y = padTop + chartH * (i / 4);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padLeft, Math.round(y) + 0.5);
        ctx.lineTo(W - padRight, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.fillStyle = mutedColor;
        ctx.fillText(Math.round(maxVal * (1 - i / 4)) + (opts.unit || '€'), padLeft - 8, y);
    }

    const slotW = chartW / data.length;
    const barW = Math.max(4, Math.min(38, slotW * 0.6));
    const baseY = padTop + chartH;

    data.forEach((d, i) => {
        const center = padLeft + slotW * (i + 0.5);
        const h = (Math.abs(d.value) / maxVal) * chartH;

        ctx.fillStyle = d.color || accent;
        ctx.beginPath();
        ctx.roundRect(center - barW / 2, baseY - h, barW, Math.max(h, 1), [5, 5, 0, 0]);
        ctx.fill();

        ctx.fillStyle = mutedColor;
        ctx.font = '11px ' + CHART_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        // Sur les séries denses (jours du mois), on n'affiche qu'un libellé sur cinq
        if (!opts.sparseLabels || i === 0 || (i + 1) % 5 === 0) {
            ctx.fillText(d.label, center, baseY + 8);
        }
        ctx.textBaseline = 'middle';
    });
}

/* ---------- Barres horizontales par catégorie ---------- */
function drawHorizontalBarChart(canvasId, dataObj) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const entries = Object.entries(dataObj).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);

    const rowH = 46;
    const padTop = 8;
    const padBottom = 8;
    const height = Math.max(120, padTop + padBottom + entries.length * rowH);

    const { ctx, W, H } = prepareCanvas(canvas, height);

    chartInteractions[canvasId] = [];
    attachChartClickListener(canvasId);

    if (entries.length === 0) {
        chartEmptyState(ctx, W, H, 'Aucune dépense pour cette période');
        return;
    }

    const maxVal = Math.max(...entries.map(e => e[1]));
    const total = entries.reduce((s, e) => s + e[1], 0);

    const textColor = chartColor('--text-color', '#333');
    const mutedColor = chartColor('--text-muted', '#888');
    const trackColor = chartColor('--surface-2', '#eee');
    const accent = chartColor('--accent-color', '#0a6cff');

    const left = 2;
    const right = W - 2;
    const trackW = right - left;

    entries.forEach((entry, i) => {
        const [label, val] = entry;
        const top = padTop + i * rowH;
        const isSelected = isCategorySelectionMode && selectedCategories.has(label);
        const dimmed = isCategorySelectionMode && !isSelected;

        // Montant à droite
        ctx.font = '600 13px ' + CHART_FONT;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = dimmed ? mutedColor : textColor;
        const amountText = val.toFixed(2) + ' €';
        ctx.fillText(amountText, right, top + 12);
        const amountW = ctx.measureText(amountText).width;

        // Part en pourcentage
        ctx.font = '11px ' + CHART_FONT;
        ctx.fillStyle = mutedColor;
        const pctText = Math.round((val / total) * 100) + '%';
        ctx.fillText(pctText, right - amountW - 8, top + 12);
        const pctW = ctx.measureText(pctText).width;

        // Libellé de catégorie
        ctx.font = (isSelected ? '600 13px ' : '13px ') + CHART_FONT;
        ctx.textAlign = 'left';
        ctx.fillStyle = dimmed ? mutedColor : textColor;
        ctx.fillText(fitText(ctx, label, trackW - amountW - pctW - 26), left, top + 12);

        // Piste + barre
        const barY = top + 26;
        ctx.fillStyle = trackColor;
        ctx.beginPath();
        ctx.roundRect(left, barY, trackW, 9, 5);
        ctx.fill();

        ctx.fillStyle = dimmed ? mutedColor : accent;
        ctx.globalAlpha = dimmed ? 0.35 : 1;
        ctx.beginPath();
        ctx.roundRect(left, barY, Math.max(4, (val / maxVal) * trackW), 9, 5);
        ctx.fill();
        ctx.globalAlpha = 1;

        chartInteractions[canvasId].push({
            type: 'rect', x: 0, y: top, w: W, h: rowH - 4,
            action: 'showCategory', label: label, amount: val
        });
    });
}

/* ---------- Courbe (patrimoine, portefeuille) ---------- */
function drawAreaLineChart(canvasId, points, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const opts = options || {};
    const { ctx, W, H } = prepareCanvas(canvas, opts.height || 200);

    if (!points || points.length === 0) {
        chartEmptyState(ctx, W, H, opts.emptyMessage || 'Aucune donnée à afficher');
        return;
    }

    const textColor = chartColor('--text-color', '#333');
    const mutedColor = chartColor('--text-muted', '#888');
    const gridColor = chartColor('--border-color', 'rgba(0,0,0,0.1)');
    const accent = opts.color || chartColor('--accent-color', '#0a6cff');

    const padLeft = 48;
    const padRight = 10;
    const padTop = 14;
    const padBottom = 24;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;

    const values = points.map(p => p.value);
    let minVal = Math.min(...values, 0);
    let maxVal = Math.max(...values, 0);
    if (maxVal === minVal) maxVal = minVal + 1;
    const range = maxVal - minVal;

    const xAt = (i) => points.length === 1 ? padLeft + chartW / 2 : padLeft + (i / (points.length - 1)) * chartW;
    const yAt = (v) => padTop + chartH - ((v - minVal) / range) * chartH;

    // Grille horizontale + échelle
    ctx.font = '11px ' + CHART_FONT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 3; i++) {
        const v = maxVal - (range * i / 3);
        const y = yAt(v);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padLeft, Math.round(y) + 0.5);
        ctx.lineTo(W - padRight, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.fillStyle = mutedColor;
        ctx.fillText(Math.round(v) + (opts.unit || '€'), padLeft - 8, y);
    }

    // Aire sous la courbe
    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    gradient.addColorStop(0, accent + '55');
    gradient.addColorStop(1, accent + '00');
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(values[0]));
    values.forEach((v, i) => ctx.lineTo(xAt(i), yAt(v)));
    ctx.lineTo(xAt(values.length - 1), padTop + chartH);
    ctx.lineTo(xAt(0), padTop + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Courbe
    ctx.beginPath();
    values.forEach((v, i) => {
        const x = xAt(i), y = yAt(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Points repères : soit tous les points (option markers), soit uniquement le dernier
    const cardBg = chartColor('--card-bg', '#fff');
    const drawDot = (x, y, radius) => {
        ctx.fillStyle = cardBg;
        ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.stroke();
    };

    if (opts.markers) {
        values.forEach((v, i) => drawDot(xAt(i), yAt(v), i === values.length - 1 ? 5.5 : 4));
    } else {
        drawDot(xAt(values.length - 1), yAt(values[values.length - 1]), 5);
    }

    // Libellés de l'axe des abscisses (premier, milieu, dernier)
    ctx.fillStyle = mutedColor;
    ctx.font = '11px ' + CHART_FONT;
    ctx.textBaseline = 'top';
    const idx = points.length <= 2 ? [0, points.length - 1] : [0, Math.floor((points.length - 1) / 2), points.length - 1];
    idx.forEach((i, n) => {
        ctx.textAlign = n === 0 ? 'left' : (n === idx.length - 1 ? 'right' : 'center');
        ctx.fillText(points[i].label, xAt(i), padTop + chartH + 8);
    });
    ctx.textBaseline = 'middle';

    // Géométrie mémorisée pour l'infobulle au survol
    canvas._chartPoints = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value), point: p }));
    canvas._chartLogicalW = W;
    if (opts.tooltip) attachChartHoverTooltip(canvas);
}

/* ---------- Infobulle au survol des points d'une courbe ---------- */
function attachChartHoverTooltip(canvas) {
    if (canvas._tooltipBound) return;
    canvas._tooltipBound = true;

    const wrap = canvas.parentElement;
    if (!wrap) return;
    wrap.classList.add('canvas-hoverable');

    const tip = document.createElement('div');
    tip.className = 'chart-tooltip';
    tip.style.display = 'none';
    wrap.appendChild(tip);

    const hide = () => { tip.style.display = 'none'; canvas.style.cursor = ''; };

    const locate = (clientX, clientY) => {
        const pts = canvas._chartPoints;
        if (!pts || !pts.length) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return null;
        const scale = (canvas._chartLogicalW || rect.width) / rect.width;
        const x = (clientX - rect.left) * scale;
        const y = (clientY - rect.top) * scale;

        let best = null;
        let bestDist = Infinity;
        pts.forEach(p => {
            const d = Math.abs(p.x - x);
            if (d < bestDist) { bestDist = d; best = p; }
        });
        // On exige une proximité raisonnable, verticale comprise, pour éviter les faux positifs
        if (!best || bestDist > 26 || Math.abs(best.y - y) > 60) return null;
        return { hit: best, rect };
    };

    const show = (clientX, clientY) => {
        const found = locate(clientX, clientY);
        if (!found) { hide(); return; }

        const lines = found.hit.point.tooltip || [found.hit.point.label, fmtEuro(found.hit.point.value)];
        tip.innerHTML = lines.map((line, i) =>
            '<span class="' + (i === 0 ? 'chart-tooltip-title' : 'chart-tooltip-line') + '">' + line + '</span>'
        ).join('');

        // Position en pixels CSS (le canvas est dessiné en unités logiques)
        const ratio = found.rect.width / (canvas._chartLogicalW || found.rect.width);
        tip.style.display = 'block';
        const left = found.hit.x * ratio;
        const maxLeft = found.rect.width - tip.offsetWidth - 4;
        tip.style.left = Math.max(4, Math.min(left - tip.offsetWidth / 2, maxLeft)) + 'px';
        tip.style.top = Math.max(4, found.hit.y * ratio - tip.offsetHeight - 12) + 'px';
        canvas.style.cursor = 'pointer';
    };

    canvas.addEventListener('mousemove', (e) => show(e.clientX, e.clientY));
    canvas.addEventListener('mouseleave', hide);
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length) show(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    canvas.addEventListener('touchend', () => setTimeout(hide, 2500), { passive: true });
}


function renderSavings() {
    let allMonths = new Set();
    const effectiveTrans = getEffectiveTransactions();

    // Add all months with transactions
    effectiveTrans.forEach(t => {
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

    let totalRealProfit = 0;
    let currentMonthRealProfit = 0;
    let totalSavings = 0;
    let totalRealSaved = 0;
    const tbody = document.querySelector('#table-savings-history tbody');
    tbody.innerHTML = '';

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

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
        totalRealSaved += data.savings;

        const realProfit = data.income - data.expense;
        totalRealProfit += realProfit;

        if (monthStr === currentMonthStr) {
            currentMonthRealProfit = realProfit;
        }

        const tr = document.createElement('tr');

        const formattedMonth = `${monthNames[month - 1]} ${year}`;

        // Define colors for UI
        const savingsClass = savingsForMonth >= 0 ? 'text-green' : 'text-red';
        const savingsSign = savingsForMonth >= 0 ? '+' : '';
        const realProfitClass = realProfit >= 0 ? 'text-green' : 'text-red';
        const realProfitSign = realProfit >= 0 ? '+' : '';
        const incomeColor = 'text-green';
        const incomeSign = '+';

        let invMonthHtml = '';
        if (appData.investmentsEnabled) {
            invMonthHtml = `<td data-label="Investi ce mois" class="col-investment-month">${data.investmentTransfers > 0 ? data.investmentTransfers.toFixed(2) + ' €' : '-'}</td>`;
        } else {
            invMonthHtml = `<td data-label="Investi ce mois" class="col-investment-month" style="display: none;"></td>`;
        }

        tr.innerHTML = `
            <td data-label="Mois">${formattedMonth}</td>
            <td data-label="Revenus réels" class="${incomeColor}">${incomeSign}${data.income.toFixed(2)} €</td>
            <td data-label="Objectif">${goal.toFixed(2)} €</td>
            <td data-label="Dépenses réelles" class="text-red">-${data.expense.toFixed(2)} €</td>
            <td data-label="Économie (Bilan)" class="${savingsClass}">${savingsSign}${savingsForMonth.toFixed(2)} €</td>
            <td data-label="Épargne du mois" class="text-primary">${data.savings > 0 ? '+' : ''}${data.savings.toFixed(2)} €</td>
            <td data-label="Bénéfice Réel" class="${realProfitClass}" style="font-weight: bold;">${realProfitSign}${realProfit.toFixed(2)} €</td>
            ${invMonthHtml}
        `;
        tbody.appendChild(tr);
    });

    if (sortedMonths.length === 0) {
        let colSpan = 7;
        if (appData.investmentsEnabled) colSpan++;
        tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center;">Aucune donnée disponible.</td></tr>`;
    }

    // Investment columns toggles
    const invColHeaders = document.querySelectorAll('.col-investment-month');
    invColHeaders.forEach(th => {
        th.style.display = appData.investmentsEnabled ? 'table-cell' : 'none';
    });

    const mvValContainer = document.getElementById('savings-view-mv-container');
    if (appData.mealVouchersEnabled) {
        mvValContainer.style.display = 'block';
        const mvData = calculateMealVoucherData();
        document.getElementById('savings-view-mv-val').textContent = '+' + mvData.spentLast12m.toFixed(2) + ' €';
    } else {
        mvValContainer.style.display = 'none';
    }

    // Recalculate global totals independently of grouped months for robustness
    let globalTotalProfit = 0;
    let globalCurrentMonthProfit = 0;
    let globalTotalSaved = 0;

    appData.transactions.forEach(t => {
        let profitDiff = 0;
        if (t.type === 'income') {
            profitDiff = t.amount;
        } else if (t.type === 'salary') {
            profitDiff = t.amount - (t.savedAmount || 0);
        } else if (t.type === 'expense') {
            let actualAmount = t.amount;
            let chartMode = window.currentChartMode || 'real';
            if (chartMode === 'real' && t.mealVoucherPart > 0) {
                actualAmount = t.amount - t.mealVoucherPart;
            }
            profitDiff = -actualAmount;
        }

        globalTotalProfit += profitDiff;

        if (t.date && t.date.startsWith(currentMonthStr)) {
            globalCurrentMonthProfit += profitDiff;
        }

        if (t.type === 'salary' && t.savedAmount) {
            globalTotalSaved += t.savedAmount;
        }
    });

    // Update Real Profit view (Cumul Total)
    const totalRealProfitElement = document.getElementById('savings-view-total');
    if (globalTotalProfit >= 0) {
        totalRealProfitElement.textContent = `+${globalTotalProfit.toFixed(2)} €`;
        totalRealProfitElement.className = 'text-green';
    } else {
        totalRealProfitElement.textContent = `${globalTotalProfit.toFixed(2)} €`;
        totalRealProfitElement.className = 'text-red';
    }

    // Update Real Profit view (Ce mois-ci)
    const currentMonthRealProfitElement = document.getElementById('savings-view-current-month');
    if (currentMonthRealProfitElement) {
        if (globalCurrentMonthProfit >= 0) {
            currentMonthRealProfitElement.textContent = `+${globalCurrentMonthProfit.toFixed(2)} €`;
            currentMonthRealProfitElement.className = 'text-green';
        } else {
            currentMonthRealProfitElement.textContent = `${globalCurrentMonthProfit.toFixed(2)} €`;
            currentMonthRealProfitElement.className = 'text-red';
        }
    }

    // Update Real Saved view
    const totalRealSavedElement = document.getElementById('savings-view-real-saved');
    totalRealSavedElement.textContent = `+${globalTotalSaved.toFixed(2)} €`;
}

function updateCategorySelectionTotal() {
    const totalSpan = document.getElementById('category-selection-total');
    if (!totalSpan) return;

    let total = 0;

    // We need to re-fetch the current chart data to get the amounts for selected labels
    const selector = document.getElementById('dashboard-category-month-selector');
    if (!selector) return;

    const selectedMonths = Array.from(selector.selectedOptions).map(opt => opt.value);
    const chartData = selectedMonths.length === 0 ? {} : getSpecificMonthsCategoryData(selectedMonths);

    selectedCategories.forEach(label => {
        if (chartData[label]) {
            total += chartData[label];
        }
    });

    totalSpan.textContent = total.toFixed(2);
}

function updateDashboardCategoryMonthSelector(currentYear, currentMonth) {
    const selector = document.getElementById('dashboard-category-month-selector');
    if (!selector) return;

    // Get all available months from transactions
    let allMonths = new Set();
    appData.transactions.forEach(t => {
        if (t.date && t.date.length >= 7) {
            allMonths.add(t.date.substring(0, 7));
        }
    });

    // Ensure current month is always available
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    allMonths.add(currentMonthStr);

    const sortedMonths = Array.from(allMonths).sort().reverse();

    // Store currently selected options to preserve them if possible
    const currentSelections = Array.from(selector.selectedOptions).map(opt => opt.value);

    selector.innerHTML = '';

    sortedMonths.forEach(monthStr => {
        const parts = monthStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const label = `${monthNames[m - 1]} ${y}`;

        const option = document.createElement('option');
        option.value = monthStr;
        option.textContent = label;

        // Default to current month if no previous selections, else keep previous selections
        if (currentSelections.length === 0) {
            if (monthStr === currentMonthStr) {
                option.selected = true;
            }
        } else {
            if (currentSelections.includes(monthStr)) {
                option.selected = true;
            }
        }

        selector.appendChild(option);
    });

    updateDashboardCategoryChart();
}

function updateDashboardCategoryChart() {
    const selector = document.getElementById('dashboard-category-month-selector');
    if (!selector) return;

    const selectedMonths = Array.from(selector.selectedOptions).map(opt => opt.value);

    let chartData;
    if (selectedMonths.length === 0) {
        chartData = {}; // Empty chart
    } else {
        chartData = getSpecificMonthsCategoryData(selectedMonths);
    }

    drawHorizontalBarChart('dashboardBarChartCategory', chartData);
}

function updateDashboard() {
    let currentYear, currentMonth;

    if (typeof checkMvReconciliation === 'function') {
        checkMvReconciliation();
    }

    const warningBanner = document.getElementById('dashboard-warning-banner');
    if (warningBanner) {
        const hasCorruptedTrans = appData.transactions.some(t => isNaN(t.amount) || t.amount === null || t.amount === undefined || !t.date);
        const hasCorruptedSub = appData.subscriptions.some(s => isNaN(s.amount) || s.amount === null || s.amount === undefined || !s.startDate);
        if (hasCorruptedTrans || hasCorruptedSub) {
            warningBanner.style.display = 'block';
        } else {
            warningBanner.style.display = 'none';
        }
    }

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

    // Update Patrimony Widget
    const patrimonyWidget = document.getElementById('dashboard-patrimony-widget');
    if (appData.investmentsEnabled && appData.investments && appData.investments.length > 0) {
        if(patrimonyWidget) patrimonyWidget.style.display = 'none'; // HIDDEN as requested
        const treasury = typeof getTreasuryBalance === 'function' ? getTreasuryBalance() : 0;
        const portfolio = typeof getPortfolioValue === 'function' ? getPortfolioValue() : 0;
        const netWorth = treasury + portfolio;

        const elTreasury = document.getElementById('dash-treasury');
        const elPortfolio = document.getElementById('dash-portfolio');
        const elNetWorth = document.getElementById('dash-net-worth');

        if(elTreasury) elTreasury.textContent = treasury.toFixed(2) + ' €';
        if(elPortfolio) elPortfolio.textContent = portfolio.toFixed(2) + ' €';
        if(elNetWorth) elNetWorth.textContent = netWorth.toFixed(2) + ' €';
    } else {
        if(patrimonyWidget) patrimonyWidget.style.display = 'none';
    }

    // Update current month summary cards
    const currentData = getMonthData(currentYear, currentMonth);
    document.getElementById('dash-income').textContent = '+' + currentData.income.toFixed(2) + ' €';
    document.getElementById('dash-expense').textContent = '-' + currentData.expense.toFixed(2) + ' €';

    const balance = currentData.income - currentData.expense;
    const balanceEl = document.getElementById('dash-balance');
    balanceEl.textContent = (balance >= 0 ? '+' : '') + balance.toFixed(2) + ' €';
    if (balance >= 0) {
        balanceEl.classList.add('text-green');
        balanceEl.classList.remove('text-red');
    } else {
        balanceEl.classList.add('text-red');
        balanceEl.classList.remove('text-green');
    }

    // Update Goal Progress Bar
    const progressBar = document.getElementById('goal-progress-bar');
    const currentMarker = document.getElementById('progress-current-marker');
    const currentText = document.getElementById('progress-current-text');
    const spentValueSpan = document.getElementById('progress-spent-value');
    const spentPercentSpan = document.getElementById('progress-spent-percent');
    const remainingText = document.getElementById('progress-remaining-text');
    const limitText = document.getElementById('progress-limit-text');
    const overWarning = document.getElementById('progress-over-warning');
    const overValue = document.getElementById('progress-over-value');

    let goal = appData.spendingGoal;
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    if (appData.monthlyGoals && appData.monthlyGoals[monthStr] !== undefined) {
        goal = appData.monthlyGoals[monthStr];
    }

    const spent = currentData.expense;

    if (goal <= 0) {
        // Handle edge case where goal is 0 or negative
        progressBar.style.width = '0%';
        currentMarker.style.left = '0%';
        currentText.style.left = '0%';
        spentValueSpan.textContent = spent.toFixed(2) + '€';
        spentPercentSpan.textContent = '0%';
        limitText.textContent = '0.00€';
        remainingText.style.display = 'none';
        overWarning.style.display = 'none';
    } else if (spent <= goal) {
        // Under or at goal
        const percentage = (spent / goal) * 100;
        const displayPercentage = Math.min(percentage, 100);

        // Apply widths and positions
        progressBar.style.width = displayPercentage + '%';
        currentMarker.style.left = displayPercentage + '%';
        currentText.style.left = displayPercentage + '%';

        // Reset text placements (in case we came back from overbudget)
        limitText.style.left = '100%';
        limitText.style.top = '28px'; // Reset to bottom
        document.getElementById('progress-limit-marker').style.left = '100%';

        // Update texts
        spentValueSpan.textContent = spent.toFixed(2) + '€';
        spentPercentSpan.textContent = percentage.toFixed(1) + '%';
        limitText.textContent = goal.toFixed(2) + '€';

        // Reset colors
        document.getElementById('progress-limit-marker').style.backgroundColor = 'var(--text-color)';
        limitText.style.color = 'var(--text-color)';

        const remaining = goal - spent;
        remainingText.textContent = remaining.toFixed(2) + '€';

        // Position remaining text in the middle of the empty space
        const remainingCenterPos = displayPercentage + ((100 - displayPercentage) / 2);
        remainingText.style.left = remainingCenterPos + '%';
        remainingText.style.display = 'block';

        // Colors (Apple blue / accent-color)
        progressBar.style.backgroundColor = 'var(--accent-color)';
        currentMarker.style.backgroundColor = 'var(--accent-color)';
        currentText.style.color = 'var(--accent-color)';

        overWarning.style.display = 'none';
    } else {
        // Over goal
        const overAmount = spent - goal;
        remainingText.style.display = 'none'; // Hide remaining text

        // Calculate the new scale (paliers)
        const numPaliers = Math.ceil(spent / goal);
        const scaleTotal = numPaliers * goal;

        // Calculate visual percentages based on the new scale
        const visualSpentPercentage = (spent / scaleTotal) * 100;
        const visualGoalPercentage = (goal / scaleTotal) * 100;
        const actualPercentageOfGoal = (spent / goal) * 100;

        // The progress bar extends up to the visualSpentPercentage
        progressBar.style.width = visualSpentPercentage + '%';
        progressBar.style.backgroundColor = 'var(--danger-color)';

        // The original marker now represents the goal, it becomes fixed at visualGoalPercentage
        currentMarker.style.left = visualGoalPercentage + '%';
        currentMarker.style.backgroundColor = 'var(--text-color)'; // Use neutral text color for the fixed goal marker

        // The currentText moves to the goal marker, showing the goal value
        currentText.style.left = visualGoalPercentage + '%';
        currentText.style.color = 'var(--text-color)';
        spentValueSpan.textContent = goal.toFixed(2) + '€';
        spentPercentSpan.textContent = '100%';

        // The limitText moves to the end of the red bar, showing the total spent value
        limitText.style.left = visualSpentPercentage + '%';
        limitText.style.top = '-30px'; // Move to top to avoid overlapping with goal text
        document.getElementById('progress-limit-marker').style.left = visualSpentPercentage + '%';
        limitText.textContent = spent.toFixed(2) + '€ / ' + actualPercentageOfGoal.toFixed(1) + '%';

        // Update marker visibility to act as the right bound of the red bar
        document.getElementById('progress-limit-marker').style.backgroundColor = 'var(--danger-color)';
        limitText.style.color = 'var(--danger-color)';

        // Show warning below
        overValue.textContent = overAmount.toFixed(2) + '€';
        overWarning.style.display = 'block';
    }

    // Draw Pie Chart for Categories
    drawPieChart('pieChartCategory', currentData.categoryExpenses);

    // Update Specific Month Selector for Dashboard Category Chart
    updateDashboardCategoryMonthSelector(currentYear, currentMonth);

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

    renderExtraCharts(currentYear, currentMonth);

    // Widgets additionnels du tableau de bord (voir bloc UI en fin de fichier)
    if (typeof renderDashboardExtras === 'function') {
        renderDashboardExtras(currentYear, currentMonth);
    }
}

/* =========================================================================
   Graphiques complementaires de l'onglet "Analyse > Graphiques"
   Tous se basent sur les transactions effectives et respectent le mode
   d'affichage cheques repas ("Total" / "Avec cheques repas").
   ========================================================================= */

// Montant d'une depense selon le mode d'affichage courant
function effectiveExpenseAmount(t) {
    const amount = Number(t.amount) || 0;
    const chartMode = window.currentChartMode || 'real';
    if (chartMode === 'real' && t.mealVoucherPart > 0) return amount - t.mealVoucherPart;
    return amount;
}

// Les N derniers mois (le dernier etant le mois affiche), du plus ancien au plus recent
function getRecentMonths(year, month, count) {
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
        let m = month - i;
        let y = year;
        while (m <= 0) { m += 12; y -= 1; }
        out.push({ year: y, month: m, prefix: y + '-' + String(m).padStart(2, '0') });
    }
    return out;
}

const MONTH_ABBR_FR = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

// Depenses de la periode selectionnee dans le bloc "Zoom sur les depenses"
function getExtraChartExpenses(year, month) {
    const select = document.getElementById('extra-chart-period');
    const months = select ? parseInt(select.value, 10) : 6;
    const prefixes = new Set(getRecentMonths(year, month, months).map(m => m.prefix));
    return getEffectiveTransactions().filter(t =>
        t.type === 'expense' && t.date && prefixes.has(t.date.substring(0, 7))
    );
}

/* ---- Solde cumule sur 12 mois ---- */
function renderCumulativeBalanceChart(year, month) {
    if (!document.getElementById('chartCumulativeBalance')) return;

    const months = getRecentMonths(year, month, 12);
    let running = 0;
    const points = months.map(m => {
        const data = getMonthData(m.year, m.month);
        const net = data.income - data.expense;
        running += net;
        return {
            label: MONTH_ABBR_FR[m.month - 1] + ' ' + String(m.year).slice(2),
            value: running,
            net: net
        };
    });

    points.forEach(p => {
        p.tooltip = [
            p.label,
            'Cumul : ' + fmtEuro(p.value),
            'Sur le mois : ' + (p.net >= 0 ? '+' : '-') + Math.abs(p.net).toFixed(2) + ' \u20ac'
        ];
    });

    drawAreaLineChart('chartCumulativeBalance', points, {
        height: 240,
        markers: true,
        tooltip: true,
        emptyMessage: 'Aucune donnee sur les 12 derniers mois'
    });
}

/* ---- Revenus vs depenses sur 12 mois ---- */
function renderIncomeExpense12Chart(year, month) {
    if (!document.getElementById('chartIncomeExpense12')) return;

    const dataArr = getRecentMonths(year, month, 12).map(m => {
        const data = getMonthData(m.year, m.month);
        data.label = MONTH_ABBR_FR[m.month - 1];
        data.month = m.month;
        data.year = m.year;
        return data;
    });

    drawBarChart('chartIncomeExpense12', dataArr);
}

/* ---- Taux d'epargne mensuel (part du revenu non depensee) ---- */
function renderSavingsRateChart(year, month) {
    if (!document.getElementById('chartSavingsRate')) return;

    const points = getRecentMonths(year, month, 12).map(m => {
        const data = getMonthData(m.year, m.month);
        const rate = data.income > 0 ? ((data.income - data.expense) / data.income) * 100 : 0;
        const p = {
            label: MONTH_ABBR_FR[m.month - 1] + ' ' + String(m.year).slice(2),
            value: Math.round(rate * 10) / 10
        };
        p.tooltip = [
            p.label,
            'Taux d\u2019\u00e9pargne : ' + p.value.toFixed(1) + ' %',
            'Revenus ' + fmtEuro(data.income) + ' \u00b7 D\u00e9penses ' + fmtEuro(data.expense)
        ];
        return p;
    });

    const hasData = points.some(p => p.value !== 0);
    drawAreaLineChart('chartSavingsRate', hasData ? points : [], {
        height: 240,
        markers: true,
        tooltip: true,
        unit: '%',
        color: chartColor('--success-color', '#12a150'),
        emptyMessage: 'Ajoutez des revenus pour calculer un taux d\u2019\u00e9pargne'
    });
}

/* ---- Depenses par jour de la semaine ---- */
function renderWeekdayChart(year, month) {
    if (!document.getElementById('chartWeekday')) return;

    const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const totals = [0, 0, 0, 0, 0, 0, 0];

    getExtraChartExpenses(year, month).forEach(t => {
        const d = new Date(t.date + 'T00:00:00');
        if (isNaN(d.getTime())) return;
        const idx = (d.getDay() + 6) % 7; // 0 = lundi
        totals[idx] += effectiveExpenseAmount(t);
    });

    const color = chartColor('--danger-color', '#e5484d');
    drawSimpleBarChart('chartWeekday', labels.map((label, i) => ({
        label: label,
        value: totals[i],
        color: color
    })), { height: 230 });
}

/* ---- Depense moyenne selon le jour du mois ---- */
function renderDayOfMonthChart(year, month) {
    if (!document.getElementById('chartDayOfMonth')) return;

    const totals = new Array(31).fill(0);
    const monthsSeen = new Set();

    getExtraChartExpenses(year, month).forEach(t => {
        const day = parseInt(t.date.substring(8, 10), 10);
        if (!day || day > 31) return;
        totals[day - 1] += effectiveExpenseAmount(t);
        monthsSeen.add(t.date.substring(0, 7));
    });

    const divisor = Math.max(1, monthsSeen.size);
    const color = chartColor('--accent-color', '#0a6cff');
    drawSimpleBarChart('chartDayOfMonth', totals.map((v, i) => ({
        label: String(i + 1),
        value: v / divisor,
        color: color
    })), { height: 230, sparseLabels: true });
}

/* ---- Repartition des depenses par tag ---- */
function renderTagExpensesChart(year, month) {
    if (!document.getElementById('chartTagExpenses')) return;

    const totals = {};
    getExtraChartExpenses(year, month).forEach(t => {
        if (!t.tagIds || !t.tagIds.length) return;
        const amount = effectiveExpenseAmount(t);
        t.tagIds.forEach(tagId => {
            totals[tagId] = (totals[tagId] || 0) + amount;
        });
    });

    const items = Object.entries(totals)
        .map(([tagId, value], i) => {
            const tag = (appData.tags || []).find(tg => tg.id === tagId);
            return {
                label: tag ? tag.name : 'Tag supprim\u00e9',
                value: value,
                color: (tag && tag.color) || CHART_PALETTE[i % CHART_PALETTE.length]
            };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    drawSimpleBarChart('chartTagExpenses', items, {
        horizontal: true,
        emptyMessage: 'Aucune d\u00e9pense tagu\u00e9e sur cette p\u00e9riode'
    });
}

/* ---- Les 10 plus grosses depenses ---- */
function renderTopExpensesChart(year, month) {
    if (!document.getElementById('chartTopExpenses')) return;

    const color = chartColor('--danger-color', '#e5484d');
    const items = getExtraChartExpenses(year, month)
        .map(t => {
            const cat = appData.categories.find(c => c.id === t.categoryId);
            return {
                label: t.note || (cat ? cat.name : 'Sans titre'),
                value: effectiveExpenseAmount(t),
                color: color
            };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    drawSimpleBarChart('chartTopExpenses', items, {
        horizontal: true,
        emptyMessage: 'Aucune d\u00e9pense sur cette p\u00e9riode'
    });
}

// Redessine l'ensemble des graphiques complementaires
function renderExtraCharts(year, month) {
    renderCumulativeBalanceChart(year, month);
    renderIncomeExpense12Chart(year, month);
    renderSavingsRateChart(year, month);
    renderWeekdayChart(year, month);
    renderDayOfMonthChart(year, month);
    renderTagExpensesChart(year, month);
    renderTopExpensesChart(year, month);
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
/** Retourne la catégorie correspondant à un chemin complet « Parent > Enfant ». */
function getCategoryByPath(path) {
    return appData.categories.find(c => getCategoryPath(c.id) === path) || null;
}

/** Type ('expense' par défaut) de la catégorie désignée par son chemin complet. */
function getCategoryTypeByPath(path) {
    const cat = getCategoryByPath(path);
    return cat ? cat.type : 'expense';
}

function getCategoryPath(catId, visited = new Set(), forTable = false) {
    const cat = appData.categories.find(c => c.id === catId);
    if (!cat) return 'Inconnu';

    // Check for circular dependency
    if (visited.has(catId)) {
        return cat.name + " (Erreur: Boucle détectée)";
    }
    visited.add(catId);

    const separator = forTable ? '<span class="cat-sep"> &gt; </span>' : ' > ';

    if (cat.parentId) {
        return getCategoryPath(cat.parentId, visited, forTable) + separator + cat.name;
    }
    return cat.name;
}

function updateCategorySelects() {
    const parentSelect = document.getElementById('cat-parent');
    const transSelect = document.getElementById('trans-category');
    const subSelect = document.getElementById('sub-category');
    const mvCategoriesSelect = document.getElementById('setting-meal-vouchers-categories');

    // Clear
    parentSelect.innerHTML = '<option value="">-- Aucune (Catégorie principale) --</option>';
    transSelect.innerHTML = '';
    subSelect.innerHTML = '';
    if (mvCategoriesSelect) mvCategoriesSelect.innerHTML = '';

    // Create a sorted list of categories
    const sortedCategories = [...appData.categories].sort((a, b) => {
        const pathA = getCategoryPath(a.id);
        const pathB = getCategoryPath(b.id);
        return pathA.localeCompare(pathB);
    });

    sortedCategories.forEach(cat => {
        if (!cat.parentId) {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            parentSelect.appendChild(option);
        }

        if (mvCategoriesSelect && cat.type === 'expense') {
            const path = getCategoryPath(cat.id);
            const prefix = '🔴 ';
            const mvOption = document.createElement('option');
            mvOption.value = cat.id;
            mvOption.textContent = prefix + path;
            if (appData.mealVoucherEligibleCategories && appData.mealVoucherEligibleCategories.includes(cat.id)) {
                mvOption.selected = true;
            }
            mvCategoriesSelect.appendChild(mvOption);
        }
    });

    // Filter by type for transactions/subscriptions based on their selected type
    const populateTransSelect = () => {
        let transType = document.getElementById('trans-type').value;
        if (transType === 'salary') transType = 'income'; // Share income categories for salary
        if (transType === 'investment_transfer') transType = 'expense';
        if (transType === 'investment_return') transType = 'income';

        transSelect.innerHTML = '';
        sortedCategories.filter(c => c.type === transType).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = getCategoryPath(c.id);
            transSelect.appendChild(opt);
        });
    };

    const populateSubSelect = () => {
        const subType = document.getElementById('sub-type').value;
        subSelect.innerHTML = '';
        sortedCategories.filter(c => c.type === subType).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = getCategoryPath(c.id);
            subSelect.appendChild(opt);
        });
    };

    // Populate Parent Category Select (all categories allowed)
    sortedCategories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = getCategoryPath(c.id) + (c.type === 'income' ? ' (Revenu)' : ' (Dépense)');
        parentSelect.appendChild(opt);
    });

    populateTransSelect();
    populateSubSelect();
    syncQuickAddCategories();

    // Event listeners to update on type change
    document.getElementById('trans-type').addEventListener('change', (e) => {
        populateTransSelect();
        const type = e.target.value;
        const savingsGroup = document.getElementById('trans-savings-group');
        const amountLabel = document.getElementById('trans-amount-label');
        const investmentGroup = document.getElementById('trans-investment-group');

        if (type === 'salary') {
            savingsGroup.style.display = 'block';
            amountLabel.textContent = 'Montant Total du Salaire (€)';
        } else {
            savingsGroup.style.display = 'none';
            amountLabel.textContent = 'Montant (€)';
        }

        if (type === 'investment_transfer' || type === 'investment_return') {
            if(investmentGroup) investmentGroup.style.display = 'block';
            populateTransInvestmentSelect();
        } else {
            if(investmentGroup) investmentGroup.style.display = 'none';
        }

        const linkedExpenseGroup = document.getElementById('trans-linked-expense-group');
        if (linkedExpenseGroup) {
            if (type === 'income') {
                linkedExpenseGroup.style.display = 'block';
                populateLinkedExpenseSelect();
            } else {
                linkedExpenseGroup.style.display = 'none';
            }
        }

        updateMvFormFields();
    });

    function populateLinkedExpenseSelect() {
        const select = document.getElementById('trans-linked-expense');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Aucune (Revenu standard) --</option>';

        // Show recent expenses (e.g. last 6 months)
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - 6);
        const recentExpenses = appData.transactions
            .filter(t => t.type === 'expense' && new Date(t.date) >= cutoffDate)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        recentExpenses.forEach(exp => {
            const opt = document.createElement('option');
            opt.value = exp.id;
            const categoryName = getCategoryPath(exp.categoryId);
            opt.textContent = `${exp.date} - ${categoryName} - ${exp.note ? exp.note + ' - ' : ''}${exp.amount.toFixed(2)}€`;
            select.appendChild(opt);
        });

        if (currentValue) {
            // If the currently selected value is older than 6 months it won't be in the list, so we add it manually
            if (!recentExpenses.some(t => t.id === currentValue)) {
                const exp = appData.transactions.find(t => t.id === currentValue);
                if (exp) {
                    const opt = document.createElement('option');
                    opt.value = exp.id;
                    const categoryName = getCategoryPath(exp.categoryId);
                    opt.textContent = `${exp.date} - ${categoryName} - ${exp.note ? exp.note + ' - ' : ''}${exp.amount.toFixed(2)}€`;
                    select.appendChild(opt);
                }
            }
            select.value = currentValue;
        }
    }

    document.getElementById('trans-investment-id').addEventListener('change', (e) => {
        const newFields = document.getElementById('trans-investment-new-fields');
        if (e.target.value === '') {
            newFields.style.display = 'block';
        } else {
            newFields.style.display = 'none';
        }
    });

    function populateTransInvestmentSelect() {
        const select = document.getElementById('trans-investment-id');
        select.innerHTML = '<option value="">-- Créer un nouvel actif --</option>';
        if (appData.investments) {
            appData.investments.forEach(inv => {
                const option = document.createElement('option');
                option.value = inv.id;
                option.textContent = `${inv.name} (${inv.type}) - ${inv.status === 'closed' ? 'Clôturé' : 'Actif'}`;
                select.appendChild(option);
            });
        }
        select.dispatchEvent(new Event('change'));
    }

    document.getElementById('trans-category').addEventListener('change', updateMvFormFields);

    document.getElementById('sub-type').addEventListener('change', populateSubSelect);
}

function updateMvFormFields() {
    const type = document.getElementById('trans-type').value;
    const catId = document.getElementById('trans-category').value;
    const mvGroup = document.getElementById('trans-mv-group');
    const mvSuggestion = document.getElementById('trans-mv-suggestion');
    const mvInput = document.getElementById('trans-mv-part');

    if (!appData.mealVouchersEnabled || type !== 'expense' || !appData.mealVoucherEligibleCategories || !appData.mealVoucherEligibleCategories.includes(catId)) {
        if (mvGroup) mvGroup.style.display = 'none';
        if (mvInput) mvInput.value = '';
        return;
    }

    if (mvGroup) mvGroup.style.display = 'block';

    const { availableBalance } = calculateMealVoucherData();
    if (availableBalance > 0 && (!mvInput.value || parseFloat(mvInput.value) === 0)) {
        if (mvSuggestion) mvSuggestion.style.display = 'block';
    } else {
        if (mvSuggestion) mvSuggestion.style.display = 'none';
    }
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
        const dropTarget = e.target.closest('.cat-dropzone, .cat-drop-target');
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
        const dropTarget = e.target.closest('.cat-dropzone, .cat-drop-target');
        if (dropTarget) {
            dropTarget.classList.remove('drop-hover');
            dropTarget.classList.remove('drop-invalid');
        }
    };

    const handleDrop = async (e, targetId) => {
        e.preventDefault();
        const dropTarget = e.target.closest('.cat-dropzone, .cat-drop-target');
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

    // Totaux de la période sélectionnée + filtre de recherche
    const range = getCategoryTreeRange();
    const totals = computeCategoryTotals(range);
    const searchInput = document.getElementById('cat-search');
    // Recherche insensible à la casse et aux accents (« hot » trouve « Hôtel »)
    const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const search = normalize((searchInput ? searchInput.value : '').trim());

    const matchesSearch = (catId) => {
        if (!search) return true;
        const cat = appData.categories.find(c => c.id === catId);
        if (cat && normalize(cat.name).includes(search)) return true;
        return appData.categories.some(c => c.parentId === catId && matchesSearch(c.id));
    };

    const buildTree = (parentId, parentElement) => {
        const children = appData.categories
            .filter(c => c.parentId === parentId)
            .filter(c => matchesSearch(c.id));

        if (children.length === 0) return;

        const childrenContainer = document.createElement('div');
        if (parentId) {
            childrenContainer.className = 'cat-children-container';
        }

        children.forEach(cat => {
            const wrapper = document.createElement('div');
            wrapper.className = 'cat-wrapper';

            const el = document.createElement('div');
            el.className = 'cat-item cat-drop-target';
            el.draggable = true;
            el.dataset.id = cat.id;

            el.addEventListener('dragstart', (e) => handleDragStart(e, cat.id));
            el.addEventListener('dragend', handleDragEnd);
            el.addEventListener('dragover', handleDragOver);
            el.addEventListener('dragleave', handleDragLeave);
            el.addEventListener('drop', (e) => handleDrop(e, cat.id));

            const hasChildren = appData.categories.some(c => c.parentId === cat.id);
            // Une recherche active déplie tout, sinon on respecte le choix de l'utilisateur
            const collapsed = hasChildren && !search && collapsedCategories.has(cat.id);

            const isIncome = cat.type === 'income';
            const stats = totals[cat.id] || { own: 0, subtree: 0 };
            const sign = isIncome ? '+' : '-';
            const amountClass = isIncome ? 'text-green' : 'text-red';
            const zero = stats.subtree === 0;

            const toggle = hasChildren
                ? `<button type="button" class="cat-toggle${collapsed ? ' is-collapsed' : ''}" aria-label="Plier ou déplier">
                       <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                   </button>`
                : '<span class="cat-toggle-spacer"></span>';

            const badge = !parentId
                ? `<span class="cat-type-badge ${isIncome ? 'badge-income' : 'badge-expense'}">${isIncome ? 'Revenu' : 'Dépense'}</span>`
                : '';

            // Pour un parent, on affiche le cumul du sous-arbre et, s'il diffère,
            // la part imputée directement à la catégorie elle-même.
            const showOwn = hasChildren && stats.own > 0 && stats.own !== stats.subtree;
            const amountBlock = `
                <span class="cat-amounts">
                    <span class="cat-amount ${zero ? 'is-zero' : amountClass}">${zero ? '0.00 €' : sign + stats.subtree.toFixed(2) + ' €'}</span>
                    ${showOwn ? `<span class="cat-amount-own">dont ${stats.own.toFixed(2)} € en direct</span>` : ''}
                </span>`;

            const fullPath = getCategoryPath(cat.id);
            el.innerHTML = `
                <span class="drag-handle" title="Glisser pour déplacer">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
                </span>
                ${toggle}
                <button type="button" class="cat-name-btn" title="Voir le détail des transactions">
                    <span class="cat-name">${cat.name}</span>
                    ${badge}
                </button>
                ${amountBlock}
                <button type="button" class="cat-delete" title="Supprimer la catégorie" aria-label="Supprimer ${cat.name}">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                </button>
            `;

            el.querySelector('.cat-name-btn').addEventListener('click', () => {
                showCategoryDetails(fullPath, 0, {
                    dateStart: range.start,
                    dateEnd: range.end,
                    allTime: !range.start && !range.end
                });
            });

            el.querySelector('.cat-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCategory(cat.id);
            });

            const toggleBtn = el.querySelector('.cat-toggle');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (collapsedCategories.has(cat.id)) {
                        collapsedCategories.delete(cat.id);
                    } else {
                        collapsedCategories.add(cat.id);
                    }
                    renderCategoryTree();
                });
            }

            wrapper.appendChild(el);
            childrenContainer.appendChild(wrapper);

            // Recursively build children inside this wrapper
            if (!collapsed) buildTree(cat.id, wrapper);
        });

        parentElement.appendChild(childrenContainer);
    };

    buildTree(null, container);

    if (!container.querySelector('.cat-item')) {
        const empty = document.createElement('p');
        empty.className = 'muted cat-empty';
        empty.textContent = search
            ? 'Aucune catégorie ne correspond à cette recherche.'
            : 'Aucune catégorie pour le moment.';
        container.appendChild(empty);
    }

    renderCategorySummary(totals, range);
}


/** Catégories repliées dans l'arborescence des réglages (état d'affichage seulement). */
const collapsedCategories = new Set();

/**
 * Intervalle de dates ({start, end} au format YYYY-MM-DD, null = borne ouverte)
 * choisi dans la barre d'outils de l'écran Catégories.
 */
function getCategoryTreeRange() {
    const select = document.getElementById('cat-period');
    const mode = select ? select.value : 'all';
    const now = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const monthsBack = (n) => iso(new Date(now.getFullYear(), now.getMonth() - n + 1, 1));

    switch (mode) {
        case 'current_month':
            return { start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end: iso(now), label: 'Mois en cours' };
        case 'last_3':
            return { start: monthsBack(3), end: iso(now), label: '3 derniers mois' };
        case 'last_6':
            return { start: monthsBack(6), end: iso(now), label: '6 derniers mois' };
        case 'last_12':
            return { start: monthsBack(12), end: iso(now), label: '12 derniers mois' };
        case 'current_year':
            return { start: `${now.getFullYear()}-01-01`, end: iso(now), label: 'Année en cours' };
        case 'custom': {
            const start = document.getElementById('cat-date-start');
            const end = document.getElementById('cat-date-end');
            return {
                start: start && start.value ? start.value : null,
                end: end && end.value ? end.value : null,
                label: 'Intervalle personnalisé'
            };
        }
        default:
            return { start: null, end: null, label: "Tout l'historique" };
    }
}

/**
 * Totaux par catégorie sur un intervalle de dates.
 * @returns {Object} catId -> { own, subtree } ; `own` ne compte que les
 *          transactions imputées directement à la catégorie, `subtree` y ajoute
 *          celles de toutes ses descendantes.
 */
function computeCategoryTotals(range) {
    const totals = {};
    appData.categories.forEach(c => { totals[c.id] = { own: 0, subtree: 0 }; });

    const chartMode = window.currentChartMode || 'real';

    getEffectiveTransactions().forEach(t => {
        if (!t.categoryId || !totals[t.categoryId]) return;
        if (t.type === 'investment_transfer' || t.type === 'investment_return') return;
        if (range.start && (!t.date || t.date < range.start)) return;
        if (range.end && (!t.date || t.date > range.end)) return;

        let amount = Math.abs(t.amount);
        if (t.type === 'expense' && chartMode === 'real' && t.mealVoucherPart > 0) {
            amount -= t.mealVoucherPart;
        }

        totals[t.categoryId].own += amount;

        // Remonter la chaîne des parents pour alimenter les cumuls
        let current = t.categoryId;
        const seen = new Set();
        while (current && totals[current] && !seen.has(current)) {
            seen.add(current);
            totals[current].subtree += amount;
            const cat = appData.categories.find(c => c.id === current);
            current = cat ? cat.parentId : null;
        }
    });

    return totals;
}

/** Bandeau récapitulatif au-dessus de l'arborescence (dépenses / revenus de la période). */
function renderCategorySummary(totals, range) {
    const box = document.getElementById('cat-summary');
    if (!box) return;

    let expense = 0;
    let income = 0;
    appData.categories.forEach(c => {
        if (c.parentId) return; // les racines cumulent déjà leurs descendantes
        const stats = totals[c.id];
        if (!stats) return;
        if (c.type === 'income') income += stats.subtree;
        else expense += stats.subtree;
    });

    const periodText = (range.start || range.end)
        ? `${range.label} (${range.start || '…'} → ${range.end || '…'})`
        : range.label;

    box.innerHTML = `
        <div class="cat-summary-period">${periodText}</div>
        <div class="cat-summary-figures">
            <span>Dépenses <strong class="text-red">-${expense.toFixed(2)} €</strong></span>
            <span>Revenus <strong class="text-green">+${income.toFixed(2)} €</strong></span>
        </div>`;
}

/**
 * Processes appData.transactions to apply refunds to their linked expenses.
 * - Reduces the amount of the linked expense by the refund amount (min 0).
 * - Removes the refund transaction from the returned list (since it's applied retroactively).
 * @param {Array} transactions - The list of transactions to process (defaults to appData.transactions)
 * @returns {Array} - The effective list of transactions.
 */
function getEffectiveTransactions(transactions = appData.transactions) {
    if (!transactions) return [];

    const effectiveTrans = JSON.parse(JSON.stringify(transactions)); // Deep copy to avoid mutating appData
    const refundsByExpense = {};
    const refundsToRemove = new Set();

    // 1. Identify refunds
    effectiveTrans.forEach(t => {
        if (t.type === 'income' && t.linkedExpenseId) {
            refundsToRemove.add(t.id);
            if (!refundsByExpense[t.linkedExpenseId]) {
                refundsByExpense[t.linkedExpenseId] = 0;
            }
            refundsByExpense[t.linkedExpenseId] += t.amount;
        }
    });

    // 2. Apply refunds to expenses and filter out the refund transactions
    return effectiveTrans
        .filter(t => !refundsToRemove.has(t.id))
        .map(t => {
            if (t.type === 'expense' && refundsByExpense[t.id]) {
                t.amount = Math.max(0, t.amount - refundsByExpense[t.id]);
                t.isRefunded = true; // Mark it so UI could know if needed in other places, though renderTransactions uses raw data.
            }
            return t;
        });
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

    if (typeof window.updateNavigationVisibility === 'function') {
        window.updateNavigationVisibility();
    }

    updateDashboard(); // Initial render

    // Refresh all views based on new data
    renderTransactions();
    renderSubscriptions();
    processSubscriptions();
    updateCategorySelects();
    renderCategoryTree();
    renderSimulations();
    updatePredictionChart();
    if (typeof window.renderMealVouchers === 'function') {
        window.renderMealVouchers();
    }
    if (typeof window.seedDefaultTrips === 'function') {
        await window.seedDefaultTrips();
    }
    if (typeof window.renderTrips === 'function') {
        window.renderTrips();
        window.renderTripsCompare();
    }

    const goalInput = document.getElementById('setting-spending-goal');
    goalInput.value = appData.spendingGoal;
}

document.addEventListener('DOMContentLoaded', () => {
    window.currentChartMode = 'real';

    const dashMvToggle = document.getElementById('dashboard-mv-toggle');
    const chartsMvToggle = document.getElementById('charts-mv-toggle');

    if (dashMvToggle) {
        dashMvToggle.addEventListener('change', (e) => {
            window.currentChartMode = e.target.value;
            if (chartsMvToggle) chartsMvToggle.value = e.target.value; // Sync
            updateDashboard();
            updateDashboardCategoryChart();
        });
    }

    if (chartsMvToggle) {
        chartsMvToggle.addEventListener('change', (e) => {
            window.currentChartMode = e.target.value;
            if (dashMvToggle) dashMvToggle.value = e.target.value; // Sync
            // Re-render charts tab
            const now = new Date();
            let year = now.getFullYear();
            let month = now.getMonth() + 1;
            drawPieChart('pieChartCategory', getMonthData(year, month).categoryExpenses);
            updateHorizontalBarChart(year, month);
            renderExtraCharts(year, month);
        });
    }

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

    // --- PREDICTION LISTENERS ---
    const simForm = document.getElementById('form-simulation');
    if (simForm) {
        simForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('sim-id').value || generateId();
            const name = document.getElementById('sim-name').value;
            const type = document.getElementById('sim-type').value;
            const amount = parseFloat(document.getElementById('sim-amount').value);
            const frequency = document.getElementById('sim-frequency').value;
            const startDate = document.getElementById('sim-date').value;

            const sim = { id, name, type, amount, frequency, startDate };

            const existingIndex = appData.simulations.findIndex(s => s.id === id);
            if (existingIndex >= 0) {
                appData.simulations[existingIndex] = sim;
            } else {
                appData.simulations.push(sim);
            }

            simForm.reset();
            document.getElementById('sim-id').value = '';

            renderSimulations();
            updatePredictionChart();
        });
    }

    const simBalanceInput = document.getElementById('sim-current-balance');
    if (simBalanceInput) {
        simBalanceInput.addEventListener('input', () => {
            appData.simulationBalance = parseFloat(simBalanceInput.value) || 0;
            updatePredictionChart();
        });
    }

    const btnSaveSimulations = document.getElementById('btn-save-simulations');
    if (btnSaveSimulations) {
        btnSaveSimulations.addEventListener('click', async () => {
            await saveData();
            alert('Simulations enregistrées avec succès.');
        });
    }

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

    // Periode du bloc "Zoom sur les depenses"
    const extraPeriodSelect = document.getElementById('extra-chart-period');
    if (extraPeriodSelect) {
        extraPeriodSelect.addEventListener('change', () => {
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
            renderWeekdayChart(year, month);
            renderDayOfMonthChart(year, month);
            renderTagExpensesChart(year, month);
            renderTopExpensesChart(year, month);
        });
    }

    // Handle FAB display based on current view
    function updateFabVisibility(targetId) {
        const fab = document.getElementById('fab-add');
        if (targetId === 'dashboard' || targetId === 'transactions' || targetId === 'subscriptions') {
            fab.style.display = 'flex';
        } else {
            fab.style.display = 'none';
        }
    }

    // Handle frequency change in subscription form
    const subFrequencySelect = document.getElementById('sub-frequency');
    if (subFrequencySelect) {
        subFrequencySelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const amountGroup = document.getElementById('sub-amount-group');
            const installmentsGroup = document.getElementById('sub-installments-group');

            if (val === 'installments') {
                amountGroup.style.display = 'none';
                installmentsGroup.style.display = 'block';
                document.getElementById('sub-amount').required = false;
                document.getElementById('sub-total-amount').required = true;
                document.getElementById('sub-installments-count').required = true;
            } else {
                amountGroup.style.display = 'block';
                installmentsGroup.style.display = 'none';
                document.getElementById('sub-amount').required = true;
                document.getElementById('sub-total-amount').required = false;
                document.getElementById('sub-installments-count').required = false;
            }
        });
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
        } else if(targetId === 'investments') {
            if(typeof renderInvestments === 'function') renderInvestments();
        } else if(targetId === 'meal-vouchers' || targetId === 'meal-vouchers-shared') {
            if(typeof window.renderMealVouchers === 'function') window.renderMealVouchers();
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

        if (activeSection === 'dashboard') {
            // Depuis l'accueil, on ouvre le formulaire complet pre-rempli
            const advancedBtn = document.getElementById('btn-qa-advanced');
            if (advancedBtn) advancedBtn.click();
            return;
        }

        if (activeSection === 'transactions') {
            modalTitle.textContent = "Ajouter une transaction";
            // On déplace le container parent '.form-panel' pour qu'il bénéficie des règles CSS
            mobileModalContainer.appendChild(formOriginalParents['form-transaction']);
            resetTransactionForm();
        } else if (activeSection === 'subscriptions') {
            modalTitle.textContent = "Ajouter un abonnement";
            mobileModalContainer.appendChild(formOriginalParents['form-subscription']);
            resetSubscriptionForm();
        }

        mobileModal.classList.add('active');
    });

    btnCloseMobileModal.addEventListener('click', () => {
        mobileModal.classList.remove('active');
        // Restore forms to their original locations in the split-layout
        if (formOriginalParents['form-transaction'].parentElement === mobileModalContainer) {
            document.querySelector('#transactions .split-layout').insertBefore(formOriginalParents['form-transaction'], document.querySelector('#transactions .list-panel'));
        }
        if (formOriginalParents['form-subscription'].parentElement === mobileModalContainer) {
            document.querySelector('#subscriptions .split-layout').insertBefore(formOriginalParents['form-subscription'], document.querySelector('#subscriptions .list-panel'));
        }
    });

    // Handle Edit button click on mobile to open modal
    // On desktop and mobile, editTransaction now uses openEditModal.
    // So we don't need to override editTransaction and editSubscription here anymore.

    // Close modals on submit
    // Note: This logic has been moved to the specific submit handlers for form-transaction and form-subscription
    // to prevent closing and resetting the form *before* the data is extracted and saved.

    // Mode Sélection Listeners
    const btnToggleCategorySelection = document.getElementById('btn-toggle-category-selection');
    if (btnToggleCategorySelection) {
        btnToggleCategorySelection.addEventListener('click', () => {
            isCategorySelectionMode = !isCategorySelectionMode;
            if (isCategorySelectionMode) {
                btnToggleCategorySelection.classList.remove('btn-secondary');
                btnToggleCategorySelection.classList.add('btn-primary');
                document.getElementById('category-selection-total-container').style.display = 'block';
            } else {
                btnToggleCategorySelection.classList.remove('btn-primary');
                btnToggleCategorySelection.classList.add('btn-secondary');
                document.getElementById('category-selection-total-container').style.display = 'none';
                selectedCategories.clear();
            }
            updateCategorySelectionTotal();
            updateDashboardCategoryChart();
        });
    }

    const btnToggleTransactionSelection = document.getElementById('btn-toggle-transaction-selection');
    if (btnToggleTransactionSelection) {
        btnToggleTransactionSelection.addEventListener('click', () => {
            isTransactionSelectionMode = !isTransactionSelectionMode;
            if (isTransactionSelectionMode) {
                btnToggleTransactionSelection.classList.remove('btn-secondary');
                btnToggleTransactionSelection.classList.add('btn-primary');
                document.getElementById('transaction-selection-total-container').style.display = 'block';
            } else {
                btnToggleTransactionSelection.classList.remove('btn-primary');
                btnToggleTransactionSelection.classList.add('btn-secondary');
                document.getElementById('transaction-selection-total-container').style.display = 'none';
                selectedTransactionIds.clear();
            }
            updateTransactionSelectionTotal();
            renderTransactions();
        });
    }

    // Dashboard Category Selector Listener
    const dashCategoryMonthSelector = document.getElementById('dashboard-category-month-selector');
    if (dashCategoryMonthSelector) {
        dashCategoryMonthSelector.addEventListener('change', () => {
            updateDashboardCategoryChart();
            if (isCategorySelectionMode) {
                updateCategorySelectionTotal();
            }
        });
    }

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

    // 4.4b Barre d'outils de l'arborescence : période et recherche
    const catPeriodSelect = document.getElementById('cat-period');
    if (catPeriodSelect) {
        const syncCustomDates = () => {
            const box = document.getElementById('cat-custom-dates');
            if (box) box.style.display = catPeriodSelect.value === 'custom' ? 'flex' : 'none';
        };
        syncCustomDates();

        catPeriodSelect.addEventListener('change', () => {
            syncCustomDates();
            renderCategoryTree();
        });

        ['cat-date-start', 'cat-date-end'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.addEventListener('change', renderCategoryTree);
        });

        const catSearch = document.getElementById('cat-search');
        if (catSearch) catSearch.addEventListener('input', renderCategoryTree);
    }


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
        const savedAmount = type === 'salary' ? parseFloat(document.getElementById('trans-savings-amount').value) || 0 : undefined;
        const date = document.getElementById('trans-date').value;
        const categoryId = document.getElementById('trans-category').value;
        const note = document.getElementById('trans-note').value;
        const transId = document.getElementById('trans-id').value;

        let mealVoucherPart = 0;
        const mvInputGroup = document.getElementById('trans-mv-group');
        if (mvInputGroup && mvInputGroup.style.display !== 'none') {
            const mvValue = parseFloat(document.getElementById('trans-mv-part').value);
            if (!isNaN(mvValue) && mvValue > 0) {
                if (mvValue > amount) {
                    alert("La part payée en chèques repas ne peut pas dépasser le montant total de la transaction.");
                    return;
                }
                mealVoucherPart = mvValue;
            }
        }

        let tagIds = [];
        try {
            tagIds = JSON.parse(document.getElementById('trans-selected-tags').value);
        } catch(e) {}

        let linkedExpenseId = undefined;
        if (type === 'income') {
            const linkedSelect = document.getElementById('trans-linked-expense');
            if (linkedSelect && linkedSelect.value) {
                linkedExpenseId = linkedSelect.value;
            }
        }

        let investmentId = undefined;

        if (type === 'investment_transfer' || type === 'investment_return') {
            const selectId = document.getElementById('trans-investment-id').value;
            if (selectId === '') {
                // Create new investment
                const newInvName = document.getElementById('trans-investment-name').value || 'Nouvel actif';
                const newInvType = document.getElementById('trans-investment-type').value;
                investmentId = 'inv-' + generateId();

                const newInvestment = {
                    id: investmentId,
                    name: newInvName,
                    type: newInvType,
                    acquisitionDate: date,
                    status: 'active',
                    valueHistory: []
                };

                // Add initial value history entry if it's a transfer (buying)
                if (type === 'investment_transfer') {
                    newInvestment.valueHistory.push({
                        id: 'vh-' + generateId(),
                        date: date,
                        value: amount
                    });
                }

                if(!appData.investments) appData.investments = [];
                appData.investments.push(newInvestment);
            } else {
                investmentId = selectId;
            }
        }

        if (transId) {
            // Update
            const transIndex = appData.transactions.findIndex(t => t.id === transId);
            if (transIndex !== -1) {
                appData.transactions[transIndex] = {
                    id: transId,
                    type,
                    amount,
                    mealVoucherPart: mealVoucherPart > 0 ? mealVoucherPart : undefined,
                    savedAmount,
                    date,
                    categoryId,
                    note,
                    tagIds,
                    investmentId,
                    linkedExpenseId
                };
            }
        } else {
            // Add new
            const newTrans = {
                id: 'trans-' + generateId(),
                type,
                amount,
                mealVoucherPart: mealVoucherPart > 0 ? mealVoucherPart : undefined,
                savedAmount,
                date,
                categoryId,
                note,
                tagIds,
                investmentId,
                linkedExpenseId
            };
            appData.transactions.push(newTrans);
        }

        if (typeof updateInvestmentsStatus === 'function') {
            updateInvestmentsStatus();
        }
        await saveData();
        resetTransactionForm();
        renderTransactions();
        updateDashboard();

        // Close modals if active
        const mobileModal = document.getElementById('mobile-form-modal');
        const btnCloseMobileModal = document.getElementById('btn-close-mobile-modal');
        if(mobileModal && mobileModal.classList.contains('active')) {
             btnCloseMobileModal.click();
        }
        if(document.getElementById('edit-modal-overlay').classList.contains('active')) {
             closeEditModal();
        }
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
        const frequency = document.getElementById('sub-frequency').value;

        let amount = 0;
        let totalAmount = undefined;
        let totalInstallments = undefined;

        if (frequency === 'installments') {
            totalAmount = parseFloat(document.getElementById('sub-total-amount').value);
            totalInstallments = parseInt(document.getElementById('sub-installments-count').value, 10);
            amount = totalAmount / totalInstallments;
        } else {
            amount = parseFloat(document.getElementById('sub-amount').value);
        }

        const categoryId = document.getElementById('sub-category').value;
        const startDate = document.getElementById('sub-start-date').value;
        const endDate = document.getElementById('sub-end-date').value || null;
        const subId = document.getElementById('sub-id').value;
        const applyToPast = document.getElementById('sub-apply-past').checked;

        if (subId) {
            // Update
            const subIndex = appData.subscriptions.findIndex(s => s.id === subId);
            if (subIndex !== -1) {
                const oldName = appData.subscriptions[subIndex].name;
                const currentStatus = appData.subscriptions[subIndex].status;

                let newStatus = currentStatus;
                if (endDate && appData.subscriptions[subIndex].nextDate > endDate) {
                    newStatus = 'completed';
                } else if (newStatus === 'completed' && (!endDate || appData.subscriptions[subIndex].nextDate <= endDate)) {
                    // Si on enlève la date de fin ou la repousse, réactiver si c'était terminé
                    if (frequency !== 'installments' || appData.subscriptions[subIndex].installmentsPaid < totalInstallments) {
                        newStatus = 'active';
                    }
                }

                appData.subscriptions[subIndex] = {
                    ...appData.subscriptions[subIndex],
                    type,
                    name,
                    amount,
                    totalAmount,
                    totalInstallments,
                    categoryId,
                    frequency,
                    endDate,
                    status: newStatus
                    // Note: If they changed start date and we need to retroactively change nextDate, it's tricky, we'll just leave nextDate as is or reset if they moved start date far in future
                };

                // Apply changes to past transactions (Option A)
                if (applyToPast) {
                    appData.transactions.forEach(t => {
                        if (t.subscriptionId === subId || (t.note && t.note.includes(`[Auto] ${oldName}`))) {
                            t.type = type;
                            t.amount = amount;
                            t.categoryId = categoryId;
                            t.note = t.note.replace(`[Auto] ${oldName}`, `[Auto] ${name}`);
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
                totalAmount,
                totalInstallments,
                categoryId,
                frequency,
                startDate,
                endDate,
                nextDate: startDate, // Le prochain prélèvement est au démarrage
                installmentsPaid: 0
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

        // Close modals if active
        const mobileModal = document.getElementById('mobile-form-modal');
        const btnCloseMobileModal = document.getElementById('btn-close-mobile-modal');
        if(mobileModal && mobileModal.classList.contains('active')) {
             btnCloseMobileModal.click();
        }
        if(document.getElementById('edit-modal-overlay').classList.contains('active')) {
             closeEditModal();
        }
    });

    document.getElementById('btn-cancel-edit-sub').addEventListener('click', resetSubscriptionForm);
    document.getElementById('sub-start-date').value = new Date().toISOString().split('T')[0];


window.updateNavigationVisibility = function() {
    const mealVouchersEnabled = appData.mealVouchersEnabled || false;
    const desktopLinkMv = document.getElementById('nav-item-meal-vouchers');
    const mobileLinkMv = document.getElementById('mobile-nav-meal-vouchers');
    const chartToggleContainers = document.querySelectorAll('.mv-chart-toggle-container');

    if (desktopLinkMv) desktopLinkMv.style.display = mealVouchersEnabled ? 'list-item' : 'none';
    if (mobileLinkMv) mobileLinkMv.style.display = mealVouchersEnabled ? 'flex' : 'none';

    chartToggleContainers.forEach(c => {
        c.style.display = mealVouchersEnabled ? 'flex' : 'none';
    });

    // Si le module est désactivé alors qu'on se trouve sur l'un de ses sous-onglets
    if (!mealVouchersEnabled) {
        ['meal-vouchers', 'meal-vouchers-shared'].forEach(id => {
            const sec = document.getElementById(id);
            if (sec && sec.classList.contains('active')) {
                document.querySelector('.nav-link[data-target="dashboard"]').click();
            }
        });
    }

    const investmentsEnabled = appData.investmentsEnabled !== undefined ? appData.investmentsEnabled : true;
    const desktopLinkInv = document.getElementById('nav-item-investments');
    const mobileLinkInv = document.getElementById('mobile-nav-investments');

    if (desktopLinkInv) desktopLinkInv.style.display = investmentsEnabled ? 'list-item' : 'none';
    if (mobileLinkInv) mobileLinkInv.style.display = investmentsEnabled ? 'flex' : 'none';

    // Si on désactive la section dans laquelle on se trouve
    if (!investmentsEnabled && document.getElementById('investments') && document.getElementById('investments').classList.contains('active')) {
        document.querySelector('.nav-link[data-target="dashboard"]').click();
    }

    // Also toggle investment dropdown options in transaction form
    const invTypeOptions = document.querySelectorAll('.opt-investment');
    invTypeOptions.forEach(opt => {
        opt.style.display = investmentsEnabled ? 'block' : 'none';
    });
}

    // --- MEAL VOUCHERS LOGIC ---
    function calculateMealVoucherData() {
        if (!appData.mealVoucherCredits) appData.mealVoucherCredits = [];

        const now = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(now.getMonth() - 12);

        // 1. Sort credits by receipt date (to apply FIFO correctly)
        // Earliest received credits should be consumed first.
        const sortedCredits = [...appData.mealVoucherCredits].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Create a working copy of credits to track remaining balance
        let remainingCredits = sortedCredits.map(c => ({...c, remaining: c.amount, consumed: 0}));

        // 2. Sort all MV transactions (internal + external) chronologically
        const internalMvTransactions = appData.transactions
            .filter(t => t.mealVoucherPart > 0 && t.type === 'expense')
            .map(t => ({ date: t.date, amount: t.mealVoucherPart, isExternal: false }));

        if (!appData.mealVoucherExpenses) appData.mealVoucherExpenses = [];
        const externalMvTransactions = appData.mealVoucherExpenses.map(t => ({
            date: t.date,
            amount: t.amount,
            isExternal: true
        }));

        const allMvTransactions = [...internalMvTransactions, ...externalMvTransactions]
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        let spentLast12m = 0;
        let receivedLast12m = 0;

        // Calculate received last 12m
        appData.mealVoucherCredits.forEach(c => {
            if (new Date(c.date) >= twelveMonthsAgo) {
                receivedLast12m += c.amount;
            }
        });

        // 3. Process transactions chronologically to consume credits via FIFO
        allMvTransactions.forEach(t => {
            if (new Date(t.date) >= twelveMonthsAgo && !t.isExternal) {
                spentLast12m += t.amount;
            }

            let amountToConsume = t.amount;
            const tDate = new Date(t.date);

            // Find credits that were active at the time of the transaction
            for (let i = 0; i < remainingCredits.length; i++) {
                if (amountToConsume <= 0) break;

                let credit = remainingCredits[i];
                const creditDate = new Date(credit.date);
                const expiryDate = new Date(credit.expiryDate);

                // Credit must be received before/on trans date, and not expired before trans date
                if (creditDate <= tDate && expiryDate >= tDate && credit.remaining > 0) {
                    if (credit.remaining >= amountToConsume) {
                        credit.remaining -= amountToConsume;
                        credit.consumed += amountToConsume;
                        amountToConsume = 0;
                    } else {
                        amountToConsume -= credit.remaining;
                        credit.consumed += credit.remaining;
                        credit.remaining = 0;
                    }
                }
            }
        });

        // Calculate available balance (credits not expired TODAY and still having remaining balance)
        let availableBalance = 0;
        let creditsWithBalance = [];

        remainingCredits.forEach(credit => {
            const expiryDate = new Date(credit.expiryDate);
            if (expiryDate >= now && credit.remaining > 0) {
                availableBalance += credit.remaining;
                creditsWithBalance.push(credit);
            }
        });

        return {
            availableBalance,
            spentLast12m,
            receivedLast12m,
            creditsWithBalance
        };
    }
    window.calculateMealVoucherData = calculateMealVoucherData;

    window.checkMvReconciliation = function() {
        const banner = document.getElementById('dashboard-mv-reconciliation-banner');
        if (!banner) return;

        if (!appData.mealVouchersEnabled) {
            banner.style.display = 'none';
            return;
        }

        // Only check if they haven't dismissed it this month
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (localStorage.getItem('budget_app_mv_recon_dismissed') === currentMonthKey) {
            banner.style.display = 'none';
            return;
        }

        // Get last month
        let lastMonth = now.getMonth(); // 0-indexed, so getMonth() is the previous month (1-12)
        let year = now.getFullYear();
        if (lastMonth === 0) {
            lastMonth = 12;
            year -= 1;
        }
        const lastMonthStr = `${year}-${String(lastMonth).padStart(2, '0')}`;

        const eligibleMissing = appData.transactions.filter(t => {
            return t.type === 'expense' &&
                   t.date && t.date.startsWith(lastMonthStr) &&
                   appData.mealVoucherEligibleCategories &&
                   appData.mealVoucherEligibleCategories.includes(t.categoryId) &&
                   (!t.mealVoucherPart || t.mealVoucherPart <= 0);
        });

        if (eligibleMissing.length > 0) {
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }
    }

    function openMvReconciliationModal() {
        const modal = document.getElementById('mv-reconciliation-modal-overlay');
        const tbody = document.querySelector('#table-mv-reconciliation tbody');
        if (!modal || !tbody) return;

        const now = new Date();
        let lastMonth = now.getMonth();
        let year = now.getFullYear();
        if (lastMonth === 0) {
            lastMonth = 12;
            year -= 1;
        }
        const lastMonthStr = `${year}-${String(lastMonth).padStart(2, '0')}`;

        const eligibleMissing = appData.transactions.filter(t => {
            return t.type === 'expense' &&
                   t.date && t.date.startsWith(lastMonthStr) &&
                   appData.mealVoucherEligibleCategories &&
                   appData.mealVoucherEligibleCategories.includes(t.categoryId) &&
                   (!t.mealVoucherPart || t.mealVoucherPart <= 0);
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        tbody.innerHTML = '';
        eligibleMissing.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Date">${t.date}</td>
                <td data-label="Description">${t.note || '-'}</td>
                <td data-label="Catégorie">${getCategoryPath(t.categoryId, new Set(), true)}</td>
                <td data-label="Total Achat">${t.amount.toFixed(2)} €</td>
                <td data-label="Ajouter Part CR">
                    <input type="number" class="recon-mv-input" data-id="${t.id}" data-max="${t.amount}" step="0.01" min="0" placeholder="0.00" style="width: 100px; padding: 0.2rem;">
                </td>
            `;
            tbody.appendChild(tr);
        });

        modal.classList.add('active');
    }

    const btnOpenRecon = document.getElementById('btn-open-mv-reconciliation');
    if (btnOpenRecon) btnOpenRecon.addEventListener('click', openMvReconciliationModal);

    const btnCloseRecon = document.getElementById('btn-close-mv-reconciliation');
    if (btnCloseRecon) btnCloseRecon.addEventListener('click', () => {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        localStorage.setItem('budget_app_mv_recon_dismissed', currentMonthKey);
        document.getElementById('dashboard-mv-reconciliation-banner').style.display = 'none';
    });

    const btnCloseReconModal = document.getElementById('btn-close-mv-reconciliation-modal');
    if (btnCloseReconModal) btnCloseReconModal.addEventListener('click', () => {
        document.getElementById('mv-reconciliation-modal-overlay').classList.remove('active');
    });

    const btnSaveRecon = document.getElementById('btn-save-mv-reconciliation');
    if (btnSaveRecon) {
        btnSaveRecon.addEventListener('click', async () => {
            const inputs = document.querySelectorAll('.recon-mv-input');
            let updated = false;

            inputs.forEach(input => {
                const val = parseFloat(input.value);
                const max = parseFloat(input.getAttribute('data-max'));
                const id = input.getAttribute('data-id');

                if (!isNaN(val) && val > 0) {
                    if (val > max) {
                        alert(`Montant invalide pour la transaction du ${id}: ne peut dépasser ${max} €`);
                        return;
                    }
                    const transIndex = appData.transactions.findIndex(t => t.id === id);
                    if (transIndex !== -1) {
                        appData.transactions[transIndex].mealVoucherPart = val;
                        updated = true;
                    }
                }
            });

            if (updated) {
                await saveData();
                updateDashboard();
                renderTransactions();
                if (typeof renderMealVouchers === 'function') renderMealVouchers();
                alert('Parts Chèques Repas ajoutées avec succès.');
                document.getElementById('mv-reconciliation-modal-overlay').classList.remove('active');
                window.checkMvReconciliation();
            } else {
                document.getElementById('mv-reconciliation-modal-overlay').classList.remove('active');
            }
        });
    }

    window.renderMealVouchers = function() {
        if (!appData.mealVouchersEnabled) return;

        const data = calculateMealVoucherData();

        document.getElementById('mv-available-balance').textContent = data.availableBalance.toFixed(2) + ' €';
        document.getElementById('mv-received-12m').textContent = data.receivedLast12m.toFixed(2) + ' €';
        document.getElementById('mv-spent-12m').textContent = data.spentLast12m.toFixed(2) + ' €';

        // Credits Table
        const tbodyCredits = document.querySelector('#table-meal-vouchers tbody');
        tbodyCredits.innerHTML = '';
        const now = new Date();

        const sortedCredits = [...appData.mealVoucherCredits].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedCredits.forEach(credit => {
            const tr = document.createElement('tr');

            const expiry = new Date(credit.expiryDate);
            const daysToExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

            let statusText = 'Actif';
            let statusColor = 'var(--success-color)';
            if (daysToExpiry <= 0) {
                statusText = 'Expiré';
                statusColor = 'var(--text-color)';
            } else if (daysToExpiry < 60) {
                statusText = 'Bientôt expiré';
                statusColor = 'var(--warning-color)';
            }

            tr.innerHTML = `
                <td data-label="Date Réception">${credit.date}</td>
                <td data-label="Montant">${credit.amount.toFixed(2)} €</td>
                <td data-label="Expiration (+12m)">${credit.expiryDate}</td>
                <td data-label="Statut" style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
                <td data-label="Actions">
                    <button class="btn btn-secondary btn-small" onclick="deleteMealVoucherCredit('${credit.id}')">Supprimer</button>
                </td>
            `;
            tbodyCredits.appendChild(tr);
        });

        // Indicateurs du sous-onglet "Dépenses partagées"
        const sharedExpenses = appData.mealVoucherExpenses || [];
        const sharedTotal = sharedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const elSharedTotal = document.getElementById('mv-shared-total');
        if (elSharedTotal) elSharedTotal.textContent = sharedTotal.toFixed(2) + ' €';
        const elSharedCount = document.getElementById('mv-shared-count');
        if (elSharedCount) elSharedCount.textContent = String(sharedExpenses.length);
        const elSharedBalance = document.getElementById('mv-shared-balance');
        if (elSharedBalance) elSharedBalance.textContent = data.availableBalance.toFixed(2) + ' €';

        // External Expenses Table
        const tbodyExtExpenses = document.querySelector('#table-meal-voucher-external-expenses tbody');
        tbodyExtExpenses.innerHTML = '';
        if (appData.mealVoucherExpenses) {
            const sortedExtExpenses = [...appData.mealVoucherExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
            sortedExtExpenses.forEach(exp => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td data-label="Montant" style="font-weight: bold;">${exp.amount.toFixed(2)} €</td>
                    <td data-label="Actions">
                        <button class="btn btn-secondary btn-small" onclick="editMealVoucherExpense('${exp.id}')">Modifier</button>
                        <button class="btn btn-danger btn-small" onclick="deleteMealVoucherExpense('${exp.id}')">Supprimer</button>
                    </td>
                `;
                tbodyExtExpenses.appendChild(tr);
            });
        }

        // Transactions Table (Read Only)
        const tbodyTrans = document.querySelector('#table-meal-voucher-transactions tbody');
        tbodyTrans.innerHTML = '';

        const mvTransactions = appData.transactions.filter(t => t.mealVoucherPart > 0 && t.type === 'expense').sort((a, b) => new Date(b.date) - new Date(a.date));

        mvTransactions.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Date">${t.date}</td>
                <td data-label="Note">${t.note || '-'}</td>
                <td data-label="Catégorie">${getCategoryPath(t.categoryId, new Set(), true)}</td>
                <td data-label="Montant">${t.amount.toFixed(2)} €</td>
                <td data-label="Part CR" style="color: var(--accent-color); font-weight: bold;">${t.mealVoucherPart.toFixed(2)} €</td>
            `;
            tbodyTrans.appendChild(tr);
        });
    }

    const mvFormAdd = document.getElementById('form-meal-voucher');
    if (mvFormAdd) {
        mvFormAdd.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('mv-amount').value);
            const date = document.getElementById('mv-date').value;

            if (isNaN(amount) || amount <= 0 || !date) return;

            // Calculate expiry: + 12 months exactly
            const d = new Date(date);
            d.setMonth(d.getMonth() + 12);
            const expiryDate = d.toISOString().split('T')[0];

            const newCredit = {
                id: 'mv_' + Date.now(),
                amount,
                date,
                expiryDate
            };

            if (!appData.mealVoucherCredits) appData.mealVoucherCredits = [];
            appData.mealVoucherCredits.push(newCredit);

            await saveData();
            renderMealVouchers();
            mvFormAdd.reset();
        });
    }

    window.deleteMealVoucherCredit = async function(id) {
        if(confirm("Supprimer ce lot de chèques repas ?")) {
            appData.mealVoucherCredits = appData.mealVoucherCredits.filter(c => c.id !== id);
            await saveData();
            renderMealVouchers();
        }
    };

    const mvFormExpense = document.getElementById('form-meal-voucher-expense');
    if (mvFormExpense) {
        mvFormExpense.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('mv-expense-amount').value);
            const idInput = document.getElementById('mv-expense-id').value;

            if (isNaN(amount) || amount <= 0) return;

            if (!appData.mealVoucherExpenses) appData.mealVoucherExpenses = [];

            if (idInput) {
                // Edit
                const index = appData.mealVoucherExpenses.findIndex(ex => ex.id === idInput);
                if (index !== -1) {
                    appData.mealVoucherExpenses[index].amount = amount;
                }
            } else {
                // Add
                appData.mealVoucherExpenses.push({
                    id: 'mvexp_' + Date.now(),
                    amount,
                    date: new Date().toISOString().split('T')[0] // Use today's date for FIFO consumption logic
                });
            }

            await saveData();
            renderMealVouchers();
            resetMvExpenseForm();
        });
    }

    const btnCancelMvExpense = document.getElementById('btn-cancel-edit-mv-expense');
    if (btnCancelMvExpense) {
        btnCancelMvExpense.addEventListener('click', resetMvExpenseForm);
    }

    function resetMvExpenseForm() {
        if(mvFormExpense) mvFormExpense.reset();
        document.getElementById('mv-expense-id').value = '';
        const btnSubmit = document.getElementById('btn-submit-mv-expense');
        if(btnSubmit) btnSubmit.textContent = 'Ajouter la dépense';
        if(btnCancelMvExpense) btnCancelMvExpense.style.display = 'none';
    }

    window.editMealVoucherExpense = function(id) {
        if (!appData.mealVoucherExpenses) return;
        const exp = appData.mealVoucherExpenses.find(ex => ex.id === id);
        if (!exp) return;

        document.getElementById('mv-expense-amount').value = exp.amount;
        document.getElementById('mv-expense-id').value = exp.id;

        const btnSubmit = document.getElementById('btn-submit-mv-expense');
        if(btnSubmit) btnSubmit.textContent = 'Modifier la dépense';
        if(btnCancelMvExpense) btnCancelMvExpense.style.display = 'inline-block';

        // Scroll to form if needed
        document.getElementById('form-meal-voucher-expense').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.deleteMealVoucherExpense = async function(id) {
        if(confirm("Supprimer cette dépense partagée ?")) {
            appData.mealVoucherExpenses = appData.mealVoucherExpenses.filter(ex => ex.id !== id);
            await saveData();
            renderMealVouchers();
        }
    };


    // Settings - Meal Vouchers
    const mvEnabledCheckbox = document.getElementById('setting-meal-vouchers-enabled');
    const mvDetailsDiv = document.getElementById('settings-meal-vouchers-details');
    const mvExpectedInput = document.getElementById('setting-meal-vouchers-expected');
    const mvCategoriesSelect = document.getElementById('setting-meal-vouchers-categories');

    if (mvEnabledCheckbox) {
        mvEnabledCheckbox.checked = appData.mealVouchersEnabled || false;
        mvDetailsDiv.style.display = mvEnabledCheckbox.checked ? 'block' : 'none';

        mvEnabledCheckbox.addEventListener('change', (e) => {
            mvDetailsDiv.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    if (mvExpectedInput) {
        mvExpectedInput.value = appData.mealVoucherExpectedMonthlyAmount || 0;
    }

    const mvForm = document.getElementById('form-settings-meal-vouchers');
    if (mvForm) {
        mvForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            appData.mealVouchersEnabled = mvEnabledCheckbox.checked;
            appData.mealVoucherExpectedMonthlyAmount = parseFloat(mvExpectedInput.value) || 0;

            const selectedCategories = Array.from(mvCategoriesSelect.selectedOptions).map(opt => opt.value);
            appData.mealVoucherEligibleCategories = selectedCategories;

            await saveData();
            if (typeof updateNavigationVisibility === 'function') {
                updateNavigationVisibility();
            }
            alert("Paramètres des chèques repas mis à jour !");
            location.reload(); // Reload to apply UI changes everywhere properly
        });
    }


    // Settings - Investments
    const invEnabledCheckbox = document.getElementById('setting-investments-enabled');
    if (invEnabledCheckbox) {
        invEnabledCheckbox.checked = appData.investmentsEnabled !== undefined ? appData.investmentsEnabled : true;
    }

    const invForm = document.getElementById('form-settings-investments');
    if (invForm) {
        invForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            appData.investmentsEnabled = invEnabledCheckbox.checked;
            await saveData();

            if (typeof updateNavigationVisibility === 'function') {
                updateNavigationVisibility();
            }
            alert("Paramètres des investissements mis à jour !");
            location.reload();
        });
    }

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
                simulations: [],
                simulationBalance: 0,
                mealVoucherCredits: [],
                mealVoucherExpenses: [],
                mealVouchersEnabled: false,
                mealVoucherEligibleCategories: [],
                mealVoucherExpectedMonthlyAmount: 0,
                categories: []
            };
            await saveData();
            location.reload();
        }
    });
});

// --- MODAL GENERIQUE ---
function openDataModal(title, transactions, totalAmount, totalType = 'expense') {
    const filtersContainer = document.getElementById('data-modal-filters-container');
    if (filtersContainer) {
        filtersContainer.style.display = 'none';
    }

    document.getElementById('data-modal-title').textContent = title;
    renderCategoryBreakdown(null, [], false);
    const genericTotalLabel = document.getElementById('data-modal-total-label');
    if (genericTotalLabel) genericTotalLabel.textContent = 'Total :';

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
            const catName = getCategoryPath(t.categoryId, new Set(), true);

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

    // Event listeners for category modal filters
    const catModeFilter = document.getElementById('data-modal-cat-mode');
    const periodFilter = document.getElementById('data-modal-period');
    const dateStartFilter = document.getElementById('data-modal-date-start');
    const dateEndFilter = document.getElementById('data-modal-date-end');

    if (catModeFilter) catModeFilter.addEventListener('change', () => { if (typeof renderCategoryModal === 'function') renderCategoryModal(); });
    if (periodFilter) periodFilter.addEventListener('change', () => { if (typeof renderCategoryModal === 'function') renderCategoryModal(); });
    if (dateStartFilter) dateStartFilter.addEventListener('change', () => { if (typeof renderCategoryModal === 'function') renderCategoryModal(); });
    if (dateEndFilter) dateEndFilter.addEventListener('change', () => { if (typeof renderCategoryModal === 'function') renderCategoryModal(); });


// Close modal on click outside
document.getElementById('data-modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('data-modal-overlay')) {
        closeDataModal();
    }
});

document.getElementById('btn-close-edit-modal').addEventListener('click', closeEditModal);

document.getElementById('edit-modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('edit-modal-overlay')) {
        closeEditModal();
    }
});


// Exposer les fonctions au contexte global (car module)
window.deleteTransaction = deleteTransaction;

// Fallback: Seulement exposer les fonctions de base si la version mobile n'est pas déjà définie,
// pour éviter d'écraser la surcharge faite dans DOMContentLoaded.
if (typeof window.editTransaction === 'undefined') window.editTransaction = editTransaction;
window.deleteSubscription = deleteSubscription;
if (typeof window.editSubscription === 'undefined') window.editSubscription = editSubscription;
window.viewSubscriptionHistory = viewSubscriptionHistory;
window.deleteCategory = deleteCategory;
window.renderTransactions = renderTransactions;
window.renderSubscriptions = renderSubscriptions;
window.updateCategorySelects = updateCategorySelects;
window.renderCategoryTree = renderCategoryTree;
window.renderTransactionTagsSelector = renderTransactionTagsSelector;
window.updateDashboard = updateDashboard;

// --- SIMULATIONS & PREDICTIONS ---

let predictionChartInstance = null;

function renderSimulations() {
    const tbody = document.querySelector('#table-simulations tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    document.getElementById('sim-current-balance').value = appData.simulationBalance || 0;

    appData.simulations.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    appData.simulations.forEach(sim => {
        const tr = document.createElement('tr');
        const amountClass = sim.type === 'income' ? 'text-green' : 'text-red';
        const sign = sim.type === 'income' ? '+' : '-';

        let freqText = 'Ponctuelle';
        if (sim.frequency === 'monthly') freqText = 'Tous les mois';
        if (sim.frequency === 'yearly') freqText = 'Annuelle';

        tr.innerHTML = `
            <td data-label="Nom">${sim.name}</td>
            <td data-label="Type">${sim.type === 'income' ? 'Revenu' : 'Dépense'}</td>
            <td data-label="Montant" class="${amountClass}">${sign}${Number(sim.amount).toFixed(2)} €</td>
            <td data-label="Fréquence">${freqText}</td>
            <td data-label="Date début">${sim.startDate}</td>
            <td data-label="Actions">
                <button class="btn btn-danger btn-small icon-btn-mobile" title="Supprimer" onclick="deleteSimulation('${sim.id}')"><span class="btn-text">Supprimer</span><svg class="mobile-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteSimulation = function(id) {
    if (confirm("Supprimer cette simulation ?")) {
        appData.simulations = appData.simulations.filter(s => s.id !== id);
        renderSimulations();
        updatePredictionChart();
    }
};

function calculateAverageMonthlyTrends() {
    // Calcul de la tendance de base : abonnements mensuels et moyenne des dépenses/revenus variables
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let subIncome = 0;
    let subExpense = 0;

    appData.subscriptions.forEach(sub => {
        if (sub.frequency === 'monthly') {
            if (sub.type === 'income') subIncome += sub.amount;
            else subExpense += sub.amount;
        } else if (sub.frequency === 'weekly') {
            if (sub.type === 'income') subIncome += (sub.amount * 52) / 12;
            else subExpense += (sub.amount * 52) / 12;
        } else if (sub.frequency === 'yearly') {
            if (sub.type === 'income') subIncome += sub.amount / 12;
            else subExpense += sub.amount / 12;
        }
    });

    // Optionnel : on pourrait calculer les vraies dépenses variables des X derniers mois.
    // Pour l'instant, utilisons uniquement les abonnements réguliers comme base,
    // ou une moyenne simple des 3 derniers mois (hors abonnements).

    // Simplification : Base = revenus fixes (abonnements) - dépenses fixes (abonnements)
    return {
        monthlyIncome: subIncome,
        monthlyExpense: subExpense
    };
}

function updatePredictionChart() {
    const canvas = document.getElementById('predictionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const monthsToProject = 24;
    const labels = [];
    const dataPoints = [];
    const baselinePoints = []; // Sans les simulations

    let currentBalance = parseFloat(document.getElementById('sim-current-balance').value) || 0;
    appData.simulationBalance = currentBalance;

    let baselineBalance = currentBalance;

    const trends = calculateAverageMonthlyTrends();

    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1; // 1-12

    for (let i = 0; i < monthsToProject; i++) {
        const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        labels.push(monthStr);

        // 1. Ajouter la tendance de base mensuelle
        currentBalance += trends.monthlyIncome;
        currentBalance -= trends.monthlyExpense;

        baselineBalance += trends.monthlyIncome;
        baselineBalance -= trends.monthlyExpense;

        // 2. Ajouter les simulations pour ce mois
        appData.simulations.forEach(sim => {
            const [simYear, simMonth] = sim.startDate.split('-').map(Number);

            let isApplicable = false;

            if (sim.frequency === 'one-time' && simYear === currentYear && simMonth === currentMonth) {
                isApplicable = true;
            } else if (sim.frequency === 'monthly') {
                if (currentYear > simYear || (currentYear === simYear && currentMonth >= simMonth)) {
                    isApplicable = true;
                }
            } else if (sim.frequency === 'yearly') {
                if ((currentYear > simYear || (currentYear === simYear && currentMonth >= simMonth)) && currentMonth === simMonth) {
                    isApplicable = true;
                }
            }

            if (isApplicable) {
                if (sim.type === 'income') currentBalance += sim.amount;
                else currentBalance -= sim.amount;
            }
        });

        dataPoints.push(currentBalance);
        baselinePoints.push(baselineBalance);

        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
    }

    if (predictionChartInstance) {
        predictionChartInstance.destroy();
    }

    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDarkMode ? '#f5f5f7' : '#1d1d1f';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    // Importation conditionnelle si Chart.js est dispo
    if (typeof Chart !== 'undefined') {
        predictionChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Projection avec Simulations',
                        data: dataPoints,
                        borderColor: '#0066cc',
                        backgroundColor: 'rgba(0, 102, 204, 0.1)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 2
                    },
                    {
                        label: 'Projection de Base (Abonnements seuls)',
                        data: baselinePoints,
                        borderColor: '#888888',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.3,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: textColor } }
                },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor }, grid: { color: gridColor } }
                }
            }
        });
    } else {
        // Fallback si on n'utilise pas Chart.js (Le projet semble utiliser une logique custom pour les charts dans les autres sections,
        // ou n'a pas inclus Chart.js. Je vais ajouter une implémentation canvas basique si besoin,
        // ou vérifier si drawHorizontalBarChart est importé. Le projet utilise des canvas purs.)
        drawCustomLineChart(ctx, labels, dataPoints, baselinePoints, textColor, gridColor);
    }
}

function drawCustomLineChart(ctx, labels, dataPoints, baselinePoints, textColor, gridColor) {
    baselinePoints = baselinePoints || [];
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);

    const padX = 50;
    const padY = 40;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const allData = [...dataPoints, ...baselinePoints, 0];
    const minVal = Math.min(...allData);
    const maxVal = Math.max(...allData);
    const range = (maxVal - minVal) || 1;

    // Draw grid & Y labels
    ctx.strokeStyle = gridColor;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '12px Inter';

    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        const yVal = maxVal - (range * (i / steps));
        const y = padY + (chartH * (i / steps));

        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.lineTo(width - padX, y);
        ctx.stroke();

        ctx.fillText(`${yVal.toFixed(0)}€`, padX - 10, y);
    }

    // Zero line
    if (minVal < 0 && maxVal > 0) {
        const zeroY = padY + chartH - ((0 - minVal) / range * chartH);
        ctx.strokeStyle = textColor;
        ctx.beginPath();
        ctx.moveTo(padX, zeroY);
        ctx.lineTo(width - padX, zeroY);
        ctx.stroke();
    }

    // Draw function
    const drawLine = (data, color, isDashed = false) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        if (isDashed) ctx.setLineDash([5, 5]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        data.forEach((val, i) => {
            const x = padX + (i / (labels.length - 1)) * chartW;
            const y = padY + chartH - ((val - minVal) / range * chartH);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
    };

    if (baselinePoints.length) drawLine(baselinePoints, '#888888', true); // Baseline
    drawLine(dataPoints, '#0066cc', false); // Simulated

    // X Labels (every 3 months)
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    labels.forEach((label, i) => {
        if (i % 3 === 0) {
            const x = padX + (i / (labels.length - 1)) * chartW;
            ctx.fillText(label, x, height - padY + 10);
        }
    });
}

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
                else if (t.type === 'salary') {
                    const saved = t.savedAmount || 0;
                    income += (t.amount - saved);
                }
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
                    <input type="color" value="${tag.color}" onchange="updateTagColor('${tag.id}', this.value)" style="width: 25px; height: 25px; padding: 0; border: none; cursor: pointer;" title="Changer la couleur">
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
window.setCategoryFilter = setCategoryFilter;

// --- ADVANCE SUBSCRIPTIONS ---
async function advanceSubscription(subId) {
    const sub = appData.subscriptions.find(s => s.id === subId);
    if (!sub || sub.frequency !== 'installments') return;

    const remainingInstallments = sub.totalInstallments - (sub.installmentsPaid || 0);
    if (remainingInstallments <= 0) return;

    const monthsToAdvanceStr = prompt(`Combien de mois souhaitez-vous avancer pour l'abonnement "${sub.name}" ? (Max: ${remainingInstallments})`, "1");
    if (monthsToAdvanceStr === null) return; // Annulé

    const monthsToAdvance = parseInt(monthsToAdvanceStr, 10);
    if (isNaN(monthsToAdvance) || monthsToAdvance <= 0) {
        alert("Veuillez entrer un nombre valide de mois.");
        return;
    }
    if (monthsToAdvance > remainingInstallments) {
        alert(`Vous ne pouvez pas avancer plus de ${remainingInstallments} mois.`);
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const advanceAmount = sub.amount * monthsToAdvance;

    const currentPaid = (sub.installmentsPaid || 0) + 1;
    const endPaid = currentPaid + monthsToAdvance - 1;
    const monthsText = monthsToAdvance === 1 ? `Mois ${currentPaid}/${sub.totalInstallments}` : `Mois ${currentPaid}-${endPaid}/${sub.totalInstallments}`;

    const note = `[Auto] ${sub.name} (Avance: ${monthsText})`;

    appData.transactions.push({
        id: 'trans-auto-' + generateId(),
        type: sub.type,
        amount: advanceAmount,
        date: today,
        categoryId: sub.categoryId,
        note: note,
        subscriptionId: sub.id
    });

    sub.installmentsPaid = (sub.installmentsPaid || 0) + monthsToAdvance;

    if (sub.installmentsPaid >= sub.totalInstallments) {
        sub.status = 'completed';
    }

    await saveData();
    renderSubscriptions();
    renderTransactions();
    updateDashboard();
}
window.advanceSubscription = advanceSubscription;

// --- INVESTMENTS MANAGEMENT ---

function updateInvestmentsStatus() {
    if (!appData.investments) return;

    appData.investments.forEach(inv => {
        let investedAmount = 0;

        // Compute invested amount from transactions
        appData.transactions.forEach(t => {
            if (t.investmentId === inv.id) {
                if (t.type === 'investment_transfer') {
                    investedAmount += t.amount;
                } else if (t.type === 'investment_return') {
                    investedAmount -= t.amount;
                }
            }
        });

        if (investedAmount <= 0.01 && inv.status === 'active' && appData.transactions.some(t => t.investmentId === inv.id)) {
            // Only auto-close if there are transactions (not just an empty newly created asset)
            inv.status = 'closed';
        } else if (investedAmount > 0.01 && inv.status === 'closed') {
            inv.status = 'active'; // Re-open if money is added back
        }
    });
}
window.updateInvestmentsStatus = updateInvestmentsStatus;

function getTreasuryBalance() {
    let treasury = 0;
    appData.transactions.forEach(t => {
        if (t.type === 'income' || t.type === 'salary') {
            treasury += t.amount;
        } else if (t.type === 'expense') {
            treasury -= t.amount;
        } else if (t.type === 'investment_transfer') {
            treasury -= t.amount;
        } else if (t.type === 'investment_return') {
            treasury += t.amount;
        }
    });
    return treasury;
}
window.getTreasuryBalance = getTreasuryBalance;

function getInvestedAmount(investmentId) {
    let investedAmount = 0;
    appData.transactions.forEach(t => {
        if (t.investmentId === investmentId) {
            if (t.type === 'investment_transfer') {
                investedAmount += t.amount;
            } else if (t.type === 'investment_return') {
                investedAmount -= t.amount;
            }
        }
    });
    return investedAmount;
}

function getPortfolioValue() {
    let total = 0;
    if (appData.investments) {
        appData.investments.forEach(inv => {
            if (inv.status === 'active' && inv.valueHistory && inv.valueHistory.length > 0) {
                // Get latest value from history based on date
                const sortedHistory = [...inv.valueHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
                total += sortedHistory[0].value;
            }
        });
    }
    return total;
}
window.getPortfolioValue = getPortfolioValue;

function renderInvestments() {
    updateInvestmentsStatus();

    let totalInvested = 0;
    let totalCurrentValue = 0;

    const listContainer = document.getElementById('investments-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!appData.investments || appData.investments.length === 0) {
        listContainer.innerHTML = '<p>Aucun investissement enregistré.</p>';
        document.getElementById('inv-total-invested').textContent = '0.00 €';
        document.getElementById('inv-total-value').textContent = '0.00 €';
        document.getElementById('inv-total-performance').textContent = '0.00 € (0%)';
        renderPortfolioChart();
        return;
    }

    // Sort: Active first, then by name
    const sortedInvestments = [...appData.investments].sort((a, b) => {
        if (a.status === 'active' && b.status === 'closed') return -1;
        if (a.status === 'closed' && b.status === 'active') return 1;
        return a.name.localeCompare(b.name);
    });

    sortedInvestments.forEach(inv => {
        const invested = getInvestedAmount(inv.id);

        let currentValue = 0;
        let lastUpdateDate = null;
        let isOldUpdate = false;

        if (inv.status === 'closed') {
            currentValue = 0;
        } else if (inv.valueHistory && inv.valueHistory.length > 0) {
            const sortedHistory = [...inv.valueHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
            currentValue = sortedHistory[0].value;
            lastUpdateDate = new Date(sortedHistory[0].date);

            // Check if older than 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            if (lastUpdateDate < thirtyDaysAgo) {
                isOldUpdate = true;
            }
        } else {
            // New investment without history (should have one created at start, but fallback)
            currentValue = invested;
            lastUpdateDate = new Date(inv.acquisitionDate);
        }

        if (inv.status === 'active') {
            totalInvested += invested;
            totalCurrentValue += currentValue;
        }

        const performance = currentValue - invested;
        let perfPercent = 0;
        if (invested > 0) {
            perfPercent = (performance / invested) * 100;
        }

        const perfClass = performance >= 0 ? 'text-green' : 'text-red';
        const perfSign = performance >= 0 ? '+' : '';

        const card = document.createElement('div');
        card.className = `investment-card ${inv.status === 'closed' ? 'closed' : ''}`;

        let badgesHtml = '';
        if (inv.status === 'closed') {
            badgesHtml += '<span class="badge badge-closed">Clôturé</span>';
        } else if (isOldUpdate) {
            badgesHtml += '<span class="badge badge-warning" title="Mise à jour ancienne">À rafraîchir</span>';
        }

        card.innerHTML = `
            <div class="investment-card-info">
                <h4 class="investment-card-name">${inv.name} ${badgesHtml}</h4>
                <p class="investment-card-type">Type: ${inv.type} | Acquis le: ${inv.acquisitionDate}</p>
            </div>
            <div class="investment-card-values">
                <p class="investment-card-current">${inv.status === 'closed' ? '0.00 €' : currentValue.toFixed(2) + ' €'}</p>
                <p class="investment-card-invested">Investi: ${invested.toFixed(2)} €</p>
                ${inv.status === 'active' ? `<p class="investment-card-performance ${perfClass}">${perfSign}${performance.toFixed(2)} € (${perfSign}${perfPercent.toFixed(1)}%)</p>` : ''}
            </div>
            <div class="investment-card-actions">
                <button class="btn btn-secondary btn-small" onclick="openInvestmentDetail('${inv.id}')">Détails / MAJ</button>
            </div>
        `;

        listContainer.appendChild(card);
    });

    const globalPerf = totalCurrentValue - totalInvested;
    let globalPerfPercent = 0;
    if (totalInvested > 0) {
        globalPerfPercent = (globalPerf / totalInvested) * 100;
    }

    document.getElementById('inv-total-invested').textContent = totalInvested.toFixed(2) + ' €';
    document.getElementById('inv-total-value').textContent = totalCurrentValue.toFixed(2) + ' €';

    const globalPerfEl = document.getElementById('inv-total-performance');
    globalPerfEl.textContent = `${globalPerf >= 0 ? '+' : ''}${globalPerf.toFixed(2)} € (${globalPerf >= 0 ? '+' : ''}${globalPerfPercent.toFixed(1)}%)`;
    globalPerfEl.style.color = globalPerf >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

    renderPortfolioChart();
}
window.renderInvestments = renderInvestments;

function openInvestmentDetail(id) {
    const inv = appData.investments.find(i => i.id === id);
    if (!inv) return;

    document.getElementById('inv-detail-title').textContent = inv.name;
    document.getElementById('inv-detail-type').textContent = inv.type;
    document.getElementById('inv-detail-date').textContent = inv.acquisitionDate;
    document.getElementById('inv-detail-status').textContent = inv.status === 'closed' ? 'Clôturé' : 'Actif';

    const invested = getInvestedAmount(id);
    document.getElementById('inv-detail-invested').textContent = invested.toFixed(2) + ' €';

    document.getElementById('inv-val-asset-id').value = id;

    const today = new Date();
    document.getElementById('inv-val-date').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    if (inv.valueHistory && inv.valueHistory.length > 0) {
        const sorted = [...inv.valueHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        document.getElementById('inv-val-amount').value = sorted[0].value;
    } else {
        document.getElementById('inv-val-amount').value = invested;
    }

    // Fill history table
    const tbody = document.querySelector('#table-investment-history tbody');
    tbody.innerHTML = '';

    if (inv.valueHistory && inv.valueHistory.length > 0) {
        const sorted = [...inv.valueHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        sorted.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.date}</td>
                <td>${entry.value.toFixed(2)} €</td>
                <td>
                    <button class="btn btn-danger btn-small" onclick="deleteInvestmentHistoryEntry('${inv.id}', '${entry.id}')">Supprimer</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Aucun historique.</td></tr>';
    }

    document.getElementById('investment-detail-modal-overlay').classList.add('active');
}
window.openInvestmentDetail = openInvestmentDetail;

document.getElementById('btn-close-inv-detail-modal').addEventListener('click', () => {
    document.getElementById('investment-detail-modal-overlay').classList.remove('active');
});

document.getElementById('form-investment-value').addEventListener('submit', async (e) => {
    e.preventDefault();
    const invId = document.getElementById('inv-val-asset-id').value;
    const date = document.getElementById('inv-val-date').value;
    const value = parseFloat(document.getElementById('inv-val-amount').value);

    const inv = appData.investments.find(i => i.id === invId);
    if (inv) {
        if (!inv.valueHistory) inv.valueHistory = [];

        // Check if date already exists
        const existingIndex = inv.valueHistory.findIndex(vh => vh.date === date);
        if (existingIndex !== -1) {
            if (confirm('Une estimation existe déjà pour cette date. Voulez-vous la remplacer ?')) {
                inv.valueHistory[existingIndex].value = value;
            } else {
                return;
            }
        } else {
            inv.valueHistory.push({
                id: 'vh-' + generateId(),
                date: date,
                value: value
            });
        }

        await saveData();
        openInvestmentDetail(invId); // Refresh modal
        renderInvestments();
        updateDashboard();
    }
});

window.deleteInvestmentHistoryEntry = async function(invId, entryId) {
    if (confirm('Supprimer cette estimation ?')) {
        const inv = appData.investments.find(i => i.id === invId);
        if (inv && inv.valueHistory) {
            inv.valueHistory = inv.valueHistory.filter(vh => vh.id !== entryId);
            await saveData();
            openInvestmentDetail(invId);
            renderInvestments();
            updateDashboard();
        }
    }
};

/* -------------------------------------------------------------------------
   Évolution du portefeuille d'investissement
   ------------------------------------------------------------------------- */
function getPortfolioValueAt(dateStr) {
    let total = 0;
    if (!appData.investments) return 0;
    appData.investments.forEach(inv => {
        if (inv.status !== 'active' || !inv.valueHistory || inv.valueHistory.length === 0) return;
        const past = inv.valueHistory
            .filter(vh => vh.date <= dateStr)
            .sort((a, b) => (a.date < b.date ? 1 : -1));
        if (past.length > 0) total += Number(past[0].value) || 0;
    });
    return total;
}

function renderPortfolioChart() {
    const canvas = document.getElementById('portfolioChart');
    if (!canvas) return;

    const activeInvs = (appData.investments || []).filter(i => i.status === 'active' && i.valueHistory && i.valueHistory.length > 0);

    if (activeInvs.length === 0) {
        drawAreaLineChart('portfolioChart', [], { height: 220, emptyMessage: "Ajoutez une valeur à un actif pour voir l'évolution" });
        return;
    }

    // Toutes les dates de valorisation, dans l'ordre chronologique
    const allDates = Array.from(new Set(activeInvs.flatMap(inv => inv.valueHistory.map(vh => vh.date)))).sort();

    const points = allDates.map(date => ({
        label: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        value: getPortfolioValueAt(date)
    }));

    drawAreaLineChart('portfolioChart', points, { height: 220 });
}

window.showCategoryDetails = showCategoryDetails;


/* =========================================================================
   UI 2.0 — Navigation latérale, saisie rapide et widgets du tableau de bord
   Ce bloc complète la logique existante sans la remplacer :
   - il ne fait que lire les données (appData) et piloter le DOM,
   - la saisie rapide réutilise le formulaire complet #form-transaction.
   ========================================================================= */

// Correspondance onglet -> groupe de navigation affiché dans le volet latéral
const NAV_GROUP_TITLES = {
    dashboard: 'Accueil',
    transactions: 'Transactions',
    subscriptions: 'Transactions',
    charts: 'Analyse',
    savings: 'Analyse',
    categories: 'Organisation',
    tags: 'Organisation',
    investments: 'Investissements',
    'meal-vouchers': 'Chèques repas',
    'meal-vouchers-shared': 'Chèques repas',
    trips: 'Vacances',
    'trips-compare': 'Vacances',
    settings: 'Réglages',
    prediction: 'Prédiction'
};

const MONTH_NAMES_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function fmtEuro(value, withSign) {
    const n = Number(value) || 0;
    const sign = withSign ? (n > 0 ? '+' : (n < 0 ? '-' : '')) : (n < 0 ? '-' : '');
    return sign + Math.abs(n).toFixed(2) + ' €';
}

function fmtShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/* -------------------------------------------------------------------------
   Navigation : surlignage du groupe actif + volet coulissant mobile
   ------------------------------------------------------------------------- */
function highlightNavGroup(targetId) {
    document.querySelectorAll('[data-group]').forEach(el => {
        const groups = (el.getAttribute('data-group') || '').split(/\s+/);
        el.classList.toggle('is-group-active', groups.includes(targetId));
    });

    const title = document.getElementById('topbar-title');
    if (title) title.textContent = NAV_GROUP_TITLES[targetId] || 'Mon Budget';
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    if (sidebar) sidebar.classList.remove('open');
    if (scrim) scrim.classList.remove('open');
}

function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    if (sidebar) sidebar.classList.add('open');
    if (scrim) scrim.classList.add('open');
}

/* -------------------------------------------------------------------------
   Saisie rapide (tableau de bord)
   ------------------------------------------------------------------------- */
function syncQuickAddCategories() {
    const target = document.getElementById('qa-category');
    if (!target) return;
    if (typeof appData === 'undefined' || !appData || !Array.isArray(appData.categories)) return;

    // La saisie rapide construit sa propre liste : elle ne dépend plus de
    // l'état du formulaire complet (vide au démarrage, ou positionné sur une
    // transaction en cours d'édition).
    const qaType = (document.getElementById('qa-type') || {}).value || 'expense';
    const catType = qaType === 'salary' ? 'income' : qaType;

    const previous = target.value;
    const options = appData.categories
        .filter(c => c.type === catType)
        .map(c => ({ id: c.id, path: getCategoryPath(c.id) }))
        .sort((a, b) => a.path.localeCompare(b.path));

    target.innerHTML = '';
    options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.path;
        target.appendChild(opt);
    });

    if (previous && target.querySelector('option[value="' + previous + '"]')) {
        target.value = previous;
    }
    updateQuickMvFields();
}

/* Affiche le champ « chèques repas » directement dans la saisie rapide
   dès qu'une catégorie éligible est sélectionnée. */
function updateQuickMvFields() {
    const group = document.getElementById('qa-mv-group');
    if (!group) return;

    const input = document.getElementById('qa-mv-part');
    const hint = document.getElementById('qa-mv-hint');
    const type = (document.getElementById('qa-type') || {}).value || 'expense';
    const catId = (document.getElementById('qa-category') || {}).value || '';

    const eligible = typeof appData !== 'undefined' && appData
        && appData.mealVouchersEnabled
        && type === 'expense'
        && Array.isArray(appData.mealVoucherEligibleCategories)
        && appData.mealVoucherEligibleCategories.includes(catId);

    if (!eligible) {
        group.style.display = 'none';
        if (input) input.value = '';
        return;
    }

    group.style.display = 'block';

    let balance = 0;
    if (typeof window.calculateMealVoucherData === 'function') {
        balance = window.calculateMealVoucherData().availableBalance || 0;
    }
    if (hint) hint.textContent = 'Solde disponible : ' + balance.toFixed(2) + ' €';

    const amountEl = document.getElementById('qa-amount');
    const amount = amountEl ? parseFloat(amountEl.value) : NaN;
    if (input) input.max = (isNaN(amount) || amount <= 0) ? '' : amount;
}

function setQuickAddType(type) {
    const hidden = document.getElementById('qa-type');
    if (!hidden) return;
    hidden.value = type;

    document.querySelectorAll('#qa-type-group .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    const savingsGroup = document.getElementById('qa-savings-group');
    if (savingsGroup) savingsGroup.style.display = type === 'salary' ? 'block' : 'none';

    syncQuickAddCategories();
}

function showQuickFeedback(message, isSuccess) {
    const el = document.getElementById('qa-feedback');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('is-success', !!isSuccess);
    el.style.display = 'block';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 3200);
}

function initQuickAdd() {
    const form = document.getElementById('form-quick-add');
    if (!form) return;

    document.querySelectorAll('#qa-type-group .seg-btn').forEach(btn => {
        btn.addEventListener('click', () => setQuickAddType(btn.dataset.type));
    });

    const dateInput = document.getElementById('qa-date');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];

    const qaCategory = document.getElementById('qa-category');
    if (qaCategory) qaCategory.addEventListener('change', updateQuickMvFields);

    const qaAmount = document.getElementById('qa-amount');
    if (qaAmount) qaAmount.addEventListener('input', updateQuickMvFields);

    const mvAllBtn = document.getElementById('btn-qa-mv-all');
    if (mvAllBtn) {
        mvAllBtn.addEventListener('click', () => {
            const amount = parseFloat(document.getElementById('qa-amount').value);
            if (isNaN(amount) || amount <= 0) {
                showQuickFeedback('Indiquez d’abord un montant.');
                return;
            }
            let balance = amount;
            if (typeof window.calculateMealVoucherData === 'function') {
                balance = window.calculateMealVoucherData().availableBalance || 0;
            }
            document.getElementById('qa-mv-part').value = Math.min(amount, balance).toFixed(2);
        });
    }

    // Ouvre le formulaire complet, pré-rempli avec la saisie en cours
    const advancedBtn = document.getElementById('btn-qa-advanced');
    if (advancedBtn) {
        advancedBtn.addEventListener('click', () => {
            const type = document.getElementById('qa-type').value;
            resetTransactionForm();
            document.getElementById('trans-type').value = type;
            document.getElementById('trans-type').dispatchEvent(new Event('change'));

            const amount = document.getElementById('qa-amount').value;
            if (amount) document.getElementById('trans-amount').value = amount;
            document.getElementById('trans-date').value = document.getElementById('qa-date').value || new Date().toISOString().split('T')[0];
            const cat = document.getElementById('qa-category').value;
            if (cat) document.getElementById('trans-category').value = cat;
            document.getElementById('trans-note').value = document.getElementById('qa-note').value || '';
            document.getElementById('trans-category').dispatchEvent(new Event('change'));
            const qaMv = document.getElementById('qa-mv-part');
            if (qaMv && qaMv.value) document.getElementById('trans-mv-part').value = qaMv.value;

            if (window.innerWidth <= 768) {
                const mobileModal = document.getElementById('mobile-form-modal');
                const container = document.getElementById('mobile-form-container');
                const panel = document.querySelector('#transactions .form-panel');
                document.getElementById('mobile-modal-title').textContent = 'Nouvelle transaction';
                if (panel && container) container.appendChild(panel);
                if (mobileModal) mobileModal.classList.add('active');
            } else {
                openEditModal('form-transaction', 'Nouvelle transaction');
            }
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const type = document.getElementById('qa-type').value;
        const amount = parseFloat(document.getElementById('qa-amount').value);
        const category = document.getElementById('qa-category').value;
        const date = document.getElementById('qa-date').value;
        const note = document.getElementById('qa-note').value;

        if (isNaN(amount) || amount <= 0) {
            showQuickFeedback('Indiquez un montant valide.');
            return;
        }
        if (!category) {
            showQuickFeedback('Créez d’abord une catégorie dans Réglages > Catégories.');
            return;
        }

        // On alimente le formulaire complet : toute la logique métier est réutilisée
        const transForm = document.getElementById('form-transaction');
        resetTransactionForm();
        document.getElementById('trans-type').value = type;
        document.getElementById('trans-type').dispatchEvent(new Event('change'));
        document.getElementById('trans-amount').value = amount;
        document.getElementById('trans-date').value = date;
        document.getElementById('trans-category').value = category;
        document.getElementById('trans-category').dispatchEvent(new Event('change'));
        const mvGroup = document.getElementById('qa-mv-group');
        const mvPart = document.getElementById('qa-mv-part');
        document.getElementById('trans-mv-part').value =
            (mvGroup && mvGroup.style.display !== 'none' && mvPart) ? mvPart.value : '';
        document.getElementById('trans-note').value = note;
        if (type === 'salary') {
            document.getElementById('trans-savings-amount').value = document.getElementById('qa-savings-amount').value || 0;
        }

        if (!transForm.checkValidity()) {
            showQuickFeedback('Vérifiez les champs de la transaction.');
            return;
        }

        transForm.requestSubmit();

        // Remise à zéro de la saisie rapide
        document.getElementById('qa-amount').value = '';
        document.getElementById('qa-note').value = '';
        if (mvPart) mvPart.value = '';
        document.getElementById('qa-savings-amount').value = 0;
        document.getElementById('qa-date').value = date;
        setQuickAddType(type);
        showQuickFeedback('Transaction ajoutée.', true);
    });

    // État initial : type "Dépense" et catégories synchronisées
    setQuickAddType('expense');
}

/* -------------------------------------------------------------------------
   Widgets du tableau de bord (deltas, rythme, flux, échéances)
   ------------------------------------------------------------------------- */
function renderDashboardExtras(year, month) {
    const periodLabel = document.getElementById('dash-period-label');
    if (periodLabel) periodLabel.textContent = 'Vue de ' + MONTH_NAMES_FR[month - 1] + ' ' + year;

    const current = getMonthData(year, month);

    // Les indicateurs clés sont affichés seuls, sans comparaison avec le mois précédent.

    // --- Objectif du mois ---
    let goal = appData.spendingGoal;
    const monthStr = year + '-' + String(month).padStart(2, '0');
    if (appData.monthlyGoals && appData.monthlyGoals[monthStr] !== undefined) {
        goal = appData.monthlyGoals[monthStr];
    }

    const remaining = (goal || 0) - current.expense;

    // Légende de l'objectif
    const elTarget = document.getElementById('goal-value-target');
    if (elTarget) elTarget.textContent = goal ? fmtEuro(goal) : 'Non défini';
    const elSpent = document.getElementById('goal-value-spent');
    if (elSpent) elSpent.textContent = fmtEuro(current.expense);
    const elGoalLeft = document.getElementById('goal-value-left');
    if (elGoalLeft) {
        if (!goal) {
            elGoalLeft.textContent = '—';
            elGoalLeft.style.color = '';
        } else {
            elGoalLeft.textContent = fmtEuro(Math.max(0, remaining));
            elGoalLeft.style.color = remaining < 0 ? 'var(--danger-color)' : 'var(--success-color)';
        }
    }

    // Courbe du patrimoine
    renderPatrimonyChart(year, month);

    // --- Dernières transactions ---
    const feed = document.getElementById('dash-recent-list');
    if (feed) {
        const list = (appData.transactions || [])
            .slice()
            .filter(t => t.date)
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
            .slice(0, 8);

        if (list.length === 0) {
            feed.innerHTML = '<div class="feed-empty">Aucune transaction pour le moment.</div>';
        } else {
            feed.innerHTML = list.map(t => {
                const isIncome = t.type === 'income' || t.type === 'salary' || t.type === 'investment_return';
                const cls = isIncome ? 'is-in' : (t.type === 'investment_transfer' ? 'is-neutral' : 'is-out');
                const catName = getCategoryPath(t.categoryId);
                const label = t.note ? t.note : catName;
                const meta = (t.note ? catName + ' · ' : '') + fmtShortDate(t.date);
                const amount = (isIncome ? '+' : '-') + Math.abs(Number(t.amount) || 0).toFixed(2) + ' €';
                const color = isIncome ? 'var(--success-color)' : 'var(--danger-color)';
                const initial = (catName || '?').trim().charAt(0).toUpperCase();
                return '<div class="feed-item" data-trans-id="' + t.id + '">' +
                    '<span class="feed-avatar ' + cls + '">' + initial + '</span>' +
                    '<span class="feed-body"><span class="feed-title">' + label + '</span>' +
                    '<span class="feed-meta">' + meta + '</span></span>' +
                    '<span class="feed-amount" style="color:' + color + '">' + amount + '</span>' +
                    '</div>';
            }).join('');

            feed.querySelectorAll('.feed-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.getAttribute('data-trans-id');
                    if (id && !String(id).startsWith('virtual')) editTransaction(id);
                });
            });
        }
    }

    // --- Prochaines échéances & total récurrent ---
    const upcoming = document.getElementById('dash-upcoming-list');
    const recurringTotalEl = document.getElementById('dash-recurring-total');
    const subs = (appData.subscriptions || []).filter(s => s.status !== 'completed');

    let monthlyRecurring = 0;
    subs.forEach(s => {
        const amount = Number(s.amount) || 0;
        if (s.type !== 'expense') return;
        if (s.frequency === 'weekly') monthlyRecurring += amount * 52 / 12;
        else if (s.frequency === 'yearly') monthlyRecurring += amount / 12;
        else monthlyRecurring += amount;
    });
    if (recurringTotalEl) recurringTotalEl.textContent = fmtEuro(monthlyRecurring);

    if (upcoming) {
        const next = subs
            .map(s => ({ sub: s, date: s.nextDate || s.startDate }))
            .filter(x => x.date)
            .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))
            .slice(0, 5);

        if (next.length === 0) {
            upcoming.innerHTML = '<div class="feed-empty">Aucune récurrence active.</div>';
        } else {
            upcoming.innerHTML = next.map(x => {
                const s = x.sub;
                const isIncome = s.type === 'income';
                const color = isIncome ? 'var(--success-color)' : 'var(--danger-color)';
                const amount = (isIncome ? '+' : '-') + (Number(s.amount) || 0).toFixed(2) + ' €';
                return '<div class="feed-item">' +
                    '<span class="feed-avatar ' + (isIncome ? 'is-in' : 'is-out') + '">' + fmtShortDate(x.date).split(' ')[0] + '</span>' +
                    '<span class="feed-body"><span class="feed-title">' + (s.name || 'Récurrence') + '</span>' +
                    '<span class="feed-meta">' + fmtShortDate(x.date) + '</span></span>' +
                    '<span class="feed-amount" style="color:' + color + '">' + amount + '</span>' +
                    '</div>';
            }).join('');
        }
    }

    // --- Top catégories du mois ---
    const topEl = document.getElementById('dash-top-categories');
    if (topEl) {
        const entries = Object.entries(current.categoryExpenses || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
        const max = entries.length ? entries[0][1] : 0;

        if (entries.length === 0) {
            topEl.innerHTML = '<div class="feed-empty">Aucune dépense ce mois-ci.</div>';
        } else {
            topEl.innerHTML = entries.map(([name, value]) => {
                const pct = max ? (value / max) * 100 : 0;
                const share = current.expense ? (value / current.expense) * 100 : 0;
                return '<div class="bar-row">' +
                    '<div class="bar-row-head"><span>' + name + '</span><strong>' + value.toFixed(2) + ' € · ' + share.toFixed(0) + '%</strong></div>' +
                    '<div class="bar-track"><div class="bar-value" style="width:' + pct.toFixed(1) + '%"></div></div>' +
                    '</div>';
            }).join('');
        }
    }

    syncQuickAddCategories();
}

/* -------------------------------------------------------------------------
   Courbe d'évolution du patrimoine
   Patrimoine = trésorerie cumulée (salaires compris, épargne incluse)
   + valeur du portefeuille d'investissement à la fin de chaque mois.
   ------------------------------------------------------------------------- */
function renderPatrimonyChart(year, month) {
    const canvas = document.getElementById('dashPatrimonyChart');
    if (!canvas) return;

    const transactions = (appData.transactions || []).filter(t => t.date);
    const MONTHS_BACK = 12;

    // Un repère au 1er de chaque mois : du 1er du mois « -11 » jusqu'au 1er du mois
    // suivant le mois affiché (ce dernier point clôture donc le mois en cours).
    const bounds = [];
    for (let i = MONTHS_BACK - 1; i >= -1; i--) {
        let m = month - i;
        let y = year;
        while (m <= 0) { m += 12; y -= 1; }
        while (m > 12) { m -= 12; y += 1; }
        const key = y + '-' + String(m).padStart(2, '0') + '-01';
        bounds.push({
            key: key,
            label: '1 ' + MONTH_NAMES_FR[m - 1].slice(0, 4) + '. ' + String(y).slice(2),
            fullLabel: '1er ' + MONTH_NAMES_FR[m - 1] + ' ' + y
        });
    }

    const points = bounds.map(b => {
        let treasury = 0;
        transactions.forEach(t => {
            // Valeur « au 1er du mois » : tout ce qui précède strictement ce jour
            if (t.date >= b.key) return;
            const amount = Number(t.amount) || 0;
            if (t.type === 'income' || t.type === 'salary' || t.type === 'investment_return') treasury += amount;
            else if (t.type === 'expense' || t.type === 'investment_transfer') treasury -= amount;
        });
        const portfolio = typeof getPortfolioValueAt === 'function' ? getPortfolioValueAt(b.key) : 0;
        return { label: b.label, fullLabel: b.fullLabel, value: treasury + portfolio };
    });

    // Infobulle : total au 1er du mois + écart avec le 1er du mois précédent
    points.forEach((p, i) => {
        const lines = [p.fullLabel, 'Total : ' + fmtEuro(p.value)];
        if (i > 0) {
            const diff = p.value - points[i - 1].value;
            const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
            lines.push('Mois précédent : ' + sign + Math.abs(diff).toFixed(2) + ' €');
        } else {
            lines.push('Mois précédent : —');
        }
        p.tooltip = lines;
    });

    const totalEl = document.getElementById('dash-patrimony-total');
    if (totalEl && points.length) {
        const last = points[points.length - 1].value;
        const first = points[0].value;
        const diff = last - first;
        totalEl.textContent = fmtEuro(last) + (diff ? '  (' + (diff > 0 ? '+' : '-') + Math.abs(diff).toFixed(0) + ' € sur 12 mois)' : '');
        totalEl.style.color = last >= 0 ? 'var(--text-color)' : 'var(--danger-color)';
    }

    const hasData = points.some(p => p.value !== 0);
    drawAreaLineChart('dashPatrimonyChart', hasData ? points : [], {
        height: 200,
        markers: true,
        tooltip: true,
        emptyMessage: 'Ajoutez des transactions pour suivre votre patrimoine'
    });
}

/* -------------------------------------------------------------------------
   Initialisation de l'interface
   ------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {

    // Volet latéral mobile
    const btnOpen = document.getElementById('btn-open-sidebar');
    const btnClose = document.getElementById('btn-close-sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    if (btnOpen) btnOpen.addEventListener('click', openSidebar);
    if (btnClose) btnClose.addEventListener('click', closeSidebar);
    if (scrim) scrim.addEventListener('click', closeSidebar);

    // Fermeture automatique après un choix de navigation
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.addEventListener('click', closeSidebar);
    });

    // Bouton de thème de la barre supérieure : délègue au bouton principal
    const themeMobile = document.getElementById('theme-toggle-mobile');
    if (themeMobile) {
        themeMobile.addEventListener('click', () => {
            const main = document.getElementById('theme-toggle');
            if (main) main.click();
        });
    }

    // Surlignage du groupe de navigation actif
    document.addEventListener('viewChanged', (e) => highlightNavGroup(e.detail));
    highlightNavGroup('dashboard');

    // Retour en haut uniquement lors d'un vrai changement d'onglet
    document.querySelectorAll('.nav-link[data-target]').forEach(link => {
        link.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    initQuickAdd();
    initAdvancedFields();
    initSubscriptionSummary();
    initTransactionFilters();

    // Les graphiques sont redessinés uniquement si la largeur change.
    // (Sur mobile, l'apparition de la barre d'URL déclenche un resize en
    //  hauteur qu'il ne faut surtout pas confondre avec une rotation.)
    let resizeTimer = null;
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const active = document.querySelector('.view-section.active');
            if (!active) return;
            document.dispatchEvent(new CustomEvent('viewChanged', { detail: active.id }));
        }, 250);
    });
});

// Barre de filtres de l'historique : type, catégorie, tags
function initTransactionFilters() {
    document.querySelectorAll('#type-filters .seg-btn').forEach(btn => {
        btn.addEventListener('click', () => setTransactionFilter(btn.dataset.filter));
    });

    const searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.addEventListener('input', () => setTransactionSearch(searchInput.value));

    const catSelect = document.getElementById('filter-category');
    if (catSelect) catSelect.addEventListener('change', () => setCategoryFilter(catSelect.value));

    const clearBtn = document.getElementById('btn-clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', clearTransactionFilters);

    // Menu déroulant des tags
    const drop = document.getElementById('tag-filter-drop');
    const tagBtn = document.getElementById('btn-tag-filter');
    if (drop && tagBtn) {
        tagBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            drop.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!drop.contains(e.target)) drop.classList.remove('open');
        });
    }
}

// Résume en une phrase la récurrence en cours de saisie
function initSubscriptionSummary() {
    const form = document.getElementById('form-subscription');
    const out = document.getElementById('sub-summary');
    if (!form || !out) return;

    const update = () => {
        const type = document.getElementById('sub-type').value;
        const frequency = document.getElementById('sub-frequency').value;
        const startDate = document.getElementById('sub-start-date').value;
        const endDate = document.getElementById('sub-end-date').value;

        let amount = parseFloat(document.getElementById('sub-amount').value);
        let extra = '';

        if (frequency === 'installments') {
            const total = parseFloat(document.getElementById('sub-total-amount').value);
            const count = parseInt(document.getElementById('sub-installments-count').value, 10);
            if (!isNaN(total) && count > 1) {
                amount = total / count;
                extra = ' (' + total.toFixed(2) + ' € au total)';
            } else {
                amount = NaN;
            }
        }

        if (isNaN(amount) || amount <= 0) {
            out.textContent = 'Choisissez un montant et une fréquence.';
            out.classList.remove('is-filled');
            return;
        }

        const word = type === 'income' ? 'Revenu' : 'Dépense';
        let rhythm = '';
        if (frequency === 'weekly') rhythm = 'chaque semaine';
        else if (frequency === 'yearly') rhythm = 'chaque année';
        else if (frequency === 'installments') {
            const count = parseInt(document.getElementById('sub-installments-count').value, 10);
            rhythm = 'chaque mois pendant ' + count + ' mois';
        } else if (startDate) rhythm = 'tous les ' + parseInt(startDate.split('-')[2], 10) + ' du mois';
        else rhythm = 'chaque mois';

        let phrase = word + ' de ' + amount.toFixed(2) + ' € ' + rhythm + extra;
        if (startDate) phrase += ', à partir du ' + fmtShortDate(startDate);
        if (endDate) phrase += ' et jusqu\'au ' + fmtShortDate(endDate);

        // Poids mensuel équivalent
        let perMonth = amount;
        if (frequency === 'weekly') perMonth = amount * 52 / 12;
        else if (frequency === 'yearly') perMonth = amount / 12;
        if (frequency === 'weekly' || frequency === 'yearly') {
            phrase += ' — soit ' + perMonth.toFixed(2) + ' € par mois';
        }

        out.textContent = phrase + '.';
        out.classList.add('is-filled');
    };

    form.addEventListener('input', update);
    form.addEventListener('change', update);
    document.addEventListener('viewChanged', (e) => {
        if (e.detail === 'subscriptions') setTimeout(update, 0);
    });
    update();
}

// Ouvre le bloc "Options avancées" dès qu'un champ conditionnel devient utile
function initAdvancedFields() {
    const details = document.getElementById('trans-advanced');
    if (!details) return;

    const conditionalIds = ['trans-savings-group', 'trans-investment-group', 'trans-mv-group', 'trans-linked-expense-group'];
    const sync = () => {
        const needed = conditionalIds.some(id => {
            const el = document.getElementById(id);
            return el && el.style.display !== 'none';
        });
        if (needed) details.open = true;
    };

    ['trans-type', 'trans-category'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => setTimeout(sync, 0));
    });

    document.addEventListener('viewChanged', (e) => {
        if (e.detail === 'transactions') setTimeout(sync, 0);
    });
}

/* =========================================================================
   VACANCES — Suivi des dépenses de voyage
   Module 100% indépendant du budget : les dépenses saisies ici ne sont
   jamais injectées dans appData.transactions et n'entrent dans aucun
   calcul de budget, d'épargne ou de prédiction.

   Modèle de données :
   appData.trips = [{
       id, name, destination, startDate, endDate, budget,
       participants: [{ id, name }],
       expenses: [{ id, date, label, category, amount, paidBy, shared, sharedWith[] }]
   }]
   appData.tripCategories = [{ id, name, icon }]
   ========================================================================= */

const TRIP_DEFAULT_CATEGORIES = [
    { id: 'tc-course', name: 'Courses', icon: '🛒' },
    { id: 'tc-resto', name: 'Restaurant', icon: '🍽️' },
    { id: 'tc-essence', name: 'Essence', icon: '⛽' },
    { id: 'tc-peage', name: 'Péages', icon: '🛣️' },
    { id: 'tc-parking', name: 'Parking', icon: '🅿️' },
    { id: 'tc-avion', name: 'Avion', icon: '✈️' },
    { id: 'tc-train', name: 'Train', icon: '🚆' },
    { id: 'tc-loca', name: 'Location voiture', icon: '🚗' },
    { id: 'tc-logement', name: 'Hébergement', icon: '🏠' },
    { id: 'tc-visite', name: 'Visites', icon: '🏛️' },
    { id: 'tc-activite', name: 'Activités', icon: '🎟️' },
    { id: 'tc-shopping', name: 'Shopping', icon: '🛍️' },
    { id: 'tc-souvenir', name: 'Souvenirs', icon: '🎁' },
    { id: 'tc-sante', name: 'Santé', icon: '💊' },
    { id: 'tc-divers', name: 'Divers', icon: '💠' }
];

const TRIP_STORAGE_CURRENT = 'budget_app_current_trip';
const TRIP_STORAGE_MATRIX = 'budget_app_trip_matrix_detail';

/* Voyage fourni par défaut au premier lancement : reprise du tableur « Portugal 2026 ».
   Les montants sont ceux de l'Excel ; les dates du séjour sont indicatives et se
   modifient depuis le bouton « Modifier » de la fiche.
   Chaque ligne : [catégorie, payé par Justin, payé par Gaëlle, partagée ?] */
const TRIP_SEED_PORTUGAL = {
    name: 'Portugal 2026',
    destination: 'Portugal',
    startDate: '2026-06-06',
    endDate: '2026-06-13',
    budget: 0,
    participants: [
        { id: 'tp-seed-justin', name: 'Justin' },
        { id: 'tp-seed-gaelle', name: 'Gaëlle' }
    ],
    rows: [
        ['Courses', 80.34, 81.20, true],
        ['Essence', 131.14, 0, true],
        ['Restaurant', 72.50, 46.75, true],
        ['Parking', 16.00, 35.00, true],
        ['Visites', 66.95, 24.00, true],
        ['Péages', 98.56, 0, true],
        ['Avion', 320.72, 0, true],
        ['Hébergement', 75.92, 0, true],
        ['Location voiture', 121.12, 0, true],
        ['Perso', 20.00, 0, false]
    ]
};

// Crée le voyage de démarrage une seule fois : s'il est supprimé, il ne revient pas.
window.seedDefaultTrips = async function() {
    if (appData.tripsSeeded) return;
    appData.tripsSeeded = true;

    if (Array.isArray(appData.trips) && appData.trips.length > 0) {
        await saveData();
        return;
    }

    const seed = TRIP_SEED_PORTUGAL;
    const participantIds = seed.participants.map(p => p.id);

    // La catégorie « Perso » n'existe pas dans la liste par défaut : on l'ajoute.
    if (!getTripCategory('Perso')) {
        getTripCategories().push({ id: 'tc-perso', name: 'Perso', icon: '🎒' });
    }

    const expenses = [];
    seed.rows.forEach(([category, amountJustin, amountGaelle, shared], index) => {
        seed.participants.forEach((participant, pIndex) => {
            const amount = pIndex === 0 ? amountJustin : amountGaelle;
            if (!amount) return;
            expenses.push({
                id: 'te-seed-' + index + '-' + pIndex,
                date: seed.startDate,
                label: category,
                category: category,
                amount: amount,
                paidBy: participant.id,
                shared: shared,
                sharedWith: shared ? participantIds.slice() : []
            });
        });
    });

    const trip = {
        id: 'trip-seed-portugal-2026',
        name: seed.name,
        destination: seed.destination,
        startDate: seed.startDate,
        endDate: seed.endDate,
        budget: seed.budget,
        participants: seed.participants.map(p => ({ ...p })),
        expenses: expenses
    };

    getTrips().push(trip);
    window.currentTripId = trip.id;
    try { localStorage.setItem(TRIP_STORAGE_CURRENT, trip.id); } catch (e) { /* stockage indisponible */ }

    await saveData();
};

// Brouillon de participants pendant l'édition d'un voyage dans la modale
let tripParticipantsDraft = [];
// Filtres du journal des dépenses
let tripExpenseFilters = { search: '', category: '', payer: '' };
// Récapitulatif : totaux seuls par défaut, détail du partage à la demande
let tripMatrixDetailed = false;

/* ---------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------- */
function tripEscape(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getTrips() {
    if (!Array.isArray(appData.trips)) appData.trips = [];
    return appData.trips;
}

function getTripCategories() {
    if (!Array.isArray(appData.tripCategories) || appData.tripCategories.length === 0) {
        appData.tripCategories = TRIP_DEFAULT_CATEGORIES.map(c => ({ ...c }));
    }
    return appData.tripCategories;
}

function getTripCategory(name) {
    return getTripCategories().find(c => c.name === name) || null;
}

function tripCategoryIcon(name) {
    const cat = getTripCategory(name);
    return cat ? cat.icon : '💠';
}

// Voyages triés du plus récent au plus ancien
function getSortedTrips() {
    return [...getTrips()].sort((a, b) => {
        const da = a.startDate || '0000-00-00';
        const dbb = b.startDate || '0000-00-00';
        if (da === dbb) return (a.name || '').localeCompare(b.name || '');
        return dbb.localeCompare(da);
    });
}

function getCurrentTrip() {
    const trips = getTrips();
    if (trips.length === 0) return null;
    let trip = trips.find(t => t.id === window.currentTripId);
    if (!trip) {
        trip = getSortedTrips()[0];
        window.currentTripId = trip.id;
    }
    return trip;
}

function setCurrentTrip(id) {
    window.currentTripId = id;
    try { localStorage.setItem(TRIP_STORAGE_CURRENT, id); } catch (e) { /* stockage indisponible */ }
    renderTrips();
}
window.setCurrentTrip = setCurrentTrip;

function participantName(trip, id) {
    const p = (trip.participants || []).find(x => x.id === id);
    return p ? p.name : 'Inconnu';
}

function participantInitials(name) {
    return (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function tripDurationDays(trip) {
    if (trip.startDate && trip.endDate) {
        const d1 = new Date(trip.startDate);
        const d2 = new Date(trip.endDate);
        if (!isNaN(d1) && !isNaN(d2)) {
            return Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
        }
    }
    const dates = new Set((trip.expenses || []).map(e => e.date).filter(Boolean));
    return Math.max(1, dates.size);
}

function tripStatus(trip) {
    const today = new Date().toISOString().slice(0, 10);
    if (trip.startDate && today < trip.startDate) return { label: 'À venir', cls: 'badge-warning' };
    if (trip.endDate && today > trip.endDate) return { label: 'Terminé', cls: 'badge-closed' };
    if (trip.startDate && trip.endDate) return { label: 'En cours', cls: '' };
    return { label: 'Sans dates', cls: 'badge-closed' };
}

function formatTripDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTripDayLong(dateStr) {
    if (!dateStr) return 'Sans date';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ---------------------------------------------------------------------
   Calculs : totaux, parts et équilibrage
   --------------------------------------------------------------------- */
function computeTripStats(trip) {
    const participants = trip.participants || [];
    const ids = participants.map(p => p.id);

    const stats = {
        total: 0,
        shared: 0,
        personal: 0,
        perPerson: 0,
        count: (trip.expenses || []).length,
        paid: {},
        due: {},
        balance: {},
        categories: {},      // nom -> { total, shared, personal, byPayer }
        daily: {},           // date -> montant
        settlements: []
    };

    ids.forEach(id => { stats.paid[id] = 0; stats.due[id] = 0; });

    (trip.expenses || []).forEach(exp => {
        const amount = Number(exp.amount) || 0;
        const payer = exp.paidBy;

        stats.total += amount;
        stats.paid[payer] = (stats.paid[payer] || 0) + amount;
        if (exp.date) stats.daily[exp.date] = (stats.daily[exp.date] || 0) + amount;

        const catName = exp.category || 'Divers';
        if (!stats.categories[catName]) {
            stats.categories[catName] = { total: 0, shared: 0, personal: 0, byPayer: {} };
        }
        const cat = stats.categories[catName];
        cat.total += amount;
        cat.byPayer[payer] = (cat.byPayer[payer] || 0) + amount;

        if (exp.shared) {
            stats.shared += amount;
            cat.shared += amount;
            let among = Array.isArray(exp.sharedWith) && exp.sharedWith.length
                ? exp.sharedWith.filter(id => ids.includes(id))
                : ids.slice();
            if (among.length === 0) among = ids.slice();
            const part = among.length ? amount / among.length : 0;
            among.forEach(id => { stats.due[id] = (stats.due[id] || 0) + part; });
        } else {
            stats.personal += amount;
            cat.personal += amount;
            stats.due[payer] = (stats.due[payer] || 0) + amount;
        }
    });

    stats.perPerson = ids.length ? stats.shared / ids.length : stats.shared;
    ids.forEach(id => { stats.balance[id] = (stats.paid[id] || 0) - (stats.due[id] || 0); });
    stats.settlements = computeTripSettlements(stats.balance);

    return stats;
}

// Remboursements minimaux : on apparie les plus gros créanciers aux plus gros débiteurs
function computeTripSettlements(balance) {
    const creditors = [];
    const debtors = [];

    Object.keys(balance).forEach(id => {
        const value = balance[id];
        if (value > 0.005) creditors.push({ id, value });
        else if (value < -0.005) debtors.push({ id, value: -value });
    });

    creditors.sort((a, b) => b.value - a.value);
    debtors.sort((a, b) => b.value - a.value);

    const transfers = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
        const amount = Math.min(debtors[i].value, creditors[j].value);
        transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
        debtors[i].value -= amount;
        creditors[j].value -= amount;
        if (debtors[i].value < 0.005) i++;
        if (creditors[j].value < 0.005) j++;
    }
    return transfers;
}

/* ---------------------------------------------------------------------
   Rendu principal
   --------------------------------------------------------------------- */
function renderTrips() {
    const trips = getTrips();
    const emptyBox = document.getElementById('trip-empty');
    const detailBox = document.getElementById('trip-detail');
    const selector = document.getElementById('trip-selector');
    if (!selector) return;

    const sorted = getSortedTrips();
    const trip = getCurrentTrip();

    // Sélecteur de voyage
    selector.innerHTML = sorted.map(t =>
        `<option value="${tripEscape(t.id)}"${trip && t.id === trip.id ? ' selected' : ''}>${tripEscape(t.name)}</option>`
    ).join('');
    selector.style.display = sorted.length ? '' : 'none';

    if (!trip) {
        if (emptyBox) emptyBox.style.display = 'block';
        if (detailBox) detailBox.style.display = 'none';
        return;
    }
    if (emptyBox) emptyBox.style.display = 'none';
    if (detailBox) detailBox.style.display = 'block';

    const stats = computeTripStats(trip);

    renderTripHero(trip, stats);
    renderTripSummary(trip, stats);
    renderTripBudget(trip, stats);
    renderTripSettlement(trip, stats);
    renderTripMatrix(trip, stats);
    syncTripDetailCards();
    renderTripExpenseFilters(trip);
    renderTripExpenseList(trip);
    renderTripCharts(trip, stats);
}
window.renderTrips = renderTrips;

function renderTripHero(trip, stats) {
    const status = tripStatus(trip);
    document.getElementById('trip-hero-name').textContent = trip.name;

    const badge = document.getElementById('trip-hero-status');
    badge.textContent = status.label;
    badge.className = 'badge ' + status.cls;

    const days = tripDurationDays(trip);
    const bits = [];
    if (trip.destination) bits.push(tripEscape(trip.destination));
    if (trip.startDate || trip.endDate) {
        bits.push(`${formatTripDate(trip.startDate) || '?'} → ${formatTripDate(trip.endDate) || '?'}`);
    }
    bits.push(days + (days > 1 ? ' jours' : ' jour'));
    bits.push((trip.participants || []).map(p => tripEscape(p.name)).join(' · ') || 'Aucun participant');
    bits.push(stats.count + (stats.count > 1 ? ' dépenses' : ' dépense'));

    document.getElementById('trip-hero-meta').innerHTML = bits.join(' <span class="cat-sep">•</span> ');
}

function renderTripSummary(trip, stats) {
    const container = document.getElementById('trip-summary');
    const days = tripDurationDays(trip);
    const nbParticipants = (trip.participants || []).length || 1;

    const cards = [
        { cls: 'stat-expense', label: 'Total du voyage', value: fmtEuro(stats.total), sub: fmtEuro(stats.total / days) + ' / jour' },
        { cls: 'stat-accent', label: 'Total partagé', value: fmtEuro(stats.shared), sub: 'réparti entre ' + nbParticipants + (nbParticipants > 1 ? ' personnes' : ' personne') },
        { cls: '', label: 'Part / personne', value: fmtEuro(stats.perPerson), sub: 'sur les dépenses partagées' },
        { cls: '', label: 'Dépenses perso', value: fmtEuro(stats.personal), sub: 'non partagées' }
    ];

    container.innerHTML = cards.map(c => `
        <div class="card stat-card ${c.cls}">
            <div class="stat-head"><h3>${c.label}</h3></div>
            <p>${c.value}</p>
            <span class="stat-delta">${c.sub}</span>
        </div>
    `).join('');
}

function renderTripBudget(trip, stats) {
    const card = document.getElementById('trip-budget-card');
    const budget = Number(trip.budget) || 0;

    if (!budget) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'block';

    const pct = Math.min(100, (stats.total / budget) * 100);
    const rest = budget - stats.total;
    const fill = document.getElementById('trip-budget-fill');
    fill.style.width = pct.toFixed(1) + '%';
    fill.style.background = rest < 0 ? 'var(--danger-color)' : (pct > 85 ? 'var(--warning-color)' : 'var(--success-color)');

    document.getElementById('trip-budget-caption').textContent = Math.round(pct) + ' % consommé';
    document.getElementById('trip-budget-stats').innerHTML = `
        <div class="mini-stat"><span class="mini-label">Budget prévu</span><span class="mini-value">${fmtEuro(budget)}</span></div>
        <div class="mini-stat"><span class="mini-label">Dépensé</span><span class="mini-value">${fmtEuro(stats.total)}</span></div>
        <div class="mini-stat"><span class="mini-label">${rest < 0 ? 'Dépassement' : 'Restant'}</span><span class="mini-value ${rest < 0 ? 'text-red' : 'text-green'}">${fmtEuro(Math.abs(rest))}</span></div>
    `;
}

function renderTripSettlement(trip, stats) {
    const participants = trip.participants || [];
    const balancesBox = document.getElementById('trip-balances');
    const settlementBox = document.getElementById('trip-settlements');

    balancesBox.innerHTML = participants.map((p, i) => {
        const paid = stats.paid[p.id] || 0;
        const due = stats.due[p.id] || 0;
        const bal = stats.balance[p.id] || 0;
        const color = CHART_PALETTE[i % CHART_PALETTE.length];
        return `
            <div class="trip-balance">
                <span class="trip-avatar" style="background:${color}1f;color:${color};">${tripEscape(participantInitials(p.name))}</span>
                <div class="trip-balance-main">
                    <span class="trip-balance-name">${tripEscape(p.name)}</span>
                    <span class="trip-balance-meta">A payé ${fmtEuro(paid)} · doit ${fmtEuro(due)}</span>
                </div>
                <span class="trip-balance-value ${bal >= 0 ? 'text-green' : 'text-red'}">${(bal >= 0 ? '+' : '−') + fmtEuro(Math.abs(bal))}</span>
            </div>
        `;
    }).join('') || '<p class="muted">Ajoutez des participants pour calculer les parts.</p>';

    if (stats.settlements.length === 0) {
        settlementBox.innerHTML = participants.length
            ? '<p class="trip-settled">Tout est équilibré, personne ne doit rien.</p>'
            : '';
        return;
    }

    settlementBox.innerHTML = stats.settlements.map(s => `
        <div class="trip-settlement">
            <strong>${tripEscape(participantName(trip, s.from))}</strong>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
            <strong>${tripEscape(participantName(trip, s.to))}</strong>
            <span class="trip-settlement-amount">${fmtEuro(s.amount)}</span>
        </div>
    `).join('');
}

/* Matrice catégorie x participant (l'équivalent du tableau Excel) */
function renderTripMatrix(trip, stats) {
    const participants = trip.participants || [];
    const sharedBox = document.getElementById('trip-matrix-shared');
    const personalBox = document.getElementById('trip-matrix-personal');

    // Vue repliée : catégorie + total. Vue détaillée : colonnes par participant + part de chacun.
    const detailed = tripMatrixDetailed;

    const buildTable = (title, rows, isShared) => {
        if (rows.length === 0) return '';

        const head = `
            <div class="tm-row tm-head">
                <span>Catégorie</span>
                ${detailed ? participants.map(p => `<span class="tm-num">${tripEscape(p.name)}</span>`).join('') : ''}
                <span class="tm-num">Total</span>
                ${detailed ? `<span class="tm-num">${isShared ? 'Part / pers.' : ''}</span>` : ''}
            </div>`;

        const totalRow = { total: 0, byPayer: {} };
        rows.forEach(r => {
            totalRow.total += r.amount;
            participants.forEach(p => {
                totalRow.byPayer[p.id] = (totalRow.byPayer[p.id] || 0) + (r.byPayer[p.id] || 0);
            });
        });

        const body = rows.map(r => `
            <div class="tm-row">
                <span class="tm-cat"><span class="tm-icon">${r.icon}</span>${tripEscape(r.name)}</span>
                ${detailed ? participants.map(p => {
                    const v = r.byPayer[p.id] || 0;
                    return `<span class="tm-num${v ? '' : ' is-zero'}">${fmtEuro(v)}</span>`;
                }).join('') : ''}
                <span class="tm-num tm-total">${fmtEuro(r.amount)}</span>
                ${detailed ? `<span class="tm-num tm-share">${isShared ? fmtEuro(participants.length ? r.amount / participants.length : r.amount) : '<em class="muted">non partagé</em>'}</span>` : ''}
            </div>
        `).join('');

        const foot = `
            <div class="tm-row tm-foot">
                <span>Total</span>
                ${detailed ? participants.map(p => `<span class="tm-num">${fmtEuro(totalRow.byPayer[p.id] || 0)}</span>`).join('') : ''}
                <span class="tm-num">${fmtEuro(totalRow.total)}</span>
                ${detailed ? `<span class="tm-num">${isShared ? fmtEuro(participants.length ? totalRow.total / participants.length : totalRow.total) : ''}</span>` : ''}
            </div>`;

        return `
            <h4 class="tm-title${isShared ? '' : ' tm-title-perso'}">${title}</h4>
            <div class="tm-scroll">
                <div class="trip-matrix${detailed ? '' : ' is-simple'}" style="--tm-cols:${participants.length}">
                    ${head}${body}${foot}
                </div>
            </div>`;
    };

    const sharedRows = [];
    const personalRows = [];

    Object.keys(stats.categories).sort((a, b) => stats.categories[b].total - stats.categories[a].total).forEach(name => {
        const cat = stats.categories[name];
        const icon = tripCategoryIcon(name);

        if (cat.shared > 0) {
            const byPayer = {};
            (trip.expenses || []).filter(e => e.shared && (e.category || 'Divers') === name)
                .forEach(e => { byPayer[e.paidBy] = (byPayer[e.paidBy] || 0) + (Number(e.amount) || 0); });
            sharedRows.push({ name, icon, amount: cat.shared, byPayer });
        }
        if (cat.personal > 0) {
            const byPayer = {};
            (trip.expenses || []).filter(e => !e.shared && (e.category || 'Divers') === name)
                .forEach(e => { byPayer[e.paidBy] = (byPayer[e.paidBy] || 0) + (Number(e.amount) || 0); });
            personalRows.push({ name, icon, amount: cat.personal, byPayer });
        }
    });

    sharedBox.innerHTML = sharedRows.length
        ? buildTable('Dépenses partagées', sharedRows, true)
        : '<p class="muted">Aucune dépense partagée pour l\'instant.</p>';
    personalBox.innerHTML = buildTable('Dépenses personnelles — non partagées', personalRows, false);
}

/* ---------------------------------------------------------------------
   Journal des dépenses
   --------------------------------------------------------------------- */
function renderTripExpenseFilters(trip) {
    const catSelect = document.getElementById('trip-expense-filter-category');
    const paySelect = document.getElementById('trip-expense-filter-payer');
    if (!catSelect || !paySelect) return;

    const used = [...new Set((trip.expenses || []).map(e => e.category || 'Divers'))].sort();
    catSelect.innerHTML = '<option value="">Toutes les catégories</option>' +
        used.map(c => `<option value="${tripEscape(c)}"${tripExpenseFilters.category === c ? ' selected' : ''}>${tripCategoryIcon(c)} ${tripEscape(c)}</option>`).join('');
    catSelect.classList.toggle('is-active', !!tripExpenseFilters.category);

    paySelect.innerHTML = '<option value="">Tous les participants</option>' +
        (trip.participants || []).map(p => `<option value="${tripEscape(p.id)}"${tripExpenseFilters.payer === p.id ? ' selected' : ''}>Payé par ${tripEscape(p.name)}</option>`).join('');
    paySelect.classList.toggle('is-active', !!tripExpenseFilters.payer);
}

function renderTripExpenseList(trip) {
    const container = document.getElementById('trip-expense-list');
    if (!container) return;

    const search = (tripExpenseFilters.search || '').toLowerCase().trim();
    let expenses = (trip.expenses || []).filter(e => {
        if (tripExpenseFilters.category && (e.category || 'Divers') !== tripExpenseFilters.category) return false;
        if (tripExpenseFilters.payer && e.paidBy !== tripExpenseFilters.payer) return false;
        if (search) {
            const hay = ((e.label || '') + ' ' + (e.category || '')).toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    if (expenses.length === 0) {
        container.innerHTML = '<p class="feed-empty">Aucune dépense à afficher.</p>';
        return;
    }

    expenses = expenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Regroupement par jour
    const groups = [];
    expenses.forEach(e => {
        const last = groups[groups.length - 1];
        if (last && last.date === e.date) last.items.push(e);
        else groups.push({ date: e.date, items: [e] });
    });

    container.innerHTML = groups.map(g => {
        const dayTotal = g.items.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        return `
        <div class="trip-exp-group">
            <div class="trip-exp-day">
                <span>${tripEscape(formatTripDayLong(g.date))}</span>
                <span class="trip-exp-day-total">${fmtEuro(dayTotal)}</span>
            </div>
            ${g.items.map(e => `
                <div class="trip-exp-row">
                    <span class="trip-exp-icon">${tripCategoryIcon(e.category)}</span>
                    <div class="trip-exp-main">
                        <span class="trip-exp-title">${tripEscape(e.label || e.category || 'Dépense')}</span>
                        <span class="trip-exp-sub">
                            ${tripEscape(e.category || 'Divers')}
                            <span class="cat-sep">•</span> ${tripEscape(participantName(trip, e.paidBy))}
                            ${e.shared
                                ? `<span class="trip-tag is-shared">Partagé${(Array.isArray(e.sharedWith) && e.sharedWith.length && e.sharedWith.length < (trip.participants || []).length) ? ' (' + e.sharedWith.map(id => tripEscape(participantName(trip, id))).join(', ') + ')' : ''}</span>`
                                : '<span class="trip-tag is-perso">Perso</span>'}
                        </span>
                    </div>
                    <div class="trip-exp-right">
                        <span class="trip-exp-amount">${fmtEuro(Number(e.amount) || 0)}</span>
                    </div>
                    <div class="trip-exp-actions">
                        <button type="button" class="icon-action" title="Modifier" onclick="editTripExpense('${e.id}')">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                        </button>
                        <button type="button" class="icon-action is-delete" title="Supprimer" onclick="deleteTripExpense('${e.id}')">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>`;
    }).join('');
}

/* ---------------------------------------------------------------------
   Graphiques
   --------------------------------------------------------------------- */
function renderTripCharts(trip, stats) {
    // Camembert par catégorie (clics désactivés : rien à voir avec le budget)
    const catTotals = {};
    Object.keys(stats.categories).forEach(name => { catTotals[name] = stats.categories[name].total; });
    drawPieChart('tripCategoryChart', catTotals);
    chartInteractions['tripCategoryChart'] = [];

    // Payé par participant
    const payerData = (trip.participants || []).map((p, i) => ({
        label: p.name,
        value: stats.paid[p.id] || 0,
        color: CHART_PALETTE[i % CHART_PALETTE.length]
    }));
    drawSimpleBarChart('tripParticipantChart', payerData, {
        horizontal: true,
        emptyMessage: 'Aucune dépense enregistrée'
    });

    // Dépenses jour par jour
    const days = Object.keys(stats.daily).sort();
    const dailyData = days.map(d => ({
        label: new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        value: stats.daily[d]
    }));
    drawSimpleBarChart('tripDailyChart', dailyData, {
        height: 240,
        sparseLabels: dailyData.length > 12,
        emptyMessage: 'Aucune dépense enregistrée'
    });
}

/* ---------------------------------------------------------------------
   Comparatif entre voyages
   --------------------------------------------------------------------- */
function renderTripsCompare() {
    const trips = getSortedTrips();
    const summary = document.getElementById('tripc-summary');
    const tbody = document.querySelector('#table-trips-compare tbody');
    if (!summary || !tbody) return;

    const rows = trips.map(t => {
        const stats = computeTripStats(t);
        const days = tripDurationDays(t);
        const nb = (t.participants || []).length || 1;
        return { trip: t, stats, days, nb, perDay: stats.total / days, perPerson: stats.total / nb };
    });

    const grandTotal = rows.reduce((sum, r) => sum + r.stats.total, 0);
    const avgPerDay = rows.length ? rows.reduce((sum, r) => sum + r.perDay, 0) / rows.length : 0;
    const priciest = rows.reduce((best, r) => (!best || r.stats.total > best.stats.total ? r : best), null);

    summary.innerHTML = `
        <div class="card stat-card stat-accent">
            <div class="stat-head"><h3>Voyages enregistrés</h3></div>
            <p>${rows.length}</p>
            <span class="stat-delta">${rows.reduce((s, r) => s + r.days, 0)} jours cumulés</span>
        </div>
        <div class="card stat-card stat-expense">
            <div class="stat-head"><h3>Total dépensé</h3></div>
            <p>${fmtEuro(grandTotal)}</p>
            <span class="stat-delta">toutes vacances confondues</span>
        </div>
        <div class="card stat-card">
            <div class="stat-head"><h3>Coût moyen / jour</h3></div>
            <p>${fmtEuro(avgPerDay)}</p>
            <span class="stat-delta">moyenne des voyages</span>
        </div>
        <div class="card stat-card">
            <div class="stat-head"><h3>Voyage le plus cher</h3></div>
            <p>${priciest ? fmtEuro(priciest.stats.total) : fmtEuro(0)}</p>
            <span class="stat-delta">${priciest ? tripEscape(priciest.trip.name) : '—'}</span>
        </div>
    `;

    // Tableau comparatif
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Aucun voyage enregistré.</td></tr>';
    } else {
        tbody.innerHTML = rows.map(r => `
            <tr class="clickable-row" onclick="openTripFromCompare('${r.trip.id}')">
                <td data-label="Nom"><strong>${tripEscape(r.trip.name)}</strong>${r.trip.destination ? '<br><small class="muted">' + tripEscape(r.trip.destination) + '</small>' : ''}</td>
                <td data-label="Dates">${formatTripDate(r.trip.startDate) || '—'} → ${formatTripDate(r.trip.endDate) || '—'}</td>
                <td data-label="Durée">${r.days} j</td>
                <td data-label="Participants">${r.nb}</td>
                <td data-label="Montant"><strong>${fmtEuro(r.stats.total)}</strong></td>
                <td data-label="Par jour">${fmtEuro(r.perDay)}</td>
                <td data-label="Par personne">${fmtEuro(r.perPerson)}</td>
            </tr>
        `).join('');
    }

    // Graphiques comparatifs
    const chronological = [...rows].reverse();
    drawSimpleBarChart('tripCompareTotalChart', chronological.map((r, i) => ({
        label: r.trip.name,
        value: r.stats.total,
        color: CHART_PALETTE[i % CHART_PALETTE.length]
    })), { horizontal: true, emptyMessage: 'Aucun voyage à comparer' });

    drawSimpleBarChart('tripCompareDayChart', chronological.map((r, i) => ({
        label: r.trip.name,
        value: r.perDay,
        color: CHART_PALETTE[i % CHART_PALETTE.length]
    })), { horizontal: true, emptyMessage: 'Aucun voyage à comparer' });

    const allCategories = {};
    rows.forEach(r => {
        Object.keys(r.stats.categories).forEach(name => {
            allCategories[name] = (allCategories[name] || 0) + r.stats.categories[name].total;
        });
    });
    drawPieChart('tripCompareCategoryChart', allCategories);
    chartInteractions['tripCompareCategoryChart'] = [];
}
window.renderTripsCompare = renderTripsCompare;

window.openTripFromCompare = function(tripId) {
    setCurrentTrip(tripId);
    document.querySelector('.nav-link[data-target="trips"]').click();
};

/* ---------------------------------------------------------------------
   Modale : création / édition d'un voyage
   --------------------------------------------------------------------- */
function renderTripParticipantsEditor() {
    const box = document.getElementById('trip-participants-list');
    if (!box) return;

    box.innerHTML = tripParticipantsDraft.map((p, i) => `
        <div class="trip-participant-row">
            <span class="trip-avatar" style="background:${CHART_PALETTE[i % CHART_PALETTE.length]}1f;color:${CHART_PALETTE[i % CHART_PALETTE.length]};">${tripEscape(participantInitials(p.name || '?'))}</span>
            <input type="text" class="trip-participant-input" data-index="${i}" value="${tripEscape(p.name)}" placeholder="Prénom">
            <button type="button" class="icon-action is-delete" title="Retirer" data-remove-participant="${i}">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('');

    box.querySelectorAll('.trip-participant-input').forEach(input => {
        input.addEventListener('input', (e) => {
            tripParticipantsDraft[Number(e.target.dataset.index)].name = e.target.value;
        });
    });

    box.querySelectorAll('[data-remove-participant]').forEach(btn => {
        btn.addEventListener('click', () => {
            tripParticipantsDraft.splice(Number(btn.dataset.removeParticipant), 1);
            renderTripParticipantsEditor();
        });
    });
}

window.openTripModal = function(tripId) {
    const trip = tripId ? getTrips().find(t => t.id === tripId) : null;

    document.getElementById('trip-modal-title').textContent = trip ? 'Modifier le voyage' : 'Nouveau voyage';
    document.getElementById('trip-id').value = trip ? trip.id : '';
    document.getElementById('trip-name').value = trip ? trip.name : '';
    document.getElementById('trip-destination').value = trip ? (trip.destination || '') : '';
    document.getElementById('trip-budget').value = trip && trip.budget ? trip.budget : '';
    document.getElementById('trip-start').value = trip ? (trip.startDate || '') : '';
    document.getElementById('trip-end').value = trip ? (trip.endDate || '') : '';

    tripParticipantsDraft = trip
        ? (trip.participants || []).map(p => ({ ...p }))
        : [{ id: 'tp-' + generateId(), name: '' }];
    renderTripParticipantsEditor();

    document.getElementById('trip-modal-overlay').classList.add('active');
    setTimeout(() => document.getElementById('trip-name').focus(), 50);
};

function closeTripModal() {
    document.getElementById('trip-modal-overlay').classList.remove('active');
}

/* ---------------------------------------------------------------------
   Modale : création / édition d'une dépense
   --------------------------------------------------------------------- */
function renderTripExpenseCategoryOptions(selected) {
    const select = document.getElementById('trip-expense-category');
    const cats = getTripCategories();
    select.innerHTML = cats.map(c =>
        `<option value="${tripEscape(c.name)}"${c.name === selected ? ' selected' : ''}>${c.icon} ${tripEscape(c.name)}</option>`
    ).join('') + '<option value="__new__">➕ Nouvelle catégorie…</option>';
}

function renderTripShareChips(trip, selectedIds, isShared) {
    const box = document.getElementById('trip-expense-shared-with');
    const hint = document.getElementById('trip-expense-share-hint');
    const participants = trip.participants || [];

    if (!isShared) {
        box.innerHTML = '';
        box.style.display = 'none';
        hint.textContent = 'Dépense personnelle : elle reste à la charge de celui qui a payé.';
        return;
    }

    box.style.display = 'flex';
    box.innerHTML = participants.map(p => `
        <button type="button" class="filter-chip trip-share-chip${selectedIds.includes(p.id) ? ' active' : ''}" data-participant="${tripEscape(p.id)}">${tripEscape(p.name)}</button>
    `).join('');

    box.querySelectorAll('.trip-share-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            updateTripShareHint(trip);
        });
    });
    updateTripShareHint(trip);
}

function getSelectedShareIds() {
    return [...document.querySelectorAll('#trip-expense-shared-with .trip-share-chip.active')]
        .map(c => c.dataset.participant);
}

function updateTripShareHint(trip) {
    const hint = document.getElementById('trip-expense-share-hint');
    const ids = getSelectedShareIds();
    const amount = parseFloat(document.getElementById('trip-expense-amount').value) || 0;

    if (ids.length === 0) {
        hint.textContent = 'Sélectionnez au moins une personne concernée par le partage.';
        return;
    }
    hint.textContent = amount
        ? `${fmtEuro(amount / ids.length)} par personne (${ids.length} participant${ids.length > 1 ? 's' : ''}).`
        : `Partagé entre ${ids.length} participant${ids.length > 1 ? 's' : ''}.`;
}

function setTripShareMode(isShared, trip, selectedIds) {
    document.querySelectorAll('.trip-share-toggle .seg-btn').forEach(btn => {
        btn.classList.toggle('active', (btn.dataset.share === 'shared') === isShared);
    });
    renderTripShareChips(trip, selectedIds, isShared);
}

window.openTripExpenseModal = function(expenseId) {
    const trip = getCurrentTrip();
    if (!trip) return;

    if ((trip.participants || []).length === 0) {
        alert('Ajoutez d\'abord au moins un participant au voyage (bouton « Modifier »).');
        return;
    }

    const expense = expenseId ? (trip.expenses || []).find(e => e.id === expenseId) : null;
    const ids = trip.participants.map(p => p.id);

    document.getElementById('trip-expense-modal-title').textContent = expense ? 'Modifier la dépense' : 'Ajouter une dépense';
    document.getElementById('trip-expense-id').value = expense ? expense.id : '';
    document.getElementById('trip-expense-amount').value = expense ? expense.amount : '';
    document.getElementById('trip-expense-label').value = expense ? (expense.label || '') : '';

    // Par défaut : aujourd'hui si l'on est pendant le voyage, sinon le premier jour du séjour
    const today = new Date().toISOString().slice(0, 10);
    let defaultDate = today;
    if (trip.startDate && today < trip.startDate) defaultDate = trip.startDate;
    else if (trip.endDate && today > trip.endDate) defaultDate = trip.endDate;
    document.getElementById('trip-expense-date').value = expense ? expense.date : defaultDate;

    renderTripExpenseCategoryOptions(expense ? expense.category : getTripCategories()[0].name);

    const payerSelect = document.getElementById('trip-expense-payer');
    payerSelect.innerHTML = trip.participants.map(p =>
        `<option value="${tripEscape(p.id)}"${expense && expense.paidBy === p.id ? ' selected' : ''}>${tripEscape(p.name)}</option>`
    ).join('');

    const isShared = expense ? !!expense.shared : true;
    const selected = expense && Array.isArray(expense.sharedWith) && expense.sharedWith.length
        ? expense.sharedWith.filter(id => ids.includes(id))
        : ids;
    setTripShareMode(isShared, trip, selected);

    document.getElementById('trip-expense-modal-overlay').classList.add('active');
    setTimeout(() => document.getElementById('trip-expense-amount').focus(), 50);
};

function closeTripExpenseModal() {
    document.getElementById('trip-expense-modal-overlay').classList.remove('active');
}

window.editTripExpense = function(id) {
    window.openTripExpenseModal(id);
};

window.deleteTripExpense = async function(id) {
    const trip = getCurrentTrip();
    if (!trip) return;
    if (!confirm('Supprimer cette dépense de vacances ?')) return;

    trip.expenses = (trip.expenses || []).filter(e => e.id !== id);
    await saveData();
    renderTrips();
};

function syncTripMatrixToggle() {
    const btn = document.getElementById('btn-toggle-trip-matrix');
    if (btn) {
        btn.textContent = tripMatrixDetailed ? 'Masquer le détail' : 'Afficher le détail';
        btn.setAttribute('aria-expanded', tripMatrixDetailed ? 'true' : 'false');
    }
    syncTripDetailCards();
}

/* Le partage entre participants (équilibrage, payé par participant) n'apparaît
   qu'en vue détaillée : par défaut on ne montre que les dépenses et catégories. */
function syncTripDetailCards() {
    ['trip-settlement-card', 'trip-participant-card'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = tripMatrixDetailed ? '' : 'none';
    });
}

/* ---------------------------------------------------------------------
   Initialisation : écouteurs
   --------------------------------------------------------------------- */
function initTripsModule() {
    if (!document.getElementById('trips')) return;

    try {
        const stored = localStorage.getItem(TRIP_STORAGE_CURRENT);
        if (stored) window.currentTripId = stored;
    } catch (e) { /* stockage indisponible */ }

    // Sélection du voyage courant
    document.getElementById('trip-selector').addEventListener('change', (e) => setCurrentTrip(e.target.value));

    // Création / édition / suppression d'un voyage
    document.getElementById('btn-new-trip').addEventListener('click', () => window.openTripModal());
    const btnNew2 = document.getElementById('btn-new-trip-2');
    if (btnNew2) btnNew2.addEventListener('click', () => window.openTripModal());

    document.getElementById('btn-edit-trip').addEventListener('click', () => {
        const trip = getCurrentTrip();
        if (trip) window.openTripModal(trip.id);
    });

    document.getElementById('btn-delete-trip').addEventListener('click', async () => {
        const trip = getCurrentTrip();
        if (!trip) return;
        if (!confirm(`Supprimer le voyage « ${trip.name} » et toutes ses dépenses ?`)) return;

        appData.trips = getTrips().filter(t => t.id !== trip.id);
        window.currentTripId = null;
        await saveData();
        renderTrips();
        renderTripsCompare();
    });

    document.getElementById('btn-close-trip-modal').addEventListener('click', closeTripModal);
    document.getElementById('btn-cancel-trip-modal').addEventListener('click', closeTripModal);
    document.getElementById('btn-add-participant').addEventListener('click', () => {
        tripParticipantsDraft.push({ id: 'tp-' + generateId(), name: '' });
        renderTripParticipantsEditor();
        const inputs = document.querySelectorAll('.trip-participant-input');
        if (inputs.length) inputs[inputs.length - 1].focus();
    });

    document.getElementById('form-trip').addEventListener('submit', async (e) => {
        e.preventDefault();

        const participants = tripParticipantsDraft
            .map(p => ({ id: p.id, name: (p.name || '').trim() }))
            .filter(p => p.name);

        if (participants.length === 0) {
            alert('Ajoutez au moins un participant.');
            return;
        }

        const start = document.getElementById('trip-start').value;
        const end = document.getElementById('trip-end').value;
        if (start && end && end < start) {
            alert('La date de retour doit être postérieure à la date de départ.');
            return;
        }

        const id = document.getElementById('trip-id').value;
        const payload = {
            name: document.getElementById('trip-name').value.trim(),
            destination: document.getElementById('trip-destination').value.trim(),
            budget: parseFloat(document.getElementById('trip-budget').value) || 0,
            startDate: start,
            endDate: end,
            participants
        };

        if (id) {
            const trip = getTrips().find(t => t.id === id);
            if (trip) Object.assign(trip, payload);
        } else {
            const trip = { id: 'trip-' + generateId(), ...payload, expenses: [] };
            getTrips().push(trip);
            window.currentTripId = trip.id;
            try { localStorage.setItem(TRIP_STORAGE_CURRENT, trip.id); } catch (err) { /* ignore */ }
        }

        await saveData();
        closeTripModal();
        renderTrips();
        renderTripsCompare();
    });

    // Dépenses
    ['btn-add-trip-expense', 'btn-add-trip-expense-2'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.addEventListener('click', () => window.openTripExpenseModal());
    });

    document.getElementById('btn-close-trip-expense-modal').addEventListener('click', closeTripExpenseModal);
    document.getElementById('btn-cancel-trip-expense-modal').addEventListener('click', closeTripExpenseModal);

    document.querySelectorAll('.trip-share-toggle .seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const trip = getCurrentTrip();
            if (!trip) return;
            const isShared = btn.dataset.share === 'shared';
            const current = getSelectedShareIds();
            setTripShareMode(isShared, trip, current.length ? current : trip.participants.map(p => p.id));
        });
    });

    document.getElementById('trip-expense-amount').addEventListener('input', () => {
        const trip = getCurrentTrip();
        if (trip) updateTripShareHint(trip);
    });

    // Nouvelle catégorie à la volée
    document.getElementById('trip-expense-category').addEventListener('change', async (e) => {
        if (e.target.value !== '__new__') return;

        const name = (prompt('Nom de la nouvelle catégorie :') || '').trim();
        if (!name) {
            renderTripExpenseCategoryOptions(getTripCategories()[0].name);
            return;
        }
        if (!getTripCategory(name)) {
            const icon = (prompt('Emoji pour cette catégorie (optionnel) :', '💠') || '💠').trim() || '💠';
            getTripCategories().push({ id: 'tc-' + generateId(), name, icon });
            await saveData();
        }
        renderTripExpenseCategoryOptions(name);
    });

    document.getElementById('form-trip-expense').addEventListener('submit', async (e) => {
        e.preventDefault();

        const trip = getCurrentTrip();
        if (!trip) return;

        const isShared = document.querySelector('.trip-share-toggle .seg-btn.active').dataset.share === 'shared';
        const sharedWith = isShared ? getSelectedShareIds() : [];

        if (isShared && sharedWith.length === 0) {
            alert('Sélectionnez au moins une personne concernée par cette dépense partagée.');
            return;
        }

        const category = document.getElementById('trip-expense-category').value;
        if (category === '__new__') {
            alert('Choisissez une catégorie.');
            return;
        }

        const payload = {
            date: document.getElementById('trip-expense-date').value,
            label: document.getElementById('trip-expense-label').value.trim(),
            category,
            amount: parseFloat(document.getElementById('trip-expense-amount').value) || 0,
            paidBy: document.getElementById('trip-expense-payer').value,
            shared: isShared,
            sharedWith
        };

        const id = document.getElementById('trip-expense-id').value;
        if (!Array.isArray(trip.expenses)) trip.expenses = [];

        if (id) {
            const exp = trip.expenses.find(x => x.id === id);
            if (exp) Object.assign(exp, payload);
        } else {
            trip.expenses.push({ id: 'te-' + generateId(), ...payload });
        }

        await saveData();
        closeTripExpenseModal();
        renderTrips();
    });

    // Récapitulatif : bascule totaux seuls / détail du partage
    try {
        tripMatrixDetailed = localStorage.getItem(TRIP_STORAGE_MATRIX) === '1';
    } catch (e) { /* stockage indisponible */ }

    const btnMatrix = document.getElementById('btn-toggle-trip-matrix');
    if (btnMatrix) {
        syncTripMatrixToggle();
        btnMatrix.addEventListener('click', () => {
            tripMatrixDetailed = !tripMatrixDetailed;
            try { localStorage.setItem(TRIP_STORAGE_MATRIX, tripMatrixDetailed ? '1' : '0'); } catch (e) { /* ignore */ }
            syncTripMatrixToggle();
            const trip = getCurrentTrip();
            if (trip) {
                const stats = computeTripStats(trip);
                renderTripMatrix(trip, stats);
                renderTripSettlement(trip, stats);
                // Les canvas masqués ne se dessinent pas : on redessine à l'affichage.
                if (tripMatrixDetailed) renderTripCharts(trip, stats);
            }
        });
    }

    // Filtres du journal
    const search = document.getElementById('trip-expense-search');
    if (search) {
        search.addEventListener('input', (e) => {
            tripExpenseFilters.search = e.target.value;
            const trip = getCurrentTrip();
            if (trip) renderTripExpenseList(trip);
        });
    }
    document.getElementById('trip-expense-filter-category').addEventListener('change', (e) => {
        tripExpenseFilters.category = e.target.value;
        const trip = getCurrentTrip();
        if (trip) { renderTripExpenseFilters(trip); renderTripExpenseList(trip); }
    });
    document.getElementById('trip-expense-filter-payer').addEventListener('change', (e) => {
        tripExpenseFilters.payer = e.target.value;
        const trip = getCurrentTrip();
        if (trip) { renderTripExpenseFilters(trip); renderTripExpenseList(trip); }
    });

    // Fermeture des modales au clic sur le fond
    ['trip-modal-overlay', 'trip-expense-modal-overlay'].forEach(id => {
        const overlay = document.getElementById(id);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    // Redessine les graphiques à l'affichage de l'onglet (canvas masqué = largeur nulle)
    document.addEventListener('viewChanged', (e) => {
        if (e.detail === 'trips') renderTrips();
        else if (e.detail === 'trips-compare') renderTripsCompare();
    });

    window.addEventListener('resize', () => {
        const tripsSection = document.getElementById('trips');
        const compareSection = document.getElementById('trips-compare');
        clearTimeout(window._tripResizeTimer);
        window._tripResizeTimer = setTimeout(() => {
            if (tripsSection && tripsSection.classList.contains('active')) {
                const trip = getCurrentTrip();
                if (trip) renderTripCharts(trip, computeTripStats(trip));
            } else if (compareSection && compareSection.classList.contains('active')) {
                renderTripsCompare();
            }
        }, 200);
    });
}

initTripsModule();
