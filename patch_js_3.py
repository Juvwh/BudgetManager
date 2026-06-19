import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

if "window.showCategoryDetails = showCategoryDetails;" not in content:
    content += "\nwindow.showCategoryDetails = showCategoryDetails;\n"
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added export")
else:
    print("Already exported")
