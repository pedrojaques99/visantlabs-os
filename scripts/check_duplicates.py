
import json
import sys
from collections import Counter

def find_duplicate_keys(json_file):
    print(f"Checking {json_file}...")
    with open(json_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Custom decoder to find duplicates
    def parse_object(pairs):
        keys = [k for k, v in pairs]
        counts = Counter(keys)
        duplicates = [k for k, v in counts.items() if v > 1]
        if duplicates:
            print(f"File: {json_file}")
            print(f"Found duplicate keys in an object: {duplicates}")
        return dict(pairs)

    try:
        json.loads(content, object_pairs_hook=parse_object)
    except Exception as e:
        print(f"Error parsing {json_file}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_duplicates.py <json_file> [json_file2 ...]")
        sys.exit(1)
    
    for arg in sys.argv[1:]:
        find_duplicate_keys(arg)
