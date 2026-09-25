from pathlib import Path
import sys

SERVER_ROOT = Path(__file__).resolve().parents[1]
server_path = str(SERVER_ROOT)
if server_path not in sys.path:
    sys.path.insert(0, server_path)
