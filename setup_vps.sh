#!/bin/bash
set -e

# Wait for unattended upgrades or background apt to finish
echo "=== Waiting for background system updates to finish (dpkg lock release) ==="
while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do
    echo "Other package manager is running. Waiting 5 seconds..."
    sleep 5
done
sudo dpkg --configure -a || true

echo "=== System Update ==="
sudo apt-get update -y


echo "=== Installing Zip/Unzip & Curl ==="
sudo apt-get install -y unzip curl wget

echo "=== Installing Node.js (v20) ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== Installing Google Chrome Stable (Non-Snap) ==="
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor --yes -o /usr/share/keyrings/googlechrome-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update -y
sudo apt-get install -y google-chrome-stable

echo "=== Installing PM2 globally ==="

sudo npm install -g pm2

echo "=== Preparing App Directory ==="
rm -rf /home/ubuntu/shokandon
mkdir -p /home/ubuntu/shokandon
unzip -o /home/ubuntu/shokandon.zip -d /home/ubuntu/shokandon/ || true

cd /home/ubuntu/shokandon


echo "=== Installing npm Packages ==="
npm install

echo "=== Starting Application with PM2 ==="
pm2 delete shokandon || true
pm2 start server.js --name "shokandon"

echo "=== Saving PM2 Process List ==="
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "=========================================================="
echo "✅ Deployment Completed Successfully!"
echo "Server is running on: http://160.248.0.236:3000"
echo "=========================================================="
