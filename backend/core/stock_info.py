import requests
import re

def fetch_stock_name(code: str) -> str | None:
    """
    Fetch stock name from TWSE ISIN website.
    Returns the name (e.g. "台積電") or None if not found/error.
    """
    url = f"https://isin.twse.com.tw/isin/single_main.jsp?owncode={code}&stockname="
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    try:
        # verifying SSL might be an issue in corporate envs, maybe disable if needed
        # But for security best practice, default to True. If it fails, we can add verify=False
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'big5' # TWSE uses Big5 usually
        
        if response.status_code != 200:
            return None

        # TWSE ISIN usually returns a table.
        # Structure often: <td bgcolor=#D5E2F6>2330</td><td bgcolor=#D5E2F6>台積電</td>
        # Or with attributes.
        
        # Pattern: >\s*<code>\s*</td>\s*<td[^>]*>\s*([^<]+)\s*</td>
        pattern = re.compile(f">\s*{code}\s*</td>\s*<td[^>]*>\s*([^<]+)\s*</td>", re.IGNORECASE | re.DOTALL)
        match = pattern.search(response.text)
        
        if match:
             name = match.group(1).strip()
             # Fix HTML entities if any (rare for simple names but good practice)
             name = name.replace("&nbsp;", " ")
             return name
            
        print(f"No match found for pattern: >{code}</td>... in response (len={len(response.text)})")
        return None

    except Exception as e:
        print(f"Error fetching stock name for {code}: {e}")
        return None
