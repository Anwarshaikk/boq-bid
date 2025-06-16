# Use a standard Ubuntu LTS image as a reliable base.
FROM ubuntu:22.04

# Set environment variables to prevent interactive prompts during installation.
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# 1. Install dependencies needed for Python and for running the ODA File Converter.
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    python3.9 \
    python3-pip \
    autotools-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Download and install the ODA File Converter from a reliable .tar.gz archive.
# This avoids the previous dpkg and HTML download errors entirely.
RUN wget https://download.opendesign.com/guestfiles/TeighaFileConverter_lnxX64_4.3.2.tar.gz -O /tmp/oda.tar.gz && \
    tar -xzf /tmp/oda.tar.gz -C /opt && \
    # Create a symbolic link to the executable so it's in the system's PATH
    ln -s /opt/TeighaFileConverter_lnxX64_4.3.2/TeighaFileConverter /usr/local/bin/TeighaFileConverter && \
    rm /tmp/oda.tar.gz

# Set the working directory for our application
WORKDIR /app

# Create symbolic links so 'python' and 'pip' point to the correct versions.
RUN ln -s /usr/bin/python3.9 /usr/bin/python && \
    ln -s /usr/bin/pip3 /usr/bin/pip

# Install Python application dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code into the container
COPY . .

# The command to run the application is specified in docker-compose.yml
