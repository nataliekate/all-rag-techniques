import os
import time
import json
import schedule
from atlassian import Confluence
from rag_app import index_files  # Importing logic from rag_app.py

# --- CONFIG ---
URL = "https://your-domain.atlassian.net"
USER = "your-email@company.com"
TOKEN = "YOUR_ATLASSIAN_API_TOKEN"
SPACE = "DS" # Target Space Key
STATE_FILE = "confluence_state.json"
TEMP_DIR = "temp_confluence_docs"

os.makedirs(TEMP_DIR, exist_ok=True)
confluence = Confluence(url=URL, username=USER, password=TOKEN, cloud=True)

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r') as f: return json.load(f)
    return {}

def save_state(state):
    with open(STATE_FILE, 'w') as f: json.dump(state, f)

def sync_confluence():
    print("🔎 Checking Confluence for updates...")
    state = load_state()
    # Search for attachments in the space
    cql = f'space = "{SPACE}" AND type = "attachment"'
    results = confluence.cql(cql, limit=50)

    for item in results.get('results', []):
        att_id = item['content']['id']
        title = item['content']['title']
        version = item['content']['version']['number']

        # Check if new or updated
        if state.get(att_id, 0) < version:
            print(f"⬇️ Downloading: {title} (v{version})")

            # Download
            download_url = confluence.url + item['content']['_links']['download']
            file_path = os.path.join(TEMP_DIR, title)
            response = confluence.request('GET', download_url, advanced_mode=True)

            with open(file_path, 'wb') as f:
                f.write(response.content)

            # Index into specific 'confluence' store
            try:
                index_files([file_path], store_name="confluence")

                # Update State
                state[att_id] = version
                save_state(state)

                # Cleanup
                os.remove(file_path)
            except Exception as e:
                print(f"❌ Failed to index {title}: {e}")

if __name__ == "__main__":
    print("🚀 Confluence Sync Started")
    sync_confluence() # Run once immediately
    schedule.every(10).minutes.do(sync_confluence)

    while True:
        schedule.run_pending()
        time.sleep(1)