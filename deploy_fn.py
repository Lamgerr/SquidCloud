import json, os
base = '/data/data/com.termux/files/home/cloudbliss-storage/supabase/functions/cloudbliss-api'
files_list = []
for name in ['import_map.json', 'index.ts', 'utils.ts', 'handlers.ts']:
    with open(os.path.join(base, name), 'r') as f:
        files_list.append({"name": name, "content": f.read()})
with open('/data/data/com.termux/files/home/cloudbliss-storage/deploy_payload.json', 'w') as f:
    json.dump(files_list, f)
print(f"Payload: {os.path.getsize('/data/data/com.termux/files/home/cloudbliss-storage/deploy_payload.json')} bytes, files: {[x['name'] for x in files_list]}")
