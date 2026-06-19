import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Current logic in showCategoryDetails
old_logic = """    // Determine if the categoryName is a main category or a subcategory
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
    }"""

new_logic = """    // Determine if the categoryName has any descendants
    let isMainCategory = false;
    const allPaths = appData.categories.map(c => getCategoryPath(c.id));
    if (allPaths.some(p => p.startsWith(categoryName + ' > '))) {
        isMainCategory = true;
    }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched isMainCategory in showCategoryDetails")
else:
    print("Could not find the target block")
