declare module 'react-file-icon' {
  import { FC } from 'react';

  export type DefaultExtensionType = string;

  export interface FileIconProps {
    extension?: string;
    color?: string;
    labelColor?: string;
    labelTextColor?: string;
    foldColor?: string;
    glyphColor?: string;
    type?: string;
    radius?: number;
    [key: string]: any;
  }

  export const FileIcon: FC<FileIconProps>;
  export const defaultStyles: Record<string, Partial<FileIconProps>>;
}
