/**
 * Jupyter notebook types.
 */

export type NotebookCellType = 'code' | 'markdown' | 'raw'

export type NotebookOutputImage = {
  image_data: string
  media_type: 'image/png' | 'image/jpeg'
}

export type NotebookCellOutput = {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error'
  text?: string | string[]
  data?: Record<string, unknown>
  ename?: string
  evalue?: string
  traceback?: string[]
}

export type NotebookCellSourceOutput = {
  output_type: string
  text?: string
  image?: NotebookOutputImage
}

export type NotebookCell = {
  id?: string
  cell_type: NotebookCellType
  source: string | string[]
  execution_count?: number | null
  outputs?: NotebookCellOutput[]
}

export type NotebookContent = {
  cells: NotebookCell[]
  metadata: {
    language_info?: {
      name?: string
    }
    [key: string]: unknown
  }
}
