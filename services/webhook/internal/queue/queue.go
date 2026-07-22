package queue

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

const QueueKey = "webhook:queue"

type Job struct {
	LogID    string `json:"log_id"`
	Channel  string `json:"channel"`
	Target   string `json:"target"`
	Subject  string `json:"subject"`
	Body     string `json:"body"`
	AlertID  string `json:"alert_id"`
	UserID   string `json:"user_id"`
	Attempts int    `json:"attempts"`
}

type Queue struct {
	rdb *redis.Client
}

func New(rdb *redis.Client) *Queue { return &Queue{rdb: rdb} }

func (q *Queue) Enqueue(ctx context.Context, job Job) error {
	b, err := json.Marshal(job)
	if err != nil {
		return err
	}
	return q.rdb.RPush(ctx, QueueKey, b).Err()
}

func (q *Queue) Dequeue(ctx context.Context) (*Job, error) {
	res, err := q.rdb.BRPop(ctx, 2*time.Second, QueueKey).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var job Job
	if err := json.Unmarshal([]byte(res[1]), &job); err != nil {
		return nil, err
	}
	return &job, nil
}
