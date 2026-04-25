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
    mealVouchersEnabled: false,
    mealVoucherEligibleCategories: [],
    mealVoucherExpectedMonthlyAmount: 0,
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
    const tbody = document.querySelector('#table-transactions tbody');
    const tableHeaderCheckboxCol = document.querySelector('#table-transactions thead th.col-checkbox');
    tbody.innerHTML = '';

    if (tableHeaderCheckboxCol) {
        tableHeaderCheckboxCol.style.display = isTransactionSelectionMode ? 'table-cell' : 'none';
    }

    let filterMonth = document.getElementById('filter-month').value;

    let filteredTrans = appData.transactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filterMonth) {
        filteredTrans = filteredTrans.filter(t => t.date.startsWith(filterMonth));
    }

    if (currentTransactionFilter === 'income') {
        filteredTrans = filteredTrans.filter(t => t.type === 'income');
    } else if (currentTransactionFilter === 'expense') {
        filteredTrans = filteredTrans.filter(t => t.type === 'expense');
    } else if (currentTransactionFilter === 'salary') {
        filteredTrans = filteredTrans.filter(t => t.type === 'salary');
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

        const isCorrupted = isNaN(t.amount) || t.amount === null || t.amount === undefined || !t.date;
        if (isCorrupted) {
            tr.style.backgroundColor = 'rgba(255, 59, 48, 0.1)';
            tr.style.borderLeft = '4px solid var(--danger-color)';
        }

        tr.ondblclick = () => editTransaction(t.id); // Option C: Quick edit on double click

        const catName = getCategoryPath(t.categoryId, new Set(), true);

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

        let formattedAmount = '';
        if (isCorrupted) {
            formattedAmount = 'Erreur (NaN)';
        } else if (t.type === 'expense') {
            formattedAmount = `-${Number(t.amount).toFixed(2)} €`;
        } else {
            formattedAmount = `+${Number(t.amount).toFixed(2)} €`;
        }

        let displayType = '';
        let typeColor = '';
        if (t.type === 'income') {
            displayType = 'Revenu';
            typeColor = 'text-green';
        } else if (t.type === 'salary') {
            displayType = 'Salaire';
            typeColor = 'text-primary'; // Using primary color for salary
            if (t.savedAmount) {
                formattedAmount += ` <br><small style="color:var(--text-color);">(Épargné: ${Number(t.savedAmount).toFixed(2)} €)</small>`;
            }
        } else {
            displayType = 'Dépense';
            typeColor = 'text-red';
            if (t.mealVoucherPart > 0) {
                formattedAmount = `-${Number(t.amount).toFixed(2)} € <br><small style="color:var(--accent-color);">dont ${Number(t.mealVoucherPart).toFixed(2)} € (CR)</small><br><small style="color:var(--text-color);">Reste (Argent): -${Number(t.amount - t.mealVoucherPart).toFixed(2)} €</small>`;
            }
        }

        let checkboxHtml = '';
        if (isTransactionSelectionMode) {
            const isChecked = selectedTransactionIds.has(t.id) ? 'checked' : '';
            checkboxHtml = `<td class="col-checkbox" style="width: 40px; text-align: center;"><input type="checkbox" class="transaction-checkbox" data-id="${t.id}" ${isChecked} style="cursor: pointer; transform: scale(1.2);"></td>`;
        }

        let tagsCellHtml = tagsHtml ? `<div style="display: flex; gap: 4px; flex-wrap: wrap;">${tagsHtml}</div>` : '';

        tr.innerHTML = `
            ${checkboxHtml}
            <td data-label="Date">${t.date || 'Erreur'}</td>
            <td data-label="Type"><span class="${typeColor}">${displayType}</span></td>
            <td data-label="Catégorie">${catName} ${isCorrupted ? '<span class="cat-type-badge badge-expense" style="margin-left: 5px;">Corrompu</span>' : ''}</td>
            <td data-label="Note">${t.note || ''}</td>
            <td data-label="Tags">${tagsCellHtml}</td>
            <td data-label="Montant" class="${t.type === 'expense' ? 'text-red' : 'text-green'}">${formattedAmount}</td>
            <td data-label="Actions">
                <button class="btn btn-secondary btn-small icon-btn-mobile" title="Modifier" onclick="editTransaction('${t.id}')"><span class="btn-text">Modifier</span><svg class="mobile-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                <button class="btn btn-danger btn-small icon-btn-mobile" title="Supprimer" onclick="deleteTransaction('${t.id}')"><span class="btn-text">Supprimer</span><svg class="mobile-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
            </td>
        `;
        tbody.appendChild(tr);

        if (isTransactionSelectionMode) {
            const checkbox = tr.querySelector('.transaction-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedTransactionIds.add(t.id);
                    } else {
                        selectedTransactionIds.delete(t.id);
                    }
                    updateTransactionSelectionTotal();
                });
            }
        }
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

    // Gérer les tags
    document.getElementById('trans-selected-tags').value = JSON.stringify(trans.tagIds || []);
    renderTransactionTagsSelector();

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
    const tbody = document.querySelector('#table-subscriptions tbody');
    tbody.innerHTML = '';

    // Sort to put completed ones at the end
    const sortedSubs = [...appData.subscriptions].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return 0;
    });

    sortedSubs.forEach(sub => {
        const tr = document.createElement('tr');
        const isCorrupted = isNaN(sub.amount) || sub.amount === null || sub.amount === undefined || !sub.startDate;
        const isCompleted = sub.status === 'completed';

        let freqText = '';
        if (sub.frequency === 'monthly' && sub.startDate) {
            const day = parseInt(sub.startDate.split('-')[2], 10);
            freqText = `Tous les ${day} du mois`;
        } else {
            const freqMap = { 'weekly': 'Hebdomadaire', 'monthly': 'Tous les X du mois', 'yearly': 'Annuelle', 'installments': 'En plusieurs fois' };
            freqText = freqMap[sub.frequency] || sub.frequency;
        }

        if (isCorrupted) {
            tr.style.backgroundColor = 'rgba(255, 59, 48, 0.1)';
            tr.style.borderLeft = '4px solid var(--danger-color)';
        } else if (isCompleted) {
            tr.style.opacity = '0.6';
            tr.style.backgroundColor = 'var(--secondary-color)';
        }

        const formattedAmount = isCorrupted ? 'Erreur (NaN)' : `${Number(sub.amount).toFixed(2)} €`;
        let displayName = sub.name || 'Sans Nom';

        if (isCompleted) {
            displayName += ' <span class="cat-type-badge" style="background-color: var(--text-color); margin-left: 5px;">Terminé</span>';
        }
        if (isCorrupted) {
            displayName += ' <span class="cat-type-badge badge-expense" style="margin-left: 5px;">Corrompu</span>';
        }

        tr.innerHTML = `
            <td data-label="Nom">${displayName}</td>
            <td data-label="Type"><span class="${sub.type === 'income' ? 'text-green' : 'text-red'}">${sub.type === 'income' ? 'Revenu' : 'Dépense'}</span></td>
            <td data-label="Fréquence">${freqText || 'Inconnue'}</td>
            <td data-label="Montant" class="${sub.type === 'income' ? 'text-green' : 'text-red'}">${formattedAmount}</td>
            <td data-label="Prochaine date">${isCompleted ? '-' : (sub.nextDate || sub.startDate || 'Erreur')}</td>
            <td data-label="Date de fin">${sub.endDate || (sub.frequency === 'installments' && isCompleted ? 'Terminé' : '-')}</td>
            <td data-label="Actions">
                ${sub.frequency === 'installments' && !isCompleted ? `<button class="btn btn-small icon-btn-mobile" title="Avancer" style="background-color: var(--accent-color); color: white;" onclick="advanceSubscription('${sub.id}')"><span class="btn-text">Avancer</span><svg class="mobile-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5l7 7-7 7"/><path d="M4 5l7 7-7 7"/></svg></button>` : ''}
                <button class="btn btn-primary btn-small icon-btn-mobile" title="Historique" onclick="viewSubscriptionHistory('${sub.id}')"><span class="btn-text">Historique</span><svg class="mobile-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></button>
                <button class="btn btn-secondary btn-small icon-btn-mobile" title="Modifier" onclick="editSubscription('${sub.id}')"><span class="btn-text">Modifier</span><svg class="mobile-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                <button class="btn btn-danger btn-small icon-btn-mobile" title="Supprimer" onclick="deleteSubscription('${sub.id}')"><span class="btn-text">Supprimer</span><svg class="mobile-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
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
    const trans = appData.transactions.filter(t => t.date.startsWith(prefix));

    let income = 0;
    let expense = 0;
    let savings = 0;
    let categoryExpenses = {};

    trans.forEach(t => {
        if (t.type === 'income') {
            income += t.amount;
        } else if (t.type === 'salary') {
            const saved = t.savedAmount || 0;
            savings += saved;
            income += (t.amount - saved); // Only non-saved part goes to income
        } else {
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

    return { income, expense, savings, balance: income - expense, categoryExpenses };
}

function getSpecificMonthsCategoryData(monthPrefixes) {
    // Filter transactions by these prefixes
    const trans = appData.transactions.filter(t =>
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
        let isSelected = isCategorySelectionMode && selectedCategories.has(label);

        ctx.fillStyle = barColor;
        if (isCategorySelectionMode && !isSelected) {
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--border-color').trim() || '#e2e8f0';
            ctx.globalAlpha = 0.5;
        }

        ctx.beginPath();
        ctx.roundRect(labelWidth, y, currentBarWidth, barHeight, [0, 4, 4, 0]);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        if (isSelected) {
            ctx.strokeStyle = textColor;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

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

        // Calculate Meal Voucher Coverage Rate
        let mvCoverageHtml = '';
        if (appData.mealVouchersEnabled) {
            let totalEligibleFoodSpent = 0;
            let totalMvSpentInMonth = 0;

            const transInMonth = appData.transactions.filter(t => t.date && t.date.startsWith(monthStr));
            transInMonth.forEach(t => {
                if (t.type === 'expense' && appData.mealVoucherEligibleCategories && appData.mealVoucherEligibleCategories.includes(t.categoryId)) {
                    totalEligibleFoodSpent += t.amount;
                    if (t.mealVoucherPart > 0) {
                        totalMvSpentInMonth += t.mealVoucherPart;
                    }
                }
            });

            let mvRate = 0;
            if (totalEligibleFoodSpent > 0) {
                mvRate = (totalMvSpentInMonth / totalEligibleFoodSpent) * 100;
            }
            mvCoverageHtml = `<td data-label="Taux couv. alimentaire">${mvRate.toFixed(1)}%</td>`;
        }


        tr.innerHTML = `
            <td data-label="Mois">${formattedMonth}</td>
            <td data-label="Revenus réels" class="${incomeColor}">${incomeSign}${data.income.toFixed(2)} €</td>
            <td data-label="Objectif">${goal.toFixed(2)} €</td>
            <td data-label="Dépenses réelles" class="text-red">-${data.expense.toFixed(2)} €</td>
            <td data-label="Économie (Bilan)" class="${savingsClass}">${savingsSign}${savingsForMonth.toFixed(2)} €</td>
            <td data-label="Épargne du mois" class="text-primary">${data.savings > 0 ? '+' : ''}${data.savings.toFixed(2)} €</td>
            <td data-label="Bénéfice Réel" class="${realProfitClass}" style="font-weight: bold;">${realProfitSign}${realProfit.toFixed(2)} €</td>
            ${mvCoverageHtml}
        `;
        tbody.appendChild(tr);
    });

    if (sortedMonths.length === 0) {
        const colSpan = appData.mealVouchersEnabled ? 8 : 7;
        tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center;">Aucune donnée disponible.</td></tr>`;
    }

    // Meal Vouchers Columns toggles
    const mvColHeaders = document.querySelectorAll('.col-mv-rate');
    mvColHeaders.forEach(th => {
        th.style.display = appData.mealVouchersEnabled ? 'table-cell' : 'none';
    });

    const mvValContainer = document.getElementById('savings-view-mv-container');
    if (appData.mealVouchersEnabled) {
        mvValContainer.style.display = 'block';
        const mvData = calculateMealVoucherData();
        document.getElementById('savings-view-mv-val').textContent = '+' + mvData.spentLast12m.toFixed(2) + ' €';
    } else {
        mvValContainer.style.display = 'none';
    }

    // Update Real Profit view (Cumul Total)
    const totalRealProfitElement = document.getElementById('savings-view-total');
    if (totalRealProfit >= 0) {
        totalRealProfitElement.textContent = `+${totalRealProfit.toFixed(2)} €`;
        totalRealProfitElement.className = 'text-green';
    } else {
        totalRealProfitElement.textContent = `${totalRealProfit.toFixed(2)} €`;
        totalRealProfitElement.className = 'text-red';
    }

    // Update Real Profit view (Ce mois-ci)
    const currentMonthRealProfitElement = document.getElementById('savings-view-current-month');
    if (currentMonthRealProfitElement) {
        if (currentMonthRealProfit >= 0) {
            currentMonthRealProfitElement.textContent = `+${currentMonthRealProfit.toFixed(2)} €`;
            currentMonthRealProfitElement.className = 'text-green';
        } else {
            currentMonthRealProfitElement.textContent = `${currentMonthRealProfit.toFixed(2)} €`;
            currentMonthRealProfitElement.className = 'text-red';
        }
    }

    // Update Real Saved view
    const totalRealSavedElement = document.getElementById('savings-view-real-saved');
    totalRealSavedElement.textContent = `+${totalRealSaved.toFixed(2)} €`;
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

    // Update current month summary cards
    const currentData = getMonthData(currentYear, currentMonth);
    document.getElementById('dash-income').textContent = '+' + currentData.income.toFixed(2) + ' €';
    document.getElementById('dash-expense').textContent = '-' + currentData.expense.toFixed(2) + ' €';

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

    // Event listeners to update on type change
    document.getElementById('trans-type').addEventListener('change', (e) => {
        populateTransSelect();
        const type = e.target.value;
        const savingsGroup = document.getElementById('trans-savings-group');
        const amountLabel = document.getElementById('trans-amount-label');
        if (type === 'salary') {
            savingsGroup.style.display = 'block';
            amountLabel.textContent = 'Montant Total du Salaire (€)';
        } else {
            savingsGroup.style.display = 'none';
            amountLabel.textContent = 'Montant (€)';
        }
        updateMvFormFields();
    });

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

    // Handle FAB display based on current view
    function updateFabVisibility(targetId) {
        const fab = document.getElementById('fab-add');
        if (targetId === 'transactions' || targetId === 'subscriptions') {
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
                    tagIds
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
                tagIds
            };
            appData.transactions.push(newTrans);
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
    const desktopLink = document.getElementById('nav-item-meal-vouchers');
    const mobileLink = document.getElementById('mobile-nav-meal-vouchers');

    // Toggle containers
    const chartToggleContainers = document.querySelectorAll('.mv-chart-toggle-container');

    if (desktopLink) desktopLink.style.display = mealVouchersEnabled ? 'list-item' : 'none';
    if (mobileLink) mobileLink.style.display = mealVouchersEnabled ? 'flex' : 'none';

    chartToggleContainers.forEach(c => {
        c.style.display = mealVouchersEnabled ? 'flex' : 'none';
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

        // 2. Sort all MV transactions chronologically
        const mvTransactions = appData.transactions
            .filter(t => t.mealVoucherPart > 0 && t.type === 'expense')
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
        mvTransactions.forEach(t => {
            if (new Date(t.date) >= twelveMonthsAgo) {
                spentLast12m += t.mealVoucherPart;
            }

            let amountToConsume = t.mealVoucherPart;
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

    drawLine(baselinePoints, '#888888', true); // Baseline
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
