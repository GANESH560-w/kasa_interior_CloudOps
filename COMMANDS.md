# Kasa Interiors Command Reference

## 1. Local setup on Windows PowerShell

```powershell
cd "C:\Users\Ganesh\OneDrive\Desktop\Website Kasa interiors"
npm install
Copy-Item .env.example .env
notepad .env
npm start
```

## 2. Local setup on Ubuntu / EC2 shell

```bash
cd /home/ubuntu/"Website Kasa interiors"
npm install
cp .env.example .env
nano .env
npm start
```

## 3. Docker run locally or on EC2

```bash
cd /home/ubuntu/"Website Kasa interiors"
docker compose up -d --build
docker compose logs -f
docker compose down
```

Use `docker compose`, not `docker-compose`.

## 4. Docker direct commands

```bash
docker build -t kasa-interiors-app .
docker run -d --name kasa-interiors-app --env-file .env -p 3000:3000 -v $(pwd)/uploads:/app/uploads kasa-interiors-app
docker ps
docker logs -f kasa-interiors-app
docker stop kasa-interiors-app
docker rm kasa-interiors-app
```

## 5. MySQL / RDS database creation commands

```bash
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p -e "CREATE DATABASE IF NOT EXISTS kasa_interiors;"
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p kasa_interiors < database/schema.sql
```

## 6. MySQL useful commands after login

```sql
SHOW DATABASES;
USE kasa_interiors;
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

## 7. EC2 package install commands

```bash
sudo apt update
sudo apt install -y nodejs npm mysql-client docker.io docker-compose-v2 nginx
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker
```

## 8. Git commands for this repo

```bash
git status
git add .
git commit -m "Connect public site and admin, add RDS SSL support, and improve AWS docs"
git push origin main
```

## 9. App URLs

```text
http://localhost:3000
http://localhost:3000/admin
```

## 10. Required .env values

```env
PORT=3000
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=3306
DB_NAME=kasa_interiors
DB_USER=admin
DB_PASSWORD=change-me
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
JWT_SECRET=change-this-secret
ADMIN_USERNAME=kasaadmin
ADMIN_PASSWORD=kasa@2025
ADMIN_NAME=Kasa Admin
```
