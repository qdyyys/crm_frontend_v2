export const normalizeMediaArray = (msg: any) =>
  Array.isArray(msg?.media) ? msg.media : msg?.media ? [msg.media] : [];
