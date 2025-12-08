# Use nginx to serve the static site
FROM nginx:alpine

# Copy the built artifacts to nginx html directory
COPY dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
