export interface SlackUser {
  id: string
  deleted: boolean
  profile: {
    real_name: string
    phone: string
    image_32: string
    first_name: string
    last_name: string
  }
  is_bot: boolean
  is_app_user: boolean
}

export interface SlackChannel {
  id: string
  name: string
  num_members: number
}

export interface FetchChannels {
  channels: SlackChannel[]
  response_metadata: { next_cursor: string }
}

export interface Fetchmembers {
  members: SlackUser[], response_metadata: { next_cursor: string }
}

export enum SlackTextMessageTypes {
  PLAINTEXT = "plain_text",
  MARKDOWN = "mrkdwn"
}

export enum SlackActionType {
  BUTTON = "button"
}

export interface SlackTextMessage {
  type: SlackTextMessageTypes,
  text: string
  emoji?: boolean
}

export enum MessageBlockType {
  HEADER = "header",
  SECTION = "section",
  ACTIONS = "actions"
}

export enum MessageActionButtonStyle {
  PRIMARY = "primary",
  DANGER = "danger",
}

export interface SlackMessageBlock {
  type: MessageBlockType
  text?: SlackTextMessage
  fields?: SlackTextMessage[]
  elements?: SlackActionBlock[]
}

export interface SlackActionBlock {
  type: SlackActionType
  text: SlackTextMessage
  style: MessageActionButtonStyle
  value: string
}

export interface SlackMessage {
  text?: string
  blocks?: SlackMessageBlock[]
}

export interface SendSlackMessagePayload {
  channel: string
  message: SlackMessage
  accessToken: string
}

export interface SendSlackResponsePayload {
  url: string
  message: SlackMessage
}


export interface SlackResponseAction {
  action_id: string
  value: string
}

export interface SlackResponseChannel {
  id: string
  name: string
}
export interface SlackResponseUser {
  id: string
  name: string
  username: string
}
export interface SlackResponse {
  actions: SlackResponseAction[]
  response_url: string
  user: SlackResponseUser
  channel: SlackResponseChannel
  type: string
}