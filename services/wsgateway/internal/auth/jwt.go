package auth

import (
	"fmt"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// Claims mirrors the access-token claims issued by the Auth Service so the
// WS-Gateway can validate the same JWTs that the dashboard obtains at login.
type Claims struct {
	UserID   string   `json:"uid"`
	Username string   `json:"username"`
	Roles    []string `json:"roles"`
	jwt.RegisteredClaims
}

// ValidateToken parses and validates an HS256 access token, returning the
// claims on success. An empty secret is treated as a misconfiguration and
// results in an error so callers fail closed.
func ValidateToken(tokenStr, secret string) (*Claims, error) {
	if secret == "" {
		return nil, fmt.Errorf("JWT secret not configured")
	}

	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	return claims, nil
}

// ExtractToken pulls the bearer token from the Authorization header or the
// `token` query parameter. Either transport works for WebSocket handshakes
// (browsers cannot set arbitrary headers on the WS upgrade request, so the
// dashboard passes the token as a query parameter).
func ExtractToken(header string, queryToken string) string {
	if header != "" && strings.HasPrefix(header, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	}
	return strings.TrimSpace(queryToken)
}
