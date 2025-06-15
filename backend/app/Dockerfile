# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Since requirements.txt is now in the same folder as the Dockerfile,
# this simple copy command works perfectly.
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all other files (main.py, worker.py, etc.) from the current
# directory into the container's /app directory.
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Set the default command to run the application
CMD ["flask", "run", "--host=0.0.0.0", "--port=8080"]
