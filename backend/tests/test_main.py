import pytest
from app.main import app
from app.config import Config

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    """Test the health check endpoint."""
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json == {'status': 'healthy'}

def test_upload_drawing_no_file(client):
    """Test uploading drawing without file."""
    response = client.post('/api/upload_drawing')
    assert response.status_code == 400
    assert response.json['error'] == 'No file part in the request'

def test_upload_drawing_empty_file(client):
    """Test uploading empty file."""
    response = client.post('/api/upload_drawing', data={'file': (None, '')})
    assert response.status_code == 400
    assert response.json['error'] == 'No file selected'

def test_auto_map_missing_data(client):
    """Test auto mapping with missing data."""
    response = client.post('/api/auto_map', json={})
    assert response.status_code == 400
    assert response.json['error'] == 'Missing drawing quantities or agreement items'

def test_apply_costs_missing_data(client):
    """Test applying costs with missing data."""
    response = client.post('/api/apply_costs', json={})
    assert response.status_code == 400
    assert response.json['error'] == 'Missing mapped BoQ data'

def test_download_boq_no_data(client):
    """Test downloading BoQ without data."""
    response = client.get('/api/download_boq')
    assert response.status_code == 404 