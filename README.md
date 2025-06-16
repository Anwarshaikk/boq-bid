# BOQ-BID AI Engine

An automated Bill of Quantities Generation & Bid Strategy system that processes construction drawings, agreements, and generates costed BoQs.

## Features

- Drawing Quantity Extraction
- Agreement Document Processing
- Rules Engine Integration
- Auto-Mapping of Quantities
- DAR Cost Application
- Tender Discovery & Analysis
- Competitor Analysis

## Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Axios
- Sonner (Toast notifications)

### Backend
- Python/Flask
- Redis Queue
- Docker

## Setup Instructions

### Prerequisites
- Node.js 16+
- Python 3.8+
- Docker and Docker Compose
- Redis

### Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd boq-bid
```

2. Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```

3. Backend Setup:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

4. Using Docker:
```bash
docker-compose up --build
```

### Environment Variables

Create `.env` files in both frontend and backend directories:

Frontend (.env):
```
VITE_API_BASE_URL=http://localhost:8080
```

Backend (.env):
```
FLASK_ENV=development
FLASK_APP=app
SECRET_KEY=your-secret-key
REDIS_HOST=redis
REDIS_PORT=6379
MAX_CONTENT_LENGTH=16777216  # 16MB max file size
```

## API Documentation

### Endpoints

- `POST /api/upload_drawing` - Upload construction drawings
- `POST /api/process_agreement` - Process agreement documents
- `POST /api/process_rules` - Process rules documents
- `POST /api/auto_map` - Auto-map quantities
- `POST /api/apply_costs` - Apply DAR costs
- `POST /api/scan_tenders` - Discover and analyze tenders
- `POST /api/analyze_competitor` - Analyze competitor data
- `GET /status/<job_id>` - Check job status
- `GET /api/download_boq` - Download generated BoQ

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License
