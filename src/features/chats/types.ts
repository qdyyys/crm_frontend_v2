export type AttachItem = {
  id: string;
  file: File;
  url: string;
  kind: "image" | "video";
};

export type CtxMenu = { x: number; y: number; msg: any } | null;
export type AnyMsg = Record<string, any>;
export type WsStatus = "connected" | "disconnected";

export type ChatEntity = any;
export type MessageEntity = any;
