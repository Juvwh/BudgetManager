import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add the new filters container right below the modal header and total
# Currently we have:
# <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem; margin-bottom: 1rem;">
# ...
# </div>
# <div style="text-align: left; margin-bottom: 1rem;">
#     <h3 style="margin: 0; color: var(--text-color);">Total : <span id="data-modal-total" class="text-red">0.00 €</span></h3>
# </div>

filters_html = """
            <div id="data-modal-filters-container" style="display: none; background-color: var(--bg-color); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid var(--border-color); flex-wrap: wrap; gap: 1rem;">
                <div id="data-modal-cat-mode-group" style="display: flex; flex-direction: column; gap: 0.3rem;">
                    <label for="data-modal-cat-mode" style="font-weight: bold; font-size: 0.85rem; color: var(--text-color);">Mode d'inclusion :</label>
                    <select id="data-modal-cat-mode" style="padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--input-bg); color: var(--input-text);">
                        <option value="with_subcategories">Catégorie + sous-catégories</option>
                        <option value="category_only">Catégorie seule</option>
                    </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                    <label for="data-modal-period" style="font-weight: bold; font-size: 0.85rem; color: var(--text-color);">Période :</label>
                    <select id="data-modal-period" style="padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--input-bg); color: var(--input-text);">
                        <option value="inherited">Période du tableau de bord (Hérité)</option>
                        <option value="all_time">All time</option>
                        <option value="last_month">Last month</option>
                        <option value="last_year">Last year</option>
                        <option value="custom">Intervalle personnalisé</option>
                    </select>
                </div>
                <div id="data-modal-custom-dates" style="display: none; gap: 0.5rem; align-items: end;">
                    <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                        <label for="data-modal-date-start" style="font-size: 0.8rem; color: var(--text-color);">Du</label>
                        <input type="date" id="data-modal-date-start" style="padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--input-bg); color: var(--input-text);">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                        <label for="data-modal-date-end" style="font-size: 0.8rem; color: var(--text-color);">Au</label>
                        <input type="date" id="data-modal-date-end" style="padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--input-bg); color: var(--input-text);">
                    </div>
                </div>
            </div>
"""

search_str = """<div style="text-align: left; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: var(--text-color);">Total : <span id="data-modal-total" class="text-red">0.00 €</span></h3>
            </div>"""

replace_str = search_str + filters_html

if search_str in content:
    content = content.replace(search_str, replace_str)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully patched index.html")
else:
    print("Could not find insertion point in index.html")
