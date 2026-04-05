# Kasa Interiors AWS Deployment Guide

This project now includes:

- a Node.js + Express backend
- a MySQL-compatible database setup for AWS RDS
- API-driven admin login, enquiries, customers, contractors, projects, billing, expenses, documents, and reports
- a Docker setup for EC2 deployment

## Project Structure

```text
.
├── admin/              # Admin UI
├── assets/             # Website images/videos
├── database/schema.sql # MySQL schema
├── server/             # Express backend
├── uploads/            # Project document uploads
├── Dockerfile
├── docker-compose.yml
├── package.json
└── .env.example
```

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: MySQL / Amazon RDS for MySQL
- Hosting: Amazon EC2
- Containerization: Docker

## 1. Local Development Setup

### Install Node.js dependencies

```powershell
npm install
```

### Create your environment file

```powershell
Copy-Item .env.example .env
```

Update `.env` with your values:

```env
PORT=3000
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=3306
DB_NAME=kasa_interiors
DB_USER=admin
DB_PASSWORD=change-me
JWT_SECRET=change-this-secret
ADMIN_USERNAME=kasaadmin
ADMIN_PASSWORD=kasa@2025
ADMIN_NAME=Kasa Admin
```

### Start the app locally

```powershell
npm start
```

Open:

- Public site: `http://localhost:3000`
- Admin login: `http://localhost:3000/admin/index.html`

## 2. Create AWS RDS MySQL Database

### In AWS Console

1. Open `RDS`
2. Click `Create database`
3. Choose `MySQL`
4. Set database name: `kasa_interiors`
5. Create master username and password
6. Allow access from your EC2 security group on port `3306`

### Create database and import schema

From your EC2 server or your local machine:

```bash
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p -e "CREATE DATABASE IF NOT EXISTS kasa_interiors;"
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p kasa_interiors < database/schema.sql
```

The app will also create tables automatically on startup if the database already exists.

## 3. Launch EC2 Instance

Recommended:

- OS: Ubuntu 22.04 LTS
- Instance type: `t3.small` or higher
- Storage: at least `20 GB`

### EC2 security group

Allow:

- `22` from your IP for SSH
- `80` from anywhere for HTTP
- `443` from anywhere for HTTPS

## 4. Connect to EC2

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

## 5. Install Docker on EC2

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker
```

Verify:

```bash
docker --version
docker compose version
```

## 6. Upload Project to EC2

From your local machine:

```bash
scp -i your-key.pem -r "Website Kasa interiors" ubuntu@YOUR_EC2_PUBLIC_IP:/home/ubuntu/
```

On EC2:

```bash
cd /home/ubuntu/"Website Kasa interiors"
```

## 7. Configure Environment on EC2

```bash
cp .env.example .env
nano .env
```

Example EC2 `.env`:

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

## 8. Run with Docker on EC2

### Build and start

```bash
docker compose up -d --build
```

### Check logs

```bash
docker compose logs -f
```

### Stop containers

```bash
docker compose down
```

## 9. Optional Direct Docker Commands

### Build image

```bash
docker build -t kasa-interiors-app .
```

### Run container

```bash
docker run -d \
  --name kasa-interiors-app \
  --env-file .env \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  kasa-interiors-app
```

## 10. Reverse Proxy with Nginx on EC2

Install Nginx:

```bash
sudo apt install -y nginx
```

Create config:

```bash
sudo nano /etc/nginx/sites-available/kasa-interiors
```

Use:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable config:

```bash
sudo ln -s /etc/nginx/sites-available/kasa-interiors /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 11. Enable HTTPS with Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 12. Common Deployment Workflow

When you update the code:

```bash
cd /home/ubuntu/"Website Kasa interiors"
docker compose down
docker compose up -d --build
docker compose logs -f
```

## 13. Useful Commands

### Check running containers

```bash
docker ps
```

### Restart app

```bash
docker compose restart
```

### View app logs

```bash
docker compose logs -f kasa-app
```

### Enter container shell

```bash
docker exec -it kasa-interiors-app sh
```

### Test database connection from EC2

```bash
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u admin -p kasa_interiors
```

## 14. Admin Login

Default admin credentials come from `.env`:

- Username: `ADMIN_USERNAME`
- Password: `ADMIN_PASSWORD`

The backend creates the first admin user automatically on startup if the `admins` table is empty.

## 15. API Features Added

- Public enquiry submission from `contact.html`
- Secure admin login using JWT
- Dashboard bootstrap API
- Enquiry status update and delete
- Customer create and delete
- Contractor create and delete
- Project create and delete
- Timeline updates
- Expense tracking
- Contractor bills and payment tracking
- Project document uploads

## 16. Notes for AWS

- RDS should usually be private; allow access only from the EC2 security group
- Uploaded documents are stored in `uploads/`
- For stronger production durability, you can later move uploads to Amazon S3
- Keep `JWT_SECRET` long and private
- Do not commit `.env`

## 17. Quick Start Summary

```bash
npm install
cp .env.example .env
npm start
```

For EC2:

```bash
docker compose up -d --build
```
