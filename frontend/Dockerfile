FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
# This part is fine and remains unchanged.
COPY package*.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the port Vite runs on
EXPOSE 5173

# Run the development server and listen on all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
