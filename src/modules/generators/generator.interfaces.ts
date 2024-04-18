export interface BoardMember {
  rank: number,
  name: string,
  score: number,
  isCurrentUser: boolean
}
export interface GenerateLeaderboardPayload {
  courseName: string,
  studentName: string,
  organizationName: string,
  leaderboard: BoardMember[],
}

export interface GenerateCertificatePayload {
  studentName: string,
  courseName: string,
  organizationName: string,
  signature1: string,
  signatory1: string,
  signature2: string,
  signatory2: string,
}