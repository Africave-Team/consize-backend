import * as redis from 'redis'
import config from '../../config/config'
const redisClient = redis.createClient({
  password: config.redis.password,
  socket: {
    host: config.redis.host,
    port: config.redis.port
  }
}).on('error', err => console.error('Redis Client Error', err)).on('connect', () => console.info('Redis Client connected', `${config.redis.host}`))
redisClient.connect()
export { redisClient }

