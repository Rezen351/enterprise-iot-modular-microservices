# =====================================================================
# Dashboard — Vite dev server (hot reload via volume mount)
# Base node:20-alpine sama dengan yang dipakai compose lainnya.
# `npm run dev -- --host` agar dapat diakses dari luar container
# (browser di host). Source di-mount lewat volume di docker-compose
# sehingga tiap perubahan file langsung ter-reload (HMR).
# =====================================================================
FROM node:20-alpine

WORKDIR /app

# Install dependencies dulu (layer cache) — node_modules tetap di dalam
# image agar tidak bentrok dengan node_modules host (glibc) saat di-mount.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# Copy seluruh source
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
