# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory for the application
WORKDIR /app

# Copy dependency file first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application source code
COPY . .

# Default Flask entrypoint
ENV FLASK_APP=main:app

EXPOSE 8080

CMD ["flask", "run", "--host=0.0.0.0", "--port=8080"]
