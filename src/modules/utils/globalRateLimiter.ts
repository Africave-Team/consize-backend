import rateLimit from 'express-rate-limit'

const rateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
})

export default rateLimiter
