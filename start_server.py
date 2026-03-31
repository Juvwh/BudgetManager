import subprocess
import time

print("Starting local server on port 8000...")
process = subprocess.Popen(["python3", "-m", "http.server", "8000"], cwd="/app")
time.sleep(2)
print("Server started!")
