#!/usr/bin/env bash
# Build + push Docker Hub — puis redéploie le service sur Railway (image ou repo connecté).
#
# Usage :
#   export DOCKER_USER=tonusername   # ou ton org Docker Hub
#   ./deploy.sh
#
# Prérequis : docker login

set -euo pipefail

DOCKER_USER="${DOCKER_USER:-tonusername}"
IMAGE="${DOCKER_IMAGE:-${DOCKER_USER}/data-horizon-backend}"
VERSION="$(node -p "require('./package.json').version")"

echo "🔨 Build de l'image ${IMAGE}:${VERSION} ..."
docker build \
  --build-arg API_VERSION="${VERSION}" \
  -t "${IMAGE}:${VERSION}" \
  -t "${IMAGE}:latest" \
  .

echo "🚀 Push sur Docker Hub..."
docker push "${IMAGE}:${VERSION}"
docker push "${IMAGE}:latest"

echo "✅ Done ! Tags : ${IMAGE}:${VERSION} et ${IMAGE}:latest"
echo "   Redéploie manuellement sur Railway (Deploy → image ou trigger depuis GitHub)."
