#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/promptlab"
ARCHIVE_URL="https://codeload.github.com/denlosoff/promptlab/zip/refs/heads/main"
ARCHIVE_PATH="/opt/promptlab.zip"
TMP_DIR="/opt/promptlab-main"
SERVICE_NAME="promptlab"
APP_PORT="${APP_PORT:-3001}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-change-me-now}"

echo "Updating apt packages..."
apt update
apt install -y curl unzip git ufw

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
fi

echo "Downloading project archive..."
rm -rf "$APP_DIR" "$ARCHIVE_PATH" "$TMP_DIR"
cd /opt
curl -L "$ARCHIVE_URL" -o "$ARCHIVE_PATH"
unzip -q "$ARCHIVE_PATH"
mv "$TMP_DIR" "$APP_DIR"

cd "$APP_DIR"
echo "Installing npm dependencies..."
npm install

echo "Building frontend..."
npm run build

echo "Writing environment file..."
mkdir -p "$APP_DIR/data"
cat > "$APP_DIR/.env" <<EOF
ADMIN_PASSWORD=$ADMIN_PASSWORD
PORT=$APP_PORT
DATA_DIR=$APP_DIR/data
EOF

echo "Creating systemd service..."
cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Promptlab web app
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

echo "Enabling firewall and service..."
ufw allow OpenSSH || true
ufw allow 3001/tcp || true
ufw --force enable || true

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

echo
echo "Promptlab deployed."
echo "Check service: systemctl status ${SERVICE_NAME} --no-pager"
echo "Check logs: journalctl -u ${SERVICE_NAME} -n 100 --no-pager"
echo "Open site: http://$(curl -s ifconfig.me):${APP_PORT}"
