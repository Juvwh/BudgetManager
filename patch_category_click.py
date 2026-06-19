import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_el_str = """            el.innerHTML = `
                <div>
                    <span class="drag-handle">☰</span>
                    <strong>${cat.name}</strong> ${!parentId ? badge : ''}
                </div>
                <button class="btn btn-danger btn-small" onclick="deleteCategory('${cat.id}')">Supprimer</button>
            `;"""

new_el_str = """            const fullPath = getCategoryPath(cat.id);
            el.innerHTML = `
                <div style="cursor: pointer; flex-grow: 1;" onclick="showCategoryDetails('${fullPath}', 0)">
                    <span class="drag-handle" style="cursor: grab;" onclick="event.stopPropagation()">☰</span>
                    <strong style="color: var(--primary-color);">${cat.name}</strong> ${!parentId ? badge : ''}
                </div>
                <button class="btn btn-danger btn-small" onclick="deleteCategory('${cat.id}')">Supprimer</button>
            `;"""

if old_el_str in content:
    content = content.replace(old_el_str, new_el_str)
    print("Patched category tree")
else:
    print("Could not find insertion point in renderCategoryTree")

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(content)
