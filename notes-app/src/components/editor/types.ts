import type { BaseEditor } from 'slate';
import type { ReactEditor } from 'slate-react';
import type { HistoryEditor } from 'slate-history';
import type { Heading, Paragraph, BulletList, BulletItem, CheckList, CheckItem, Link, PlainText } from './markdown';

export type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

export type CustomElement =
  | Heading
  | Paragraph
  | BulletList
  | BulletItem
  | CheckList
  | CheckItem
  | Link;

export type CustomText = PlainText;

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
