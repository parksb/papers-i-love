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

interface MetaInfo {
  authors: string;
  title: string;
  date: string;
  license?: string;
  link: string;
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
    });

    const composeMetaInfo = (markdown: string): MetaInfo | null => {
      try {
        const frontMatters: string[] = markdown.match(/(-{3})([\s\S]+?)(\1)/)[2].match(/[^\r\n]+/g);
        if (!frontMatters) return null;

        return frontMatters.reduce((obj, info: string) => {
          const kvp = info.match(/(.+?):(.+)/);
          const key = kvp[1].replace(/\s/g, '');
          const value = kvp[2].replace(/['"]/g, '').trim();
          obj[key] = value;
          return obj;
        }, {}) as MetaInfo;
      } catch (e) {
        return null;
      }
    };

    const stripFrontMatter = (markdown: string) => {
      return markdown.replace(/(-{3})([\s\S]+?)(\1)/, '');
    }

    const writeHtmlFromMarkdown = async (filename: string) => {
      const markdown = (await fs.readFile(`${MARKDOWN_DIRECTORY_PATH}/${filename}.md`)).toString();
      const markdownWithoutFrontMatter = stripFrontMatter(markdown).trim();
      const titleKor = markdownWithoutFrontMatter.match(/^#\s.*/)[0].replace(/^#\s/, '');;

      const metaInfo = composeMetaInfo(markdown);
      let preContents = '';
      if (metaInfo) {
        const { authors, title, date, license, link } = metaInfo;
        const h = '| author(s)  | title    | date    ' + (license ? '| license    ' : '') + '| link    |'
        const d = '|------------|----------|---------' + (license ? '|------------' : '') + '|---------|'
        const c = `| ${authors} | ${title} | ${date} ` + (license ? `| ${license} ` : '') + `| ${link} |`;
        preContents += `${h}\n${d}\n${c}`;
      }
      preContents += `\n\n[[toc]]`;

      const html = md.render(`${preContents}\n\n${markdownWithoutFrontMatter}`);
      const document: Document = { title: titleKor, filename, html };

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

