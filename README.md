# Japanese Real Estate Platform

A real estate platform for the Japanese market with automated data crawling capabilities.

## 🏗️ Architecture Overview

This project consists of three main components:

- **Backend API** - FastAPI-based REST API with MongoDB database
- **Frontend** - React-based web application with modern UI components  
- **Crawlers** - Automated data collection from Japanese real estate websites

## 🚀 Development Environment Setup

### Prerequisites

- Docker and Docker Compose
- Python 3.8+
- Node.js 18+

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd JapaneseRealEstate
   ```

2. **Set up environment variables**
   Create `.env` files in the following locations:
   - `backend/.env` - Backend configuration
   - `crawlers/.env` - Crawler configuration

3. **Start all services**
   ```bash
   docker-compose up --build -d
   ```

4. **Access the application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## 🌐 Production Environment

The production environment is hosted on a server accessible via the domain **akiyahelper.homes**. The server runs Apache HTTP Server configured as a reverse proxy to route frontend and backend traffic appropriately, and it serves the site securely using a Let's Encrypt SSL certificate managed by DirectAdmin.

### Architecture Overview

**Frontend:**
- Served by a Docker container running on `localhost:8080`
- Apache proxies all requests except those starting with `/api/` to the frontend container

**Backend API:**
- A FastAPI application running in a Docker container on `localhost:8000`  
- Apache proxies requests beginning with `/api/` to the backend container
- The backend FastAPI routes include the `/api` prefix (e.g., `/api/v1/auth/login`)

### Apache Proxy Configuration

- Apache listens on ports 80 and 443
- HTTP (port 80) requests are redirected to HTTPS (port 443)
- The path `/.well-known/acme-challenge/` is served directly by Apache for Let's Encrypt certificate validation
- SSL termination is handled by Apache using certificates stored at:
  - `/usr/local/directadmin/data/users/admin/domains/akiyahelper.homes.cert.combined`
  - `/usr/local/directadmin/data/users/admin/domains/akiyahelper.homes.key`

**Example proxy rules:**
```apache
ProxyPass /api/ http://localhost:8000/api/
ProxyPassReverse /api/ http://localhost:8000/api/
ProxyPass / http://localhost:8080/
ProxyPassReverse / http://localhost:8080/
```

### Backend Base URL

The backend API is accessible at: **https://akiyahelper.homes/api**

All API routes are prefixed with `/api` to match the Apache proxy configuration.

### SSL Certificates and Renewal

- SSL certificates are issued and managed automatically via DirectAdmin's ACME integration with Let's Encrypt
- Certificates are stored in the user's DirectAdmin domain folder
- Apache is configured to use these certificates for HTTPS connections
- Auto-renewal is handled by DirectAdmin, ensuring continuous secure service

## 🔧 Backend (FastAPI)

### Overview
FastAPI backend that provides a RESTful API for the real estate platform. Uses MongoDB for data storage with CORS support for frontend integration.

### Key Features
- FastAPI framework with async support
- MongoDB integration for data storage
- CORS support for frontend integration
- Static file serving for property images
- Versioned API endpoints (`/v1/`)

### API Endpoints
- `GET /v1/listings/listings` - Get property listings with filtering and pagination
- `GET /v1/listings/unique-layouts` - Get unique building layouts

## 🎨 Frontend (React + TypeScript)

### Overview
Modern React application built with TypeScript, featuring a responsive design and comprehensive UI component library.

### Key Features
- React 18 with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- Radix UI for accessible components
- React Router for client-side routing
- React Query for server state management
- Comprehensive UI component library

### Pages
- **Home** (`/`) - Landing page
- **Login** (`/login`) - User authentication
- **Register** (`/register`) - User registration
- **404** - Not found page


## 🕷️ Crawlers

### Overview
Automated scripts that collect real estate data from various Japanese property websites. These scripts populate the database with fresh property listings.

### Key Features
- Multi-site crawling from Japanese real estate sites
- Translation support using DeepL API
- Currency conversion (JPY to USD)
- Image downloading and storage
- Comprehensive logging
- Scheduled execution via cron jobs


### Running Crawlers
```bash
cd crawlers
pip install -r requirements.txt
python crawler_name.py     # Run Sumai crawler
```

### Scheduled Execution
To run crawlers automatically on a schedule, use cron:

```bash
# Edit crontab
crontab -e

# Add entries for automated crawling (example):
0 0 * * * cd /home/admin/japanese-real-estate-scraping/crawlers && /home/admin/japanese-real-estate-scraping/crawlers/venv/bin/python cleanup.py
0 */4 * * * cd /home/admin/japanese-real-estate-scraping/crawlers && /home/admin/japanese-real-estate-scraping/crawlers/venv/bin/python sumai.py
0 */4 * * * cd /home/admin/japanese-real-estate-scraping/crawlers && /home/admin/japanese-real-estate-scraping/crawlers/venv/bin/python nifty.py
0 */4 * * * cd /home/admin/japanese-real-estate-scraping/crawlers && /home/admin/japanese-real-estate-scraping/crawlers/venv/bin/python hatomark.py

# For future crawlers, add similar entries:
# 0 */6 * * * cd /path/to/crawlers && python new_crawler.py
```

## 🐳 Docker Deployment

### Services
- **MongoDB** - Database service (port 27017)
- **Backend** - FastAPI application (port 8000)
- **Frontend** - React application (port 8080)

## 📊 Monitoring

- **Crawler Logs** - Stored in `crawlers/logs/`
- **Backend Logs** - Available via Docker logs
- **Database** - MongoDB logs via Docker 