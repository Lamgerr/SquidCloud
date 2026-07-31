// Package squidveil is the official Go SDK for SquidVeil, the standalone
// secrets manager. It is built on the standard library only (no external
// dependencies) and mirrors the Python/JavaScript SDKs.
package squidveil

import "fmt"

// Error is the error type returned for all API failures. Code is the
// stable server error code (CONSUMED, EXPIRED, BAD_SIGNATURE, FORBIDDEN,
// INVALID_TOKEN, RATE_LIMITED, NOT_FOUND, ...); Status is the HTTP status
// when the failure came from the server (0 for local errors).
type Error struct {
	Code    string
	Status  int
	Message string
}

func (e *Error) Error() string {
	if e.Status > 0 {
		return fmt.Sprintf("%s (%d): %s", e.Code, e.Status, e.Message)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// IsCode reports whether err is a squidveil error with the given code.
func IsCode(err error, code string) bool {
	e, ok := err.(*Error)
	return ok && e.Code == code
}

// IsVeilRefConsumed reports whether err is a consumed VeilRef failure.
func IsVeilRefConsumed(err error) bool { return IsCode(err, "CONSUMED") }

// IsNotFound reports whether err is a not-found failure.
func IsNotFound(err error) bool { return IsCode(err, "NOT_FOUND") }

// IsPermission reports whether err is a forbidden failure.
func IsPermission(err error) bool { return IsCode(err, "FORBIDDEN") }

// IsRateLimited reports whether err is a 429 failure.
func IsRateLimited(err error) bool { return IsCode(err, "RATE_LIMITED") }

// IsExpired reports whether err is an expired failure (token or VeilRef).
func IsExpired(err error) bool { return IsCode(err, "EXPIRED") }
