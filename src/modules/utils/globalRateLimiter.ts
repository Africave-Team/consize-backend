import rateLimit from 'express-rate-limit'

const rateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1,
  skipSuccessfulRequests: true,
})

export default rateLimiter
