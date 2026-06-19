import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure openDataModal hides the filter container because this function is used by other modals like showMonthDetails
old_func = """function openDataModal(title, transactions, totalAmount, totalType = 'expense') {
    document.getElementById('data-modal-title').textContent = title;"""

new_func = """function openDataModal(title, transactions, totalAmount, totalType = 'expense') {
    const filtersContainer = document.getElementById('data-modal-filters-container');
    if (filtersContainer) {
        filtersContainer.style.display = 'none';
    }

    document.getElementById('data-modal-title').textContent = title;"""

if old_func in content:
    content = content.replace(old_func, new_func)
    print("Patched openDataModal")
else:
    print("Could not patch openDataModal")

# Event listeners inside initApp
listeners_str = """
    // Event listeners for category modal filters
    const catModeFilter = document.getElementById('data-modal-cat-mode');
    const periodFilter = document.getElementById('data-modal-period');
    const dateStartFilter = document.getElementById('data-modal-date-start');
    const dateEndFilter = document.getElementById('data-modal-date-end');

    if (catModeFilter) catModeFilter.addEventListener('change', () => { if (typeof renderCategoryModal === 'function') renderCategoryModal(); });
    if (periodFilter) periodFilter.addEventListener('change', () => { if (typeof renderCategoryModal === 'function') renderCategoryModal(); });
    if (dateStartFilter) dateStartFilter.addEventListener('change', () => { if (typeof renderCategoryModal === 'function') renderCategoryModal(); });
    if (dateEndFilter) dateEndFilter.addEventListener('change', () => { if (typeof renderCategoryModal === 'function') renderCategoryModal(); });
"""

# Insert just before the end of initApp
if "    renderDashboard();" in content:
    # Actually wait, let's just append to domcontentloaded block or something similar if initApp doesn't have it
    pass

init_block_search = "document.getElementById('btn-close-modal').addEventListener('click', closeDataModal);"
if init_block_search in content:
    content = content.replace(init_block_search, init_block_search + "\n" + listeners_str)
    print("Added event listeners")
else:
    print("Could not find insertion point for event listeners")

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(content)
