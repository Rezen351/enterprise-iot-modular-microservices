FROM alpine:3.19

RUN apk add --no-cache bash wget ca-certificates \
  && update-ca-certificates \
  && wget -q https://dl.min.io/client/mc/release/linux-amd64/mc \
      -O /usr/local/bin/mc \
  && chmod +x /usr/local/bin/mc \
  && rm -rf /var/cache/apk/*

COPY infra/minio/init-minio.sh /usr/local/bin/minio-init
RUN chmod +x /usr/local/bin/minio-init

ENTRYPOINT ["/usr/local/bin/minio-init"]
