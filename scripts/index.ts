import * as ejs from 'ejs';
import { promises as fs } from 'fs';
import * as path from 'path';

import MarkdownIt from 'markdown-it';
import * as katex from 'katex';
import highlightJs from 'highlight.js';
import mdFootnote from 'markdown-it-footnote';
import mdTex from 'markdown-it-texmath';
import mdAnchor from 'markdown-it-anchor';
import mdTableOfContents from 'markdown-it-table-of-contents';
import mdInlineComment from 'markdown-it-inline-comments';
import mdCheckbox from 'markdown-it-task-checkbox';
import mdEmoji from 'markdown-it-emoji';
import mdMermaid from 'markdown-it-mermaid';

interface Document {
  title: string;
  filename: string; // without extension
  html: string;
}

(async () => {
  const MARKDOWN_DIRECTORY_PATH: string = path.join(__dirname, '..');
  const DIST_DIRECTORY_PATH: string = path.join(__dirname, '../docs');
  const TEMPLATE_FILE_PATH: Buffer = await fs.readFile(path.join(__dirname, './index.ejs'));

  const md: MarkdownIt = new MarkdownIt({
    html: false,
    xhtmlOut: false,
    breaks: false,
    langPrefix: 'language-',
    linkify: true,
    typographer: true,
    quotes: '“”‘’',
    highlight: (str, lang) => {
      if (lang && highlightJs.getLanguage(lang)) {
        return `<pre class="hljs"><code>${highlightJs.highlight(lang, str, true).value}</code></pre>`;
      }
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    },
  }).use(mdFootnote)
    .use(mdInlineComment)
    .use(mdMermaid)
    .use(mdEmoji)
    .use(mdTex, {
      engine: katex,
      delimiters: 'gitlab',
      macros: { '\\RR': '\\mathbb{R}' },
    })
    .use(mdAnchor)
    .use(mdTableOfContents, {
      includeLevel: [2, 3, 4],
      format: (content: string) => content.replace(/\[\^.*\]/, ''),
    })
    .use(mdCheckbox, {
      disabled: true,
    })

    const markdownToHtml = (markdown: string) => {
      const preContents = '[[toc]]\n\n';
      return md.render(`${preContents}${markdown}`);
    };

    const writeHtmlFromMarkdown = async (filename: string) => {
      const markdown = (await fs.readFile(`${MARKDOWN_DIRECTORY_PATH}/${filename}.md`)).toString();
      const html = markdownToHtml(markdown);

      const document: Document = { title: markdown.match(/^#\s.*/)[0].replace(/^#\s/, ''), filename, html };

      fs.writeFile(`${DIST_DIRECTORY_PATH}/${filename}.html`, ejs.render(String(TEMPLATE_FILE_PATH), { document }));

      return document;
    };

    const ignoredMarkdowns = ['README.md'];
    const filterCondition = (filename: string) =>
      !ignoredMarkdowns.includes(filename) && !filename.startsWith('_') && path.parse(filename).ext === '.md';

    (await fs.readdir(MARKDOWN_DIRECTORY_PATH))
      .filter(filterCondition)
      .map((filename) => path.parse(filename).name)
      .forEach((filename) => writeHtmlFromMarkdown(filename));
})();

