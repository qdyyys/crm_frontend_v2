export interface Chat {
  id: number;
  type: string;
  title: string;
  username: string | null;
  unread_count: number;
  is_pinned: boolean;
  ttl_period: number | null;
  last_message?: {
    id: number;
    date: string;
    text: string;
    from_user: {
      id: number;
      username: string | null;
      first_name: string;
      last_name: string | null;
    };
  };
  photo?: {
    small_file_id: string;
    small_photo_unique_id: string;
    small_photo_url: string;
    big_file_id: string;
    big_photo_unique_id: string;
    big_photo_url: string;
  };
}

export interface Message {
  id: number;
  date: string;
  text: string;
  chat: {
    id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
  };
  from_user: {
    id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
    photo?: {
      small_file_id?: string;
      small_photo_unique_id?: string;
      small_photo_url?: string;
      big_file_id?: string;
      big_photo_unique_id?: string;
      big_photo_url: string;
    };
  };
  is_pinned?: boolean;
  photo_file_id?: string;
  photo_file_size?: number;
  photo_file_unique_id?: string;
  photo_height?: number;
  photo_url?: string;
  photo_width?: number;
  has_media?: boolean;
  is_outgoing?: boolean;
  media_type?: string | null;
  reply_to_message_id: number | null;
}

export interface TelegramAccount {
  _id: string;
  avatar: string;
  channel_signatures: any[];
  created_at: string;
  creator_account_id: string;
  first_line: any[];
  first_name: string;
  last_name: string;
  phone: string;
  pinned_chats: any[];
  second_line: any[];
  second_line_chats: any[];
  session_string: string;
  shared_with_accounts: string[];
  updated_at: string;
  user_id: number;
  username: string | null;
  telegram_id: string;
}

export interface Script {
  name: string;
  message: string;
}

export interface ApiVideo {
  id?: string;
  video_id?: string;
  button_name?: string;
  message?: string;
  video_base64?: string;
  old_video_base64?: string;
  created_at?: string;
  updated_at?: string;
  is_video_note?: boolean;
}

export interface User {
  id: string;
  login: string;
  email?: string | null;
  banned: boolean;
  created_at: string | null;
  updated_at: string;

  manager: boolean;
  shadow_manager: boolean;
  perms: string[];
  roles: string[];

  is_working?: boolean;
  "2fa"?: boolean;

  scripts: Script[];

  telegram_accounts?: TelegramAccount[];

  videos?: ApiVideo[];
  videos_count?: number;

  count?: number;
  telegram?: string;
  translate?: boolean;
}
