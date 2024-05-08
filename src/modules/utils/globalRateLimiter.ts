import rateLimit from 'express-rate-limit'

const rateLimiter = rateLimit({
  windowMs: 35 * 60 * 1000,
  max: 2,
  skipSuccessfulRequests: true,
})

export default rateLimiter
