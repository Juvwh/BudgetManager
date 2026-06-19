import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """        } else if (periodMode === 'last_month') {
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
            return t.date && t.date.startsWith(`${lastYear}-`);"""

new_logic = """        } else if (periodMode === 'last_month') {
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

            return t.date && t.date >= pastStr && t.date <= nowStr;"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched logic in renderCategoryModal")
else:
    print("Could not find the target block")
