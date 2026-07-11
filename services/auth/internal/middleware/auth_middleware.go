package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/almuzky/iot/services/auth/internal/service"
)

type contextKey string

const (
	ContextKeyUserID   contextKey = "user_id"
	ContextKeyUsername contextKey = "username"
	ContextKeyRoles    contextKey = "roles"
)

// JWTAuth validates the Bearer token in Authorization header.
// On success, it injects user_id, username, and roles into the request context.
func JWTAuth(svc *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"error":"missing or invalid Authorization header"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := svc.ValidateClaims(tokenStr)
			if err != nil {
				http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, ContextKeyUsername, claims.Username)
			ctx = context.WithValue(ctx, ContextKeyRoles, claims.Roles)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns a middleware that allows only users with at least one of the given roles.
// Usage: RequireRole("admin", "operator")
func RequireRole(allowed ...string) func(http.Handler) http.Handler {
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, r := range allowed {
		allowedSet[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rolesVal := r.Context().Value(ContextKeyRoles)
			if rolesVal == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusForbidden)
				return
			}

			roles, ok := rolesVal.([]string)
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusForbidden)
				return
			}

			for _, role := range roles {
				if _, found := allowedSet[role]; found {
					next.ServeHTTP(w, r)
					return
				}
			}

			http.Error(w, `{"error":"forbidden: insufficient role"}`, http.StatusForbidden)
		})
	}
}

// UserIDFromContext extracts the user ID from a context set by JWTAuth middleware.
func UserIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(ContextKeyUserID).(string)
	return v
}

// RolesFromContext extracts the roles slice from a context set by JWTAuth middleware.
func RolesFromContext(ctx context.Context) []string {
	v, _ := ctx.Value(ContextKeyRoles).([]string)
	return v
}
