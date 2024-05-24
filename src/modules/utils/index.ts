import catchAsync from './catchAsync'
import pick from './pick'
import authLimiter from './rateLimiter'

export { catchAsync, pick, authLimiter }

export const convertTo24Hour = function (time12h: string) {
  // Use a regular expression to capture the time components and the period (AM/PM)
  const [time, modifier] = time12h.split(' ')

  if (time && modifier) {
    let [hours, minutes] = time.split(':')

    if (hours && minutes) {
      // Convert hours to a number
      let h = parseInt(hours, 10)

      // If the modifier is PM and the hour is less than 12, add 12 to the hours
      if (modifier === 'PM' && h !== 12) {
        h += 12
      }

      // If the modifier is AM and the hour is 12 (midnight), set the hours to 0
      if (modifier === 'AM' && h === 12) {
        h = 0
      }

      // Format hours and minutes to ensure two digits
      hours = h.toString().padStart(2, '0')
      minutes = minutes.padStart(2, '0')

      return `${hours}:${minutes}`
    }
    return null
  }
  return null
}
