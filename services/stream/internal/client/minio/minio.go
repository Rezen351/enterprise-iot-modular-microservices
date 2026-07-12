package minio

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Client wraps the MinIO Go SDK for storing snapshots & recordings in the
// stream bucket. Objects are served to the dashboard through a same-origin
// proxy (Vite /storage → minio:9000) with a public-read policy on the
// snapshots/recordings prefixes, so no presigned URLs are required.
type Client struct {
	client *minio.Client
	bucket string
}

// New connects to MinIO and ensures the bucket exists.
func New(endpoint, accessKey, secretKey string, useSSL bool, bucket string) (*Client, error) {
	c, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio init: %w", err)
	}
	cl := &Client{client: c, bucket: bucket}

	exists, err := c.BucketExists(context.Background(), bucket)
	if err != nil {
		return nil, fmt.Errorf("minio bucket check: %w", err)
	}
	if !exists {
		if err := c.MakeBucket(context.Background(), bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("minio make bucket: %w", err)
		}
	}

	// Public-read for snapshots/recordings prefixes so the dashboard can
	// display them through the /storage proxy without per-object signatures.
	if err := cl.setPublicReadPolicy(); err != nil {
		log.Printf("[minio] warn: could not set public-read policy: %v", err)
	}

	return cl, nil
}

func (c *Client) setPublicReadPolicy() error {
	policy := fmt.Sprintf(`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::%s/snapshots/*",
        "arn:aws:s3:::%s/recordings/*"
      ]
    }
  ]
}`, c.bucket, c.bucket)
	return c.client.SetBucketPolicy(context.Background(), c.bucket, policy)
}

// UploadObject stores data under key (e.g. "snapshots/cam-01/<uuid>.jpg").
// proxyBase is the dashboard-relative base used to build the public URL
// (e.g. "/storage"). Returns the same-origin URL the dashboard can render.
func (c *Client) UploadObject(key, contentType string, data []byte) (string, error) {
	_, err := c.client.PutObject(context.Background(), c.bucket, key, bytes.NewReader(data), int64(len(data)),
		minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		return "", fmt.Errorf("minio put: %w", err)
	}
	return "/storage/" + c.bucket + "/" + key, nil
}

// DeleteObject removes an object (best-effort; ignores not-found).
func (c *Client) DeleteObject(key string) error {
	err := c.client.RemoveObject(context.Background(), c.bucket, key, minio.RemoveObjectOptions{})
	if err != nil {
		// MinIO returns an error for missing objects; treat as success.
		log.Printf("[minio] remove %s: %v (ignored)", key, err)
	}
	return nil
}

// Reader opens an object for direct streaming (used if needed).
func (c *Client) Reader(key string) (io.Reader, error) {
	obj, err := c.client.GetObject(context.Background(), c.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	return obj, nil
}
