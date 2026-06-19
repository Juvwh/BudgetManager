import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Current logic in renderCategoryModal
old_logic = """        const catPath = getCategoryPath(t.categoryId);
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
        }"""

new_logic = """        const catPath = getCategoryPath(t.categoryId);

        let isMatch = false;
        if (isMainCategory) {
            if (catMode === 'with_subcategories') {
                isMatch = (catPath === categoryName || catPath.startsWith(categoryName + ' > '));
            } else {
                isMatch = (catPath === categoryName);
            }
        } else {
            isMatch = (catPath === categoryName);
        }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched filtering in renderCategoryModal")
else:
    print("Could not find the target block")
