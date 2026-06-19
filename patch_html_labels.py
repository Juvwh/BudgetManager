import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_last_month = '<option value="last_month">Last month</option>'
new_last_month = '<option value="last_month">30 derniers jours</option>'

old_last_year = '<option value="last_year">Last year</option>'
new_last_year = '<option value="last_year">365 derniers jours</option>'

content = content.replace(old_last_month, new_last_month)
content = content.replace(old_last_year, new_last_year)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Labels updated in index.html")
