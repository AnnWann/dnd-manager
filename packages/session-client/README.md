# Session client transport

`SessionTransport` owns WebSocket connection authorization, reconnect backoff, heartbeats, and kicked-session handling. The host supplies auth mode, token endpoint, UI navigation, and message decoder. The website's `SessionSocket` remains responsible for game message processing, custom-system cache and batching magic operations.

Keep this package independent of React and website-specific globals. Browser WebSocket and fetch are required at runtime.
