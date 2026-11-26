# Deploying Agility Camp

The game runs as one small Node server on the VPS, behind the nginx or Caddy
you already have. The server serves the built game and the API, and keeps
players and results in one SQLite file.

## First-time setup on the VPS

1. **Node.js 26 or newer.** For example from NodeSource:
   `curl -fsSL https://deb.nodesource.com/setup_26.x | sudo bash - && sudo apt install -y nodejs`.
   Check with `node --version`. If `node` is not at `/usr/bin/node`, change
   `ExecStart` in `agility-camp.service`.
2. **A user and the app directory.**
   ```bash
   sudo useradd --system --home /opt/agility-camp --shell /usr/sbin/nologin agility
   sudo mkdir -p /opt/agility-camp/app
   sudo chown -R "$USER" /opt/agility-camp/app
   ```
   The deploying SSH user owns the app files; the service only reads them.
3. **Settings.** Copy `agility-camp.env.example` to `/etc/agility-camp.env`,
   choose a `TEST_KEY` if you want test mode, then
   `sudo chmod 640 /etc/agility-camp.env && sudo chown root:agility /etc/agility-camp.env`.
4. **The service.** Copy `agility-camp.service` to
   `/etc/systemd/system/agility-camp.service`, then
   `sudo systemctl daemon-reload && sudo systemctl enable agility-camp`.
   The database is created in `/var/lib/agility-camp` on first start.
5. **DNS and HTTPS.** Point a subdomain (an A record) at the VPS. Add
   `nginx.conf.example` or `Caddyfile.example` to your proxy and reload it;
   with nginx, run certbot as shown in the file. "Add to Home Screen" needs
   HTTPS.
6. **Let the deploy user restart the service** without a password prompt, for
   example with `sudo visudo -f /etc/sudoers.d/agility-camp`:
   `youruser ALL=(root) NOPASSWD: /usr/bin/systemctl restart agility-camp`

## Releasing

From your Mac, in the repository:

```bash
DEPLOY_HOST=youruser@your-vps web/deploy/deploy.sh
```

The script runs the type check and tests, builds the game, copies it to
`/opt/agility-camp/app`, installs the server's dependencies there and restarts
the service. A new level batch is released the same way: once its doors are in
the build, they open on their dates.

## Checking it works

- `https://<subdomain>/api/calendar` returns JSON with today's date.
- On a phone over mobile data: register, play door 1, and see the result on the
  door's leaderboard. Redeploy and check the result is still there.
- `https://<subdomain>/?testi=<TEST_KEY>` shows "testitila", opens every
  released door and lets every dog wear every item. Test results go to a
  separate test leaderboard that real players never see.

## Backups

All results are in `/var/lib/agility-camp/agility-camp.db`. To copy it safely
while the server runs: `sqlite3 /var/lib/agility-camp/agility-camp.db ".backup backup.db"`.
