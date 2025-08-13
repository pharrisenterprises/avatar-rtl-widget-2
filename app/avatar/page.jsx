async function start() {
  try {
    setStatus('loading-sdk');
    setNote('Loading HeyGen SDK…');

    // 1) load SDK
    const HeyGenStreamingAvatar = await loadHeygenSdk();

    // 2) session token
    const tokRes = await fetch('/api/heygen-token', { cache: 'no-store' });
    const tokJson = await tokRes.json();
    const token = tokJson?.token;
    if (!token) throw new Error('Token missing from /api/heygen-token');

    // 3) avatar id (streaming avatar id string, e.g. "Wayne_20240711")
    const avRes = await fetch('/api/heygen-avatars', { cache: 'no-store' });
    const avJson = await avRes.json();
    const avatarName = avJson?.id;
    if (!avatarName) throw new Error('Avatar id missing from /api/heygen-avatars');

    window.__HEYGEN_DEBUG__ = { token, avatarName };

    setStatus('starting');
    setNote(`Starting ${avatarName}…`);

    // 4) create client + start
    const client = new HeyGenStreamingAvatar({ token }); // IMPORTANT: pass { token }
    const session = await client.createStartAvatar({
      avatarName,
      quality: 'high',
      version: 'v3',           // ensure v3+
    });

    // 5) attach remote media to <video>
    const videoEl = videoRef.current;
    if (!videoEl) throw new Error('Missing <video> element');

    // Some SDK builds attach from client, others from the session.
    if (typeof session?.attachToElement === 'function') {
      await session.attachToElement(videoEl);
    } else if (typeof client?.attachToElement === 'function') {
      await client.attachToElement(videoEl);
    } else if (typeof client?.getMediaStream === 'function') {
      // very old fallback: set srcObject manually
      const ms = await client.getMediaStream();
      videoEl.srcObject = ms;
      await videoEl.play().catch(() => {});
    } else {
      console.log('client keys:', Object.keys(client || {}));
      console.log('session keys:', Object.keys(session || {}));
      throw new Error('SDK shape not recognized: no attachToElement / getMediaStream on client or session');
    }

    setStatus('started');
    setNote('Streaming!');
  } catch (err) {
    console.error(err);
    setStatus('error');
    setNote(err?.message || 'start failed');
    alert(err?.message || 'Start failed');
  }
}
