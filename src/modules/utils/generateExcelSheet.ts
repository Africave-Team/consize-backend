import * as XLSX from 'xlsx-js-style'
import path from "path"

const createWorkbook = ({ statsData, tableData }: Omit<ExportHandlerInterface, "name">) => {
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
}

export const handleExport = async ({ name, statsData, tableData }: ExportHandlerInterface): Promise<string> => {
  // Create the workbook
  const projectRoot = process.cwd()
  const workbook = createWorkbook({ statsData, tableData })
  const filePath = path.join(projectRoot, "generated-files", `${name}.xlsx`)
  // Save the workbook to a file
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
