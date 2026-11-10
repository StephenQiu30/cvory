import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';

export class ImportPosition {
  @ApiProperty() x!: number;
  @ApiProperty() y!: number;
}

export class ImportTextBlock {
  @ApiProperty({enum: ['heading', 'paragraph', 'list-item', 'table-row', 'line']})
  kind!: 'heading' | 'paragraph' | 'list-item' | 'table-row' | 'line';
  @ApiProperty() order!: number;
  @ApiProperty() text!: string;
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional({type: ImportPosition}) position?: ImportPosition;
}

export class ResumeImportCandidate {
  @ApiProperty({enum: ['docx', 'pdf']}) format!: 'docx' | 'pdf';
  @ApiPropertyOptional() pageCount?: number;
  @ApiProperty({type: [ImportTextBlock]}) blocks!: ImportTextBlock[];
  @ApiProperty({type: [String]}) warnings!: string[];
}
