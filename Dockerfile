# syntax=docker/dockerfile:1
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/engine/reference/builder/

ARG NODE_VERSION=21.1.0

FROM node:${NODE_VERSION}-alpine

# ENV federation_apis=${federation_apis}

# Use production node environment by default.
ENV NODE_ENV production


WORKDIR /usr/src/app

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage a bind mounts to package.json and package-lock.json to avoid having to copy them into
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Run the application as a non-root user.
#USER node

# Copy the rest of the source files into the image.
COPY --chown=node . .
RUN chmod +x serverForApi.js

# Expose the port that the application listens on.
EXPOSE 3000

# Run the application as a non-root user.
USER node

# Run the application.
CMD node serverForApi.js