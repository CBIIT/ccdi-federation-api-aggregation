# syntax=docker/dockerfile:1
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/engine/reference/builder/

#ARG NODE_VERSION=21.7.3

#FROM node:${NODE_VERSION}-alpine3.19
FROM node:21.7.3-alpine3.19 AS fnl_base_image

## Update Alpine option
#RUN apk update
#RUN apk upgrade

## Update Alpine busybox
RUN apk update && apk upgrade busybox

# ENV federation_apis=${federation_apis}

# Use production node environment by default.
ENV NODE_ENV production
ENV NEW_RELIC_NO_CONFIG_FILE=true
ENV NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
ENV NEW_RELIC_LOG=stdout

WORKDIR /usr/src/app

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage a bind mounts to package.json and package-lock.json to avoid having to copy them into
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

## Below to update npm modules option
## Install node_modules into the local project, the latest version
#RUN npm install npm
## Replace modules in npm
#RUN rm -rf /usr/local/lib/node_modules/npm
## Remove modules from the local project
#RUN mv node_modules/npm /usr/local/lib/node_modules/npm

# Copy the rest of the source files into the image.
COPY --chown=node . .
RUN chmod +x serverForApi.js

# Expose the port that the application listens on.
EXPOSE 3000

# Run the application as a non-root user.
USER node

# Run the application.
CMD node serverForApi.js
