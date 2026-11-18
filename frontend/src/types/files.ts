export type FileNodeType = 'file' | 'dir';

export interface FileNode {
  name: string;
  path: string;
  type: FileNodeType;
  size?: number;
  children?: FileNode[];
}

export interface FileTreeResponse {
  root: FileNode[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  size: number;
}

export interface FileSavePayload {
  path: string;
  content: string;
}

export interface FileCreatePayload {
  path: string;
  type: FileNodeType;
}

export interface FileRenamePayload {
  path: string;
  new_path: string;
}
