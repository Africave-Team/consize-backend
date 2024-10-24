import * as XLSX from 'xlsx-js-style'
import path from "path"
import { existsSync, mkdirSync } from 'fs'

const createWorkbook = ({ statsData, tableData, reviewData, assessmentData, additionalQuestionsData }: Omit<ExportHandlerInterface, "name">) => {
  // Create a new workbook
  const workbook = XLSX.utils.book_new()
  if (statsData) {
    const ws = XLSX.utils.aoa_to_sheet(statsData)
    const colWidths = [
      { wch: 35 }, // Width of column A (Name)
      { wch: 40 }, // Width of column B (Age)
      { wch: 120 }, // Width of column B (Age)
    ]

    // Apply column widths to the worksheet
    ws['!cols'] = colWidths
    XLSX.utils.book_append_sheet(workbook, ws, "Course Statistics")
  }

  if (tableData) {
    // Create a worksheet for Sheet 2
    const sheet2 = XLSX.utils.aoa_to_sheet(tableData)

    const colWidths2 = [
      { wch: 50 }, // Width of column A (Name)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 30 }, // Width of column B (Age)
    ]

    // Apply column widths to the worksheet
    sheet2['!cols'] = colWidths2
    // Add Sheet 2 to the workbook
    XLSX.utils.book_append_sheet(workbook, sheet2, 'Course Students')

  }

  if (reviewData) {
    // Create a worksheet for Sheet 2
    const sheet3 = XLSX.utils.aoa_to_sheet(reviewData)

    const colWidths3 = [
      { wch: 70 }, // Width of column A (Question)
      { wch: 40 }, // Width of column B (Response)
      { wch: 40 }, // Width of column B (Response type)
      { wch: 40 }, // Width of column B (Student name)
      { wch: 40 }, // Width of column B (Phone number)
    ]

    // Apply column widths to the worksheet
    sheet3['!cols'] = colWidths3
    // Add Sheet 2 to the workbook
    XLSX.utils.book_append_sheet(workbook, sheet3, 'Survey responses')

  }

  if (assessmentData) {
    const sheet3 = XLSX.utils.aoa_to_sheet(assessmentData)

    const colWidths3 = [
      { wch: 70 }, // Width of column A (Question)
      { wch: 40 }, // Width of column B (Response)
      { wch: 40 }, // Width of column B (Response type)
      { wch: 40 }, // Width of column B (Student name)
      { wch: 40 }, // Width of column B (Phone number)
    ]

    // Apply column widths to the worksheet
    sheet3['!cols'] = colWidths3
    // Add Sheet 2 to the workbook
    XLSX.utils.book_append_sheet(workbook, sheet3, "Assessments")
  }

  if (additionalQuestionsData && additionalQuestionsData[0]) {
    const sheet4 = XLSX.utils.aoa_to_sheet(additionalQuestionsData)

    const colWidths4 = additionalQuestionsData[0]?.map((_, index) => {
      if (index === 0) {
        return { wch: 40 }
      } else if (index < 2) {
        return { wch: 30 }
      }
      return { wch: 50 }
    })

    // Apply column widths to the worksheet
    sheet4['!cols'] = colWidths4
    // Add Sheet 2 to the workbook
    XLSX.utils.book_append_sheet(workbook, sheet4, "Additional Student Information")
  }


  return workbook
}

const createSampleWorkbook = ({ tableData }: { tableData?: RowData[][] | undefined }) => {
  // Create a new workbook
  const workbook = XLSX.utils.book_new()

  if (tableData) {
    // Create a worksheet for Sheet 2
    const sheet2 = XLSX.utils.aoa_to_sheet(tableData)

    const colWidths2 = [
      { wch: 50 }, // Width of column A (Name)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 40 }, // Width of column B (Age)
      { wch: 30 }, // Width of column B (Age)
    ]

    // Apply column widths to the worksheet
    sheet2['!cols'] = colWidths2
    // Add Sheet 2 to the workbook
    XLSX.utils.book_append_sheet(workbook, sheet2, 'Sample learner group data')

  }


  return workbook
}

export interface RowData {
  v: string
  t: string
  s?: {
    font?: {
      bold?: boolean
      color?: {
        rgb: string
      }
      sz?: number
    }
    fill?: {
      patternType?: "solid" | "none"
      fgColor?: {
        rgb?: string
      }
      bgColor?: {
        rgb?: string
      }
    }
  }
}

interface ExportHandlerInterface {
  name: string
  statsData?: RowData[][] | undefined
  tableData?: RowData[][] | undefined
  reviewData?: RowData[][] | undefined
  assessmentData?: RowData[][] | undefined

  additionalQuestionsData?: RowData[][] | undefined
}

export const handleExport = async ({ name, statsData, tableData, reviewData, assessmentData, additionalQuestionsData }: ExportHandlerInterface): Promise<string> => {
  // Create the workbook
  const projectRoot = process.cwd()
  const workbook = createWorkbook({ statsData, tableData, reviewData, assessmentData, additionalQuestionsData })
  const filePath = path.join(projectRoot, "generated-files", `${name}.xlsx`)
  // Save the workbook to a file
  if (!existsSync(path.join(projectRoot, "generated-files"))) {
    mkdirSync(path.join(projectRoot, "generated-files"))
  }
  try {
    await XLSX.writeFile(workbook, filePath)
  } catch (error) {
    console.log("write error=>", error)
  }
  return filePath
}



export const exportSampleData = ({ name, tableData }: ExportHandlerInterface) => {
  // Create the workbook
  const workbook = createSampleWorkbook({ tableData })

  // Save the workbook to a file
  XLSX.writeFile(workbook, `${name}.xlsx`)
}
