export interface Message {
  to: string,
  template: string
  subject: string
  templateVariables: {
    name?: string,
    firstName?: string,
    url?: string
  }
}
