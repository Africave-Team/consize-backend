/* eslint-disable no-param-reassign */
import { Schema, Document, Model } from 'mongoose'

interface PopulateOption {
  path: string
  populate?: PopulateOption | null
}

export interface QueryResult<T> {
  data: T[]
  page: number
  limit: number
  totalPages: number
  totalResults: number
}

export interface IOptions {
  sortBy?: string
  projectBy?: string
  populate?: string
  limit?: number
  page?: number
}
// @ts-ignore
const paginate = <T extends Document, U extends Model<U>> (schema: Schema<T>): void => {
  /**
   * @typedef {Object} QueryResult
   * @property {Document[]} results - Results found
   * @property {number} page - Current page
   * @property {number} limit - Maximum number of results per page
   * @property {number} totalPages - Total number of pages
   * @property {number} totalResults - Total number of documents
   */
  /**
   * Query for documents with pagination
   * @param {Object} [filter] - Mongo filter
   * @param {Object} [options] - Query options
   * @param {string} [options.sortBy] - Sorting criteria using the format: sortField:(desc|asc). Multiple sorting criteria should be separated by commas (,)
   * @param {string} [options.populate] - Populate data fields. Hierarchy of fields should be separated by (.). Multiple populating criteria should be separated by commas (,)
   * @param {number} [options.limit] - Maximum number of results per page (default = 10)
   * @param {number} [options.page] - Current page (default = 1)
   * @param {string} [options.projectBy] - Fields to hide or include (default = '')
   * @returns {Promise<QueryResult>}
   */
  schema.static('paginate', async function (filter: Record<string, any>, options: IOptions): Promise<QueryResult<T>> {
    let sort: string = ''
    if (options.sortBy) {
      const sortingCriteria: any = []
      options.sortBy.split(',').forEach((sortOption: string) => {
        const [key, order] = sortOption.split(':')
        sortingCriteria.push((order === 'desc' ? '-' : '') + key)
      })
      sort = sortingCriteria.join(' ')
    } else {
      sort = 'createdAt'
    }

    let project: string = ''
    if (options.projectBy) {
      const projectionCriteria: string[] = []
      options.projectBy.split(',').forEach((projectOption) => {
        const [key, include] = projectOption.split(':')
        projectionCriteria.push((include === 'hide' ? '-' : '') + key)
      })
      project = projectionCriteria.join(' ')
    } else {
      project = '-createdAt -updatedAt'
    }

    const limit = options.limit && parseInt(options.limit.toString(), 10) > 0 ? parseInt(options.limit.toString(), 10) : 10
    const page = options.page && parseInt(options.page.toString(), 10) > 0 ? parseInt(options.page.toString(), 10) : 1
    const skip = (page - 1) * limit

    const countPromise = this.countDocuments(filter).exec()
    let docsPromise = this.find(filter).sort(sort).skip(skip).limit(limit).select(project)

    if (options.populate) {
      const buildNestedPopulate = function (paths: string[]): PopulateOption | null {
        if (!paths.length) return null
        const [path, ...rest] = paths
        if (!path) return null
        return {
          path,
          populate: buildNestedPopulate(rest)
        }
      }
      options.populate.split(',').forEach((populateOption: any) => {
        const populatePaths = populateOption.split('.')
        docsPromise = docsPromise.populate(buildNestedPopulate(populatePaths))
      })
    }

    docsPromise = docsPromise.exec()

    return Promise.all([countPromise, docsPromise]).then((values) => {
      const [totalResults, results] = values
      const totalPages = Math.ceil(totalResults / limit)
      const result = {
        data: results,
        page,
        limit,
        totalPages,
        totalResults,
      }
      return Promise.resolve(result)
    })
  })
}

export default paginate
