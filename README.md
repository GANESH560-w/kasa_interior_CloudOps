# Kasa Interiors Cloud Deployment Guide

This README explains exactly how to run the full Kasa Interiors project on AWS Cloud, including:

- public website
- admin panel
- backend API
- Amazon RDS MySQL database
- Amazon EC2 hosting
- Docker deployment
- Nginx reverse proxy
- HTTPS setup

## What This Project Uses

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: MySQL on Amazon RDS
- Hosting: Amazon EC2
- Container runtime: Docker
- Reverse proxy: Nginx

## Project Files

```text
admin/                  Admin panel pages and script
assets/                 Website assets
database/schema.sql     Database tables
server/app.js           Express backend
server/db.js            MySQL connection
uploads/                Uploaded project documents
Dockerfile              App container image
docker-compose.yml      Container startup config
.env.example            Environment template
README.md               AWS deployment guide
COMMANDS.md             Quick command reference
```

## Final Result After Deployment

After following this guide:

- website opens at `http://YOUR_DOMAIN_OR_EC2_IP/`
- admin login opens at `http://YOUR_DOMAIN_OR_EC2_IP/admin/index.html`
- backend runs inside Docker on EC2
- data is stored in Amazon RDS MySQL

## AWS Architecture

```text
Browser
   |
   v
Nginx on EC2
   |
   v
Docker Container (Node.js + Express)
   |
   v
Amazon RDS MySQL
```

## Step 1: Get the Code on EC2

Your GitHub repo is:

