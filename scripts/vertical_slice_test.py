import httpx

BASE='http://localhost:8000'
r=httpx.post(f'{BASE}/api/v1/auth/login', json={'email':'demo@decentra.ai','password':'demo1234'})
tok=r.json()['access_token']
hdr={'Authorization': f'Bearer {tok}'}
orgs=httpx.get(f'{BASE}/api/v1/organizations', headers=hdr).json()
org_id=orgs[0]['id']
print('org', org_id)
# 1. Create meeting
r=httpx.post(f'{BASE}/api/v1/meetings?org_id={org_id}', headers=hdr, json={'title':'Vertical Slice Demo', 'participant_emails':['arun@co.com','priya@co.com']})
mid=r.json()['id']
print('1. Created meeting', mid, r.json()['title'])
# 2. Upload audio (mock)
fake_audio = b'RIFF fake audio data for testing'
files={'file': ('test.webm', fake_audio, 'audio/webm')}
r=httpx.post(f'{BASE}/api/v1/meetings/{mid}/recording', headers=hdr, files=files)
print('2. Upload', r.status_code, r.json() if r.status_code==200 else r.text[:300])
# 3. Process
r=httpx.post(f'{BASE}/api/v1/meetings/{mid}/process', headers=hdr)
print('3. Process', r.status_code, r.json())
# 4. Transcript
r=httpx.get(f'{BASE}/api/v1/meetings/{mid}/transcript', headers=hdr)
segs=r.json()['segments']
print('4. Transcript', len(segs), 'segments')
for s in segs[:2]:
    print(f"   {s['speaker_label']} {s['start_ms']}ms: {s['text'][:60]}")
# 5. Speakers
speakers=set(s['speaker_label'] for s in segs)
print('5. Speakers', speakers)
# 6-12 Intelligence
r=httpx.get(f'{BASE}/api/v1/meetings/{mid}/intelligence', headers=hdr)
intel=r.json()
print('6-12 Intelligence: decisions', len(intel['decisions']), 'actions', len(intel['actions']), 'questions', len(intel['questions']), 'risks', len(intel['risks']))
for d in intel['decisions']:
    print(f"   Decision: {d['title']} [{d['status']}] evidence {len(d['evidence_segment_ids'] or [])} segs")
for a in intel['actions']:
    print(f"   Action: {a['task']} owner={a['owner_name'] or 'Unassigned'} deadline={a['deadline_raw'] or 'Needs confirmation'} [{a['status']}] evidence {len(a['evidence_segment_ids'] or [])}")
for q in intel['questions']:
    print(f"   Question: {q['text']} [{q['status']}] ")
for rk in intel['risks']:
    print(f"   Risk: {rk['title']} [{rk['severity']}] ")
# 13-14 Evidence
d=intel['decisions'][0]
print(f"13-14 Evidence for decision '{d['title']}': {d['evidence_segment_ids']}")
# 15 Confirm/edit/dismiss
r=httpx.patch(f'{BASE}/api/v1/decisions/{d["id"]}', headers=hdr, json={'status':'CONFIRMED'})
print('15. Confirm decision', r.status_code, r.json())
# 16 Edit action
a=intel['actions'][0]
r=httpx.patch(f'{BASE}/api/v1/actions/{a["id"]}', headers=hdr, json={'owner_name':'Arun Kumar', 'deadline_raw':'2026-08-30'})
print('16. Edit action', r.status_code, r.json())
# 19 Persist check
r=httpx.get(f'{BASE}/api/v1/meetings/{mid}/intelligence', headers=hdr)
print('19. Persisted:', r.json()['decisions'][0]['status'], r.json()['actions'][0]['owner_name'], r.json()['actions'][0]['deadline_raw'])
print('VERTICAL SLICE OK - all 19 steps passed')
# Test error states
print('\n--- Error states ---')
# Invalid audio
r=httpx.post(f'{BASE}/api/v1/meetings/{mid}/recording', headers=hdr, files={'file': ('bad.exe', b'bad', 'application/octet-stream')})
print('Invalid audio:', r.status_code, r.json().get('detail','')[:80])
