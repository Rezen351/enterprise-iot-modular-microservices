package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/nats-io/nats.go"
)

// Handler bridges NATS topics to dashboard websocket clients.
type Handler struct {
	nc *nats.Conn
}

func New(nc *nats.Conn) *Handler {
	return &Handler{nc: nc}
}

// Health is a liveness probe.
func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// client wraps a single websocket connection with a buffered send channel.
type client struct {
	conn *websocket.Conn
	send chan []byte
}

// NodeLive upgrades to a websocket and streams every NATS message published on
// the node's live subject (mqtt.{node_id}) to the connecting dashboard client.
func (h *Handler) NodeLive(w http.ResponseWriter, r *http.Request) {
	nodeID := chi.URLParam(r, "node_id")
	if nodeID == "" {
		http.Error(w, "node_id required", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[ws-gateway] upgrade failed node=%s: %v", nodeID, err)
		return
	}

	c := &client{conn: conn, send: make(chan []byte, 128)}
	subject := "mqtt." + nodeID

	sub, err := h.nc.Subscribe(subject, func(m *nats.Msg) {
		select {
		case c.send <- m.Data:
		default:
			// Slow client — drop frame to avoid blocking the NATS reader.
			log.Printf("[ws-gateway] dropping frame node=%s (slow client)", nodeID)
		}
	})
	if err != nil {
		log.Printf("[ws-gateway] nats subscribe failed node=%s: %v", nodeID, err)
		_ = conn.Close()
		return
	}
	log.Printf("[ws-gateway] client connected node=%s (subject=%s)", nodeID, subject)

	go c.writePump()

	// Reader goroutine: detects close and tears down the NATS subscription.
	go func() {
		defer func() {
			_ = sub.Unsubscribe()
			_ = conn.Close()
			log.Printf("[ws-gateway] client disconnected node=%s", nodeID)
		}()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
}

// writePump drains the send channel onto the websocket connection.
func (c *client) writePump() {
	for data := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
			return
		}
	}
}