[https://github.com/GANESH560-w/kasa_interior_CloudOps.git](https://github.com/GANESH560-w/kasa_interior_CloudOps.git)

On EC2:

```bash
git clone https://github.com/GANESH560-w/kasa_interior_CloudOps.git
cd kasa_interior_CloudOps
```

## Step 2: Create Amazon RDS MySQL Database

In AWS Console:

1. Open `RDS`
2. Click `Create database`
3. Choose `Standard create`
4. Choose `MySQL`
5. DB identifier: `kasa-interiors-db`
6. Master username: `admin`
7. Set your password
8. Initial database name: `kasa_interiors`
9. Put RDS in the same VPC as EC2
10. Allow access from EC2 security group only on port `3306`
11. Create database

RDS security group inbound rule:

- Type: `MySQL/Aurora`
- Port: `3306`
- Source: your EC2 security group

## Step 3: Create EC2 Instance

Recommended settings:

- Ubuntu 22.04 LTS
- Instance type `t3.small` or higher
- 20 GB storage
- Attach key pair
- Attach security group with:
  - SSH `22` from your IP
  - HTTP `80` from anywhere
  - HTTPS `443` from anywhere

## Step 4: Connect to EC2

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Example:

```bash
ssh -i kasa-key.pem ubuntu@13.233.100.10
```

## Step 5: Install Required Software on EC2

```bash
sudo apt update
sudo apt install -y git curl docker.io docker-compose-v2 mysql-client nginx
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker
```

Verify:

```bash
docker --version
docker compose version
git --version
mysql --version
nginx -v
```

## Step 6: Create the Database and Tables

Use your RDS endpoint.

Create database:

```bash
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p -e "CREATE DATABASE IF NOT EXISTS kasa_interiors;"
```

Import schema:

```bash
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p kasa_interiors < database/schema.sql
```

Check tables:

```bash
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p -e "USE kasa_interiors; SHOW TABLES;"
```

## Step 7: Create `.env` File on EC2

```bash
cp .env.example .env
nano .env
```

Paste and update:

```env
PORT=3000
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=3306
DB_NAME=kasa_interiors
DB_USER=admin
DB_PASSWORD=your-rds-password
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_USERNAME=kasaadmin
ADMIN_PASSWORD=kasa@2025
ADMIN_NAME=Kasa Admin
```

Important:

- `DB_HOST` must be your RDS endpoint
- `DB_PASSWORD` must be your RDS password
- `JWT_SECRET` should be long and secret
- `ADMIN_USERNAME` and `ADMIN_PASSWORD` are for admin login

## Step 8: Run the Project with Docker

From project folder on EC2:

```bash
docker compose up -d --build
```

Check if container is running:

```bash
docker ps
```

Check logs:

```bash
docker compose logs -f
```

Check health API:

```bash
curl http://127.0.0.1:3000/api/health
```

Expected response:

```json
{"status":"ok"}
```

## Step 9: Test Website and Admin Panel on Port 3000

Open these in browser:

```text
http://YOUR_EC2_PUBLIC_IP:3000/
http://YOUR_EC2_PUBLIC_IP:3000/admin/index.html
```

Admin credentials come from `.env`:

- username: `ADMIN_USERNAME`
- password: `ADMIN_PASSWORD`

## Step 10: Configure Nginx Reverse Proxy

Create config:

```bash
sudo nano /etc/nginx/sites-available/kasa-interiors
```

Paste:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_EC2_IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/kasa-interiors /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Now open:

```text
http://YOUR_EC2_PUBLIC_IP/
http://YOUR_EC2_PUBLIC_IP/admin/index.html
```

## Step 11: Add Domain Name Optional

If you have a domain:

1. Add `A` record to your EC2 public IP
2. Update Nginx `server_name`
3. Restart Nginx

Example DNS:

```text
Type: A
Host: @
Value: YOUR_EC2_PUBLIC_IP
```

```text
Type: A
Host: www
Value: YOUR_EC2_PUBLIC_IP
```

Then update Nginx:

```bash
sudo nano /etc/nginx/sites-available/kasa-interiors
```

Use:

```nginx
server_name yourdomain.com www.yourdomain.com;
```

Restart:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

## Step 12: Enable HTTPS with SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot renew --dry-run
```

## Step 13: How to Update the Project Later

Whenever you push new code to GitHub:

On local machine:

```bash
git add .
git commit -m "Update project"
git push origin main
```

On EC2:

```bash
cd ~/kasa_interior_CloudOps
git pull origin main
docker compose down
docker compose up -d --build
docker compose logs -f
```

## Step 14: Useful Runtime Commands

Check running containers:

```bash
docker ps
```

Check app logs:

```bash
docker compose logs -f kasa-app
```

Enter container:

```bash
docker exec -it kasa-interiors-app sh
```

Restart app:

```bash
docker compose restart
```

Stop app:

```bash
docker compose down
```

## Step 15: Useful Database Commands

Connect to RDS:

```bash
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p kasa_interiors
```

Inside MySQL:

```sql
SHOW TABLES;
SELECT * FROM admins;
SELECT * FROM enquiries;
SELECT * FROM customers;
SELECT * FROM contractors;
SELECT * FROM projects;
SELECT * FROM bills;
SELECT * FROM expenses;
SELECT * FROM documents;
```

## Step 16: Full Quick Deployment Commands

If EC2 is created and RDS is ready, run these in order:

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
sudo apt update
sudo apt install -y git curl docker.io docker-compose-v2 mysql-client nginx
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker
git clone https://github.com/GANESH560-w/kasa_interior_CloudOps.git
cd kasa_interior_CloudOps
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p -e "CREATE DATABASE IF NOT EXISTS kasa_interiors;"
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p kasa_interiors < database/schema.sql
cp .env.example .env
nano .env
docker compose up -d --build
curl http://127.0.0.1:3000/api/health
sudo nano /etc/nginx/sites-available/kasa-interiors
sudo ln -s /etc/nginx/sites-available/kasa-interiors /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 17: URLs After Deployment

Website:

```text
http://YOUR_DOMAIN_OR_EC2_IP/
```

Admin panel:

```text
http://YOUR_DOMAIN_OR_EC2_IP/admin/index.html
```

## Step 18: Troubleshooting

### If container does not start

```bash
docker compose logs -f
```

### If database connection fails

Check:

- RDS endpoint is correct
- RDS password is correct
- port `3306` is allowed from EC2 security group
- EC2 and RDS are in correct VPC/network

Test DB manually:

```bash
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p kasa_interiors
```

### If website works but admin login fails

Check:

- `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`
- container restarted after env update
- app logs

Restart app:

```bash
docker compose down
docker compose up -d --build
```

### If Nginx shows 502

Run:

```bash
docker ps
curl http://127.0.0.1:3000/api/health
sudo systemctl status nginx
```

## Step 19: Final Verification Checklist

After deployment, confirm:

1. `docker ps` shows the app container running
2. `curl http://127.0.0.1:3000/api/health` returns success
3. public website opens in browser
4. admin panel opens in browser
5. admin login works
6. contact form creates enquiry data
7. admin panel shows enquiry in dashboard

## Step 20: Important Notes

- Do not commit your real `.env`
- Keep `JWT_SECRET` private
- Keep RDS private if possible
- Uploaded files are stored in `uploads/` on EC2
- For bigger production setup, you can later move uploads to S3
