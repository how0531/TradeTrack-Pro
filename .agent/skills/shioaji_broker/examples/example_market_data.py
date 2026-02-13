import shioaji as sj
import time

def subscribe_quotes():
    api = sj.Shioaji()
    
    # Simulation login (replace with your credentials)
    api.login(
        person_id="YOUR_ID", 
        passwd="YOUR_PASSWORD"
    )
    
    # Define callback
    @api.on_quote
    def quote_callback(topic: str, quote: dict):
        print(f"Topic: {topic}")
        print(f"Quote: {quote}")
        
    # Subscribe to TSMC (2330)
    print("Subscribing to 2330...")
    contract = api.Contracts.Stocks["2330"]
    api.quote.subscribe(
        contract, 
        quote_type=sj.constant.QuoteType.Tick,
        version=sj.constant.QuoteVersion.v1
    )
    
    # Keep script running to receive callbacks
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping...")

if __name__ == "__main__":
    subscribe_quotes()
