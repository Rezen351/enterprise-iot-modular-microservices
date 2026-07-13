# Runtime-only image. The Go binary is built on the host (where the module
# cache lives) and copied in, because the Docker build context has no egress
# to the Go module proxy. Build it first with:
#   CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o stream-svc .
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata wget ffmpeg
RUN adduser -D -H -s /bin/false appuser
USER appuser

WORKDIR /app
COPY stream-svc .

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["./stream-svc"]
