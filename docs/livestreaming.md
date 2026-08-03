# Livestreaming compatibility

Go DJ! can coordinate a live session through Convex, but Convex is not an
audio/video encoder and a browser page should not receive or persist a social
platform stream key. The native Mixxx engine and a separate encoder remain the
streaming boundary.

## Compatibility matrix

| Destination | Works with Go DJ! / Mixxx | Recommended integration |
| --- | --- | --- |
| YouTube Live | Yes, through RTMPS/RTMP ingestion | Mixxx or the native app feeds an encoder such as OBS or FFmpeg; the encoder sends the program to YouTube. OAuth can manage scheduled broadcasts and metadata. |
| Twitch | Yes, through RTMP ingestion | Send the encoded program to the Twitch ingest URL with the user’s stream key. OAuth can read the key and manage broadcast metadata when the user grants the required scopes. |
| TikTok LIVE | Account-dependent | Use TikTok LIVE Studio or an approved creator workflow. There is no universal public live-ingest API in the current integration, so this is not a first target. |
| Instagram / Facebook Live | Account- and product-dependent | Treat as a later creator-side Live Producer/RTMPS integration after account eligibility and current Meta API access are confirmed. |

## Recommended first implementation

1. Keep Convex responsible for session state, deck state, gesture events, and
   stream status—not raw stream keys.
2. Add authenticated provider settings and server-side secret storage before
   allowing a user to connect YouTube or Twitch.
3. For desktop, support the reliable path `Mixxx -> OBS/FFmpeg -> YouTube or
   Twitch`.
4. For Android, add an RTMPS-capable encoder only after the native Mixxx APK
   and camera/control surface are stable. The camera and Mixxx audio must be
   mixed into one encoded program before upload.

Mixxx’s direct broadcast feature is designed for Shoutcast/Icecast radio
servers. It does not directly publish a social-media RTMP stream, so a bridge
encoder is required for YouTube or Twitch.

## Security notes

- Never put a stream key in Vite environment variables, browser local storage,
  Convex session documents, logs, or GitHub Actions output.
- Use OAuth where the provider supports it; otherwise accept a one-time key in
  an authenticated server-side flow and encrypt it at rest.
- Add explicit start/stop status and a provider disconnect action so a user can
  revoke access without deleting the DJ session.

## References

- [Mixxx live broadcasting manual](https://manual.mixxx.org/2.5/en/chapters/livebroadcasting)
- [YouTube Live encoder requirements](https://support.google.com/youtube/answer/2474026)
- [YouTube Live ingestion API](https://developers.google.com/youtube/v3/live/docs/liveStreams)
- [Twitch video broadcast documentation](https://dev.twitch.tv/docs/video-broadcast/)
- [Twitch authentication scopes](https://dev.twitch.tv/docs/authentication/scopes/)
