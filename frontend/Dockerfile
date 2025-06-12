FROM node:20-alpine
WORKDIR /app

# Install dependencies based on package.json and package-lock.json
COPY package*.json ./
RUN npm install

# Copy the rest of the application source
COPY . .

# Default Vite port
ENV PORT=5173
EXPOSE ${PORT}

# Start the development server on 0.0.0.0 for Docker
CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 --port ${PORT}"]
