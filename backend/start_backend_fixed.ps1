# Set explicit PYTHONHOME
$env:PYTHONHOME = "C:\Users\How\AppData\Local\Programs\Python\Python312"
$env:PYTHONPATH = ""

$pythonPath = "C:\Users\How\AppData\Local\Programs\Python\Python312\python.exe"
$backendDir = "c:\Users\How\OneDrive\Documents\TradeTrack-Pro\backend"

Set-Location $backendDir

Write-Host "Cleaning up old venv..."
if (Test-Path venv) {
    Remove-Item -Recurse -Force venv
}

Write-Host "Creating new venv using $pythonPath..."
& $pythonPath -m venv venv

if ($LASTEXITCODE -ne 0) {
    Write-Host "Venv creation failed with code $LASTEXITCODE"
    exit 1
}

Write-Host "Activating venv..."
.\venv\Scripts\activate

Write-Host "Installing dependencies..."
pip install --upgrade pip
if (Test-Path requirements.txt) {
    pip install -r requirements.txt
}
else {
    Write-Host "requirements.txt not found, installing manual deps..."
    pip install flask flask-cors python-dotenv pycryptodome requests shioaji
}

Write-Host "Starting Flask app..."
python app.py
