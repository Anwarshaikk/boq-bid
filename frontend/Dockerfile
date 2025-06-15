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

# This is the corrected command. It's more direct and reliable.
# The host and port will be configured from the vite.config.js or
# passed via the npm script itself.
CMD ["npm", "run", "dev"]
