# ─── Build stage ───────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN for i in 1 2 3 4 5; do go mod download && break || { echo "go mod download failed, retrying..."; sleep 5; }; done

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o ws-gateway-svc .

# ─── Runtime stage ─────────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/ws-gateway-svc .

RUN adduser -D -H -s /bin/false appuser
USER appuser

EXPOSE 8090

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8090/health || exit 1

ENTRYPOINT ["./ws-gateway-svc"]
