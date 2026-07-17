package handler

import (
	"context"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKeyClaims struct{}

func withClaims(ctx context.Context, claims jwt.MapClaims) context.Context {
	return context.WithValue(ctx, ctxKeyClaims{}, claims)
}

func claimsFrom(ctx context.Context) (jwt.MapClaims, bool) {
	c, ok := ctx.Value(ctxKeyClaims{}).(jwt.MapClaims)
	return c, ok
}
