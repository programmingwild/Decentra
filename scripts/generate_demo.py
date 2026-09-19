import pandas as pd, numpy as np, pathlib
np.random.seed(42)
dates = pd.date_range('2023-01-01', '2024-12-01', freq='MS')
regions = ['North', 'South', 'East', 'West']
products = ['Alpha', 'Beta', 'Gamma']
rows=[]
for d in dates:
    for r in regions:
        for p in products:
            base = 90000 + (d.year-2023)*12000 + (d.month*800)
            noise = np.random.normal(0, 7000)
            if d >= pd.Timestamp('2024-07-01') and r=='North' and p=='Alpha':
                base *= 0.72
            if d == pd.Timestamp('2024-03-01') and r=='West':
                base *= 1.58
            val = max(0, base + noise)
            rows.append({'date': d.date(), 'region': r, 'product': p, 'revenue': round(val,2), 'churn': round(np.random.uniform(2,8),2), 'customers': np.random.randint(800,1500)})
df = pd.DataFrame(rows)
df.loc[np.random.choice(df.index, 15), 'churn'] = np.nan
path = pathlib.Path('samples/sales_demo.csv')
path.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(path, index=False)
print(f'wrote {len(df)} rows to {path}')
print(df.head().to_string())
print(df.describe().to_string())
