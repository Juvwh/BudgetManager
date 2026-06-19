import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

render_func = """
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

    // Filter transactions
    const trans = appData.transactions.filter(t => {
        if (t.type !== 'expense') return false;

        const catPath = getCategoryPath(t.categoryId);
        const topCatName = catPath.split(' > ')[0];

        let isMatch = false;
        if (isMainCategory) {
            if (catMode === 'with_subcategories') {
                isMatch = (topCatName === categoryName);
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
            let year = now.getFullYear();
            let month = now.getMonth(); // 0-indexed, so getMonth() is naturally the previous month
            if (month === 0) {
                month = 12;
                year -= 1;
            }
            const prefix = `${year}-${String(month).padStart(2, '0')}`;
            return t.date && t.date.startsWith(prefix);
        } else if (periodMode === 'last_year') {
            const now = new Date();
            const lastYear = now.getFullYear() - 1;
            return t.date && t.date.startsWith(`${lastYear}-`);
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
    totalSpan.textContent = '-' + totalAmount.toFixed(2) + ' €';
    totalSpan.className = 'text-red';

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
"""

insert_idx = content.find("function showMonthDetails")
if insert_idx != -1:
    content = content[:insert_idx] + render_func + "\n\n" + content[insert_idx:]
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injected renderCategoryModal")
else:
    print("Could not find showMonthDetails")
