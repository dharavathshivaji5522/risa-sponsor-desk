"""Read the supplied source exports and prepare stable application fixtures."""
from collections import Counter
from datetime import datetime
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json
import shutil
import sys

from openpyxl import load_workbook

source_path = Path(sys.argv[1])
paths = [source_path / 'provided1.xlsx', source_path / 'provided2.xlsx']
target = Path(__file__).resolve().parents[1] / 'data'

def normalize(value):
    if isinstance(value, datetime):
        return value.isoformat(timespec='seconds') + '+05:30'
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value

def read(path):
    workbook = load_workbook(path, data_only=True, read_only=True)
    tables = {}
    for sheet in workbook:
        all_rows = iter(sheet.values)
        headers = [key for key in next(all_rows) if key is not None]
        tables[sheet.title] = [
            dict(zip(headers, map(normalize, cells[:len(headers)]), strict=True))
            for cells in all_rows if any(cell is not None for cell in cells[:len(headers)])
        ]
    return tables

sponsor, attendee = [read(path) for path in paths]
checkins = attendee['Check-ins']
people = {person['person_id']:person['person_type'] for person in attendee['People']}
attendee_context = {
    'campaigns': [{k:v for k,v in c.items() if k in ('campaign_id','campaign_name','channel')} for c in attendee['Campaigns']],
    'checkins': [[row['event_id'], row['occurred_at'], row['person_id'], row['campaign_id'], row['result'], row['verification']]
                 for row in checkins if people.get(row['person_id']) == 'external']
}
links = {
    'sponsorship': 'https://docs.google.com/spreadsheets/d/1-4G9XdDr6KwHvLc0igBXoPlzuWwwbDOf/edit?gid=1267637537',
    'attendee': 'https://docs.google.com/spreadsheets/d/13EEsGkM7Aic97XfZ4-oBtw4dg1vIMVYh/edit?gid=1874562926',
    'city': 'https://bengaluru.stpi.in/en/about-stpi-bengaluru'
}
sources = {
    'links': links, 'sponsor': sponsor, 'attendee': attendee_context,
    'sheets': {'sponsor': {k:len(v) for k,v in sponsor.items()}, 'attendee': {k:len(v) for k,v in attendee.items()}},
    'sha256': {k:hashlib.sha256(p.read_bytes()).hexdigest() for k,p in zip(('sponsor','attendee'),paths,strict=True)}
}
target.mkdir(exist_ok=True)
(target/'history.json').write_text(json.dumps(sources, ensure_ascii=False, separators=(',',':'))+'\n')
shutil.copyfile(paths[0], target/'sponsorship-original.xlsx')
shutil.copyfile(paths[1], target/'attendee-original.xlsx')
print('rows', sources['sheets'])
for name,field in [('Sponsor interactions','event_type'),('Sponsor interactions','outcome'),('Brand qualification','qualification_status'),('Partner opportunities','support_type'),('Opportunity history','stage')]:
    print(name, field, Counter(r[field] for r in sponsor[name]))
print('historical targets',sponsor['Targets'])
print('campaigns',[[r['sponsor_campaign_id'],r['campaign_name']] for r in sponsor['Sponsor campaigns']])
print('attendee statuses',Counter((r['result'],r['verification']) for r in checkins))
def date_stop(r,key,d): return r[key][:10] <= d
def last(seq,key):
    out={}
    for r in sorted(seq,key=lambda r:(r['effective_at'],r['history_id'])):out[r[key]]=r
    return list(out.values())
for d in ('2025-03-15','2025-03-31','2025-04-11','2025-04-12','2025-04-20'):
    interaction={r['interaction_id']:r for r in sponsor['Sponsor interactions'] if date_stop(r,'occurred_at',d)}
    opp={r['opportunity_id']:r for r in sponsor['Partner opportunities'] if date_stop(r,'created_at',d)}
    versions=[r for r in sponsor['Opportunity history'] if r['opportunity_id'] in opp and date_stop(r,'effective_at',d)]
    confirmed=[r for r in last(versions,'opportunity_id') if r['stage']=='partner_confirmed']
    qual=last([r for r in sponsor['Brand qualification'] if date_stop(r,'effective_at',d)],'brand_id')
    print(d, 'brands',sum(date_stop(r,'created_at',d) for r in sponsor['Brands']),
          'interaction metrics',Counter(r['event_type'] for r in interaction.values()), 'qualified',Counter(r['qualification_status'] for r in qual),
          'opportunity status',Counter(r['stage'] for r in last(versions,'opportunity_id')),
          'confirmed value',sum(r['confirmed_value_inr'] for r in confirmed),
          'cash-only confirmed',sum(r['confirmed_value_inr'] for r in confirmed if opp[r['opportunity_id']]['support_type']=='cash'),
          'cash-only count',sum(opp[r['opportunity_id']]['support_type']=='cash' for r in confirmed))
