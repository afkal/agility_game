#!/usr/bin/env bash
# One-time setup of a Debian or Ubuntu VPS that already runs nginx and certbot.
# Run it on the VPS as root, from a copy of this deploy directory:
#
#   sudo bash setup-vps.sh <domain> <deploy-user>
#   e.g. sudo bash setup-vps.sh agility.example.org timo
#
# It installs Node 26 if needed, creates the service user and directories,
# writes /etc/agility-camp.env with a fresh test key, installs the systemd
# service, adds an nginx site with an HTTPS certificate, and lets the deploy
# user restart the service. Running it again is safe: it keeps the existing
# settings file and database.
set -euo pipefail

DOMAIN="${1:?Give the domain, e.g. agility.example.org}"
DEPLOY_USER="${2:?Give the SSH user that will deploy, e.g. timo}"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo bash $0 $*" >&2; exit 1; }
id "$DEPLOY_USER" > /dev/null

echo "== Node.js 26"
if ! command -v node > /dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 26 ]; then
  curl -fsSL https://deb.nodesource.com/setup_26.x | bash -
  apt-get install -y nodejs
fi
node --version

echo "== Service user and directories"
id agility > /dev/null 2>&1 || useradd --system --home /opt/agility-camp --shell /usr/sbin/nologin agility
mkdir -p /opt/agility-camp/app
chown -R "$DEPLOY_USER" /opt/agility-camp/app

echo "== Settings"
if [ ! -f /etc/agility-camp.env ]; then
  sed "s/^TEST_KEY=.*/TEST_KEY=$(openssl rand -hex 8)/" "$HERE/agility-camp.env.example" > /etc/agility-camp.env
fi
chown root:agility /etc/agility-camp.env
chmod 640 /etc/agility-camp.env

echo "== systemd service"
cp "$HERE/agility-camp.service" /etc/systemd/system/agility-camp.service
systemctl daemon-reload
systemctl enable agility-camp

echo "== Restart permission for $DEPLOY_USER"
echo "$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart agility-camp" > /etc/sudoers.d/agility-camp
chmod 440 /etc/sudoers.d/agility-camp
visudo -cf /etc/sudoers.d/agility-camp

echo "== nginx site for $DOMAIN"
SITE="/etc/nginx/sites-available/$DOMAIN"
if [ ! -f "$SITE" ]; then
  sed "s/peli\.example\.org/$DOMAIN/g" "$HERE/nginx.conf.example" > "$SITE"
  ln -sf "$SITE" "/etc/nginx/sites-enabled/$DOMAIN"
fi
nginx -t
systemctl reload nginx

echo "== HTTPS certificate"
certbot --nginx -d "$DOMAIN" --redirect --non-interactive --agree-tos

echo
echo "Done. Test key for ?testi=: $(grep '^TEST_KEY=' /etc/agility-camp.env | cut -d= -f2)"
echo "Next, from your own machine: DEPLOY_HOST=$DEPLOY_USER@<this server> web/deploy/deploy.sh"
