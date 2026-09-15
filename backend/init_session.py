import json
import os
import sys
from pathlib import Path

def setup_session(base_dir='/app'):
    base_path = Path(base_dir)
    profile_dir = base_path / 'linkedin_profile'
    profile_dir.mkdir(parents=True, exist_ok=True)
    (profile_dir / 'Default').mkdir(exist_ok=True)
    pref_file = profile_dir / 'Default' / 'Preferences'
    if not pref_file.exists():
        pref_file.write_text('{}')

    cookie_val = os.environ.get('LI_AT') or os.environ.get('LINKEDIN_COOKIE') or os.environ.get('LINKEDIN_SESSION_COOKIE')
    if not cookie_val:
        env_path = base_path.parent / '.env'
        if not env_path.exists():
            env_path = Path('.env')
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith('LI_AT=') or line.startswith('LINKEDIN_COOKIE='):
                    cookie_val = line.split('=', 1)[1].strip()
                    if cookie_val:
                        break
    if not cookie_val:
        print('No cookie found in environment or .env')
        return False

    cookies = [
      {
        "name": "li_at",
        "value": cookie_val,
        "domain": ".linkedin.com",
        "path": "/",
        "expires": 1893456000,
        "httpOnly": True,
        "secure": True,
        "sameSite": "None"
      },
      {
        "name": "JSESSIONID",
        "value": "\"ajax:9051952608493021940\"",
        "domain": ".linkedin.com",
        "path": "/",
        "expires": 1893456000,
        "httpOnly": False,
        "secure": True,
        "sameSite": "None"
      },
      {
        "name": "bcookie",
        "value": "\"v=2&59439fde-5872-4cf0-9ec8-8bf3c5b5ee2e\"",
        "domain": ".linkedin.com",
        "path": "/",
        "expires": 1893456000,
        "httpOnly": False,
        "secure": True,
        "sameSite": "None"
      },
      {
        "name": "bscookie",
        "value": "\"v=1&20260913214500000000000000000000\"",
        "domain": ".linkedin.com",
        "path": "/",
        "expires": 1893456000,
        "httpOnly": False,
        "secure": True,
        "sameSite": "None"
      },
      {
        "name": "lidc",
        "value": "\"b=TB97:s=T:r=T:a=T:p=T:g=3051:u=1:x=1:i=1726263902:t=1726350302:v=2:sig=AQG\"",
        "domain": ".linkedin.com",
        "path": "/",
        "expires": 1893456000,
        "httpOnly": False,
        "secure": True,
        "sameSite": "None"
      }
    ]

    cookies_file = base_path / 'cookies.json'
    cookies_file.write_text(json.dumps(cookies, indent=2))

    source_state = {
      "version": 1,
      "source_runtime_id": "windows-amd64-host",
      "login_generation": "15f6a287-5650-4f53-a50b-3cd6308cd3aa",
      "created_at": "2026-09-13T22:00:00Z",
      "profile_path": str(profile_dir.resolve()),
      "cookies_path": str(cookies_file.resolve())
    }
    state_file = base_path / 'source-state.json'
    state_file.write_text(json.dumps(source_state, indent=2))
    print(f"Session seeded at {base_dir}")
    return True

if __name__ == '__main__':
    base_dir = sys.argv[1] if len(sys.argv) > 1 else '/app'
    setup_session(base_dir)
