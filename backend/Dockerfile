# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install dependencies directly
# Added sentence-transformers and torch for AI-based semantic similarity.
RUN pip install Flask Flask-Cors redis rq ezdxf openpyxl pdfplumber google-generativeai sentence-transformers torch

# Copy the rest of the application's code into the container
COPY ./app .

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Define environment variable
ENV FLASK_APP=main.py

# Run the command to start the Flask server
CMD ["flask", "run", "--host=0.0.0.0", "--port=8080"]
