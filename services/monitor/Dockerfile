FROM golang:1.25-alpine AS builder
WORKDIR /build
COPY . .
RUN apk add --no-cache git && go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o monitor ./main.go

FROM alpine:3.19
RUN apk --no-cache add docker-cli
COPY --from=builder /build/monitor /usr/local/bin/monitor
ENTRYPOINT ["monitor"]
