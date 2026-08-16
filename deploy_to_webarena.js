const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER_IP = '160.248.0.236';
const SSH_KEY = 'shokandon.pem';
const REMOTE_USER = 'ubuntu';

console.log('📦 Archiving files for WebArena deployment...');

// Create temporary deployment zip
const zipPath = path.join(__dirname, 'shokandon.zip');
if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
}

// PowerShell command to zip specific files/folders
const filesToZip = [
    'server.js',
    'process_with_line_notify.js',
    'process_soldout_g.js',
    'run_current_batch.js',
    'image_downloader.js',
    'package.json',
    'google_service_account.json',
    'config.json',
    'users_config.json',
    'custom_mpn_prices.json',
    'public'
].map(f => `"${f}"`).join(', ');

try {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path ${filesToZip} -DestinationPath shokandon.zip -Force"`, { cwd: __dirname });
    console.log('✅ Created shokandon.zip successfully.');
} catch (e) {
    console.error('❌ Failed to compress archive:', e.message);
    process.exit(1);
}

console.log('📤 Uploading shokandon.zip to WebArena VPS via SCP...');
try {
    execSync(`scp -o StrictHostKeyChecking=no -i ${SSH_KEY} shokandon.zip ${REMOTE_USER}@${SERVER_IP}:/home/ubuntu/`, { cwd: __dirname, stdio: 'inherit' });
    console.log('✅ Upload completed successfully.');
} catch (e) {
    console.error('❌ Upload failed:', e.message);
    process.exit(1);
}

console.log('📝 Creating remote setup script...');
const setupScriptContent = `#!/bin/bash
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
echo "Server is running on: http://${SERVER_IP}:3000"
echo "=========================================================="
`;

fs.writeFileSync(path.join(__dirname, 'setup_vps.sh'), setupScriptContent, 'utf8');

console.log('📤 Uploading setup_vps.sh to WebArena VPS...');
try {
    execSync(`scp -o StrictHostKeyChecking=no -i ${SSH_KEY} setup_vps.sh ${REMOTE_USER}@${SERVER_IP}:/home/ubuntu/`, { cwd: __dirname, stdio: 'inherit' });
    console.log('✅ Uploaded setup_vps.sh successfully.');
} catch (e) {
    console.error('❌ Failed to upload setup_vps.sh:', e.message);
    process.exit(1);
}

console.log('⚙️ Executing remote setup on VPS (this may take 1-2 minutes)...');
try {
    execSync(`ssh -o StrictHostKeyChecking=no -i ${SSH_KEY} ${REMOTE_USER}@${SERVER_IP} "chmod +x /home/ubuntu/setup_vps.sh && /home/ubuntu/setup_vps.sh"`, { cwd: __dirname, stdio: 'inherit' });
    console.log('🎉 WebArena server configuration is complete!');
} catch (e) {
    console.error('❌ Remote execution failed:', e.message);
    process.exit(1);
}
