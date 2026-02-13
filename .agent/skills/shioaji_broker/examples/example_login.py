import shioaji as sj

def login_and_list_accounts():
    api = sj.Shioaji()
    
    # Replace with your actual credentials or load from env
    PERSON_ID = "YOUR_ID" 
    PASSWORD = "YOUR_PASSWORD"
    
    print("Logging in...")
    accounts = api.login(
        person_id=PERSON_ID, 
        passwd=PASSWORD
    )
    
    print("Login successful!")
    print("-" * 20)
    print("Stock Accounts:")
    for acc in api.list_accounts():
        print(acc)
        
    return api

if __name__ == "__main__":
    login_and_list_accounts()
