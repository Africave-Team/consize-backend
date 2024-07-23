import StatsModel from './stats.model'
import { DailyStatsModelInterface, DailyStatsServiceInput } from './stats.interfaces'
import moment from 'moment'


export const fetchDailyStats = async function (payload: DailyStatsServiceInput): Promise<DailyStatsModelInterface[]> {
  const result = await StatsModel.find({ date: { $gte: moment(payload.start).toDate(), $lte: moment(payload.end).toDate() } })
  // Return the total count
  return result
}

// export const updateDailyStats = async function (stats: DailyStatsModel): Promise<void> {
// const current = await StatsModel.findOne({date: {$gte: moment().startOf('day').toDate(), $lte: moment().endOf('day').toDate()}})

// }