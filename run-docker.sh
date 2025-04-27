#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please create a .env file with your environment variables."
    echo "You can use .env.template as a starting point."
    exit 1
fi

# Build and run with docker-compose
echo "Building and starting Prescripto application..."
docker-compose up --build -d

echo ""
echo "Prescripto application is now running at http://localhost:8080"
echo "Use 'docker-compose logs -f' to view logs"
echo "Use 'docker-compose down' to stop the application" 