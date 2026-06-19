import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify `showCategoryDetails` to properly fetch selected months and setup the modal filters
old_func = """function showCategoryDetails(categoryName, totalAmount) {
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
}"""

new_func = """function showCategoryDetails(categoryName, totalAmount) {
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

    // Determine if the categoryName is a main category or a subcategory
    let isMainCategory = true;
    if (categoryName.includes(' > ')) {
        isMainCategory = false;
    } else {
        // It could be a main category that has no subcategories in the string, but we also check
        // if there are any actual subcategories in the DB for this main category to be thorough.
        const mainCatObj = appData.categories.find(c => c.name === categoryName && c.parentId === null);
        if (!mainCatObj) {
            // If we didn't find a main category with this exact name, it might be a subcategory
            // that we are rendering in detail level, but mostly we rely on the path string.
            // Also, some subcategories might not have a parent name in the label if we split it earlier.
            isMainCategory = false;
        }
    }

    // Setup global state for the modal to use
    window.currentModalCategory = categoryName;
    window.currentModalPrefixes = filterPrefixes;
    window.currentModalIsMainCategory = isMainCategory;

    // Reset filters to default state
    document.getElementById('data-modal-period').value = 'inherited';
    document.getElementById('data-modal-cat-mode').value = 'with_subcategories';

    // Call render to build the modal contents
    renderCategoryModal();

    // Show the modal
    document.getElementById('data-modal-overlay').classList.add('active');
}"""

content = content.replace(old_func, new_func)

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
