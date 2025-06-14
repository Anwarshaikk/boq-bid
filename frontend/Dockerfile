FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Fix Vite binary permission issue
RUN chmod +x node_modules/.bin/vite

# Copy the source code
COPY . .

# Set environment and expose Vite dev server port
ENV PORT=5173
EXPOSE ${PORT}

# Start Vite dev server
CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 --port ${PORT}"]
