import * as redis from 'redis'
import config from '../../config/config'
const redisClient = redis.createClient({
  url: config.redis
}).on('error', err => console.log('Redis Client Error', err)).on('connect', () => console.log('Redis Client connected', `${config.redis}`))
redisClient.connect()
export { redisClient }

