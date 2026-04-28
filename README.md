# Tmazing Uni Hub

A local-first university dashboard for deadlines, personal goals, module-organised source storage, draft source checking, and Harvard-style reference support.

## What it includes

- Deadline tracker
- Personal goals / habits tracker
- Source library organised by:
  - module, for example `E104` or `K102`
  - unit or block
  - title
  - author
  - year
  - publisher / course material / website
  - URL or file note
  - page or section location
  - searchable page or paragraph segments
- Library search across source text, module, unit, author, title, page/paragraph locations, and reference details
- PDF text extraction in the browser using PDF.js
- DOCX text extraction in the browser using Mammoth
- Draft source checker
- Highlighted words and short phrases from your draft that also appear in your saved sources
- Hover or click a highlighted word/phrase to see matching source snippets
- Source match snippets with page or paragraph location labels
- Add an inline Harvard-style citation from a selected source
- Inline citations can include the source location, for example page or paragraph
- Automatically generated bibliography, alphabetised by author/title
- Ignore dictionary so common words like `the`, `and`, `of`, or any custom words do not become source links
- Export/import backup as JSON

## Important privacy note

Your study data is stored in your browser using `localStorage`. The GitHub repo stores the app code, not your private source library or drafts.

Export a backup regularly if your source library becomes important.

## How to use

1. Open `index.html` in a browser.
2. Add deadlines.
3. Add personal goals.
4. Add sources into the library.
   - Use module codes such as `E104` or `K102`.
   - Add a unit/block such as `Block 1`, `Unit 3`, or `Week 5`.
   - Upload a PDF, DOCX, or text-like file, or paste source text manually.
5. Search your library while studying.
6. Paste your draft into the source checker.
7. Click **Analyse draft**.
8. Hover or click a highlighted word or phrase.
9. Check the matching source snippet and page/paragraph location.
10. Choose **Add citation** for the correct source.
11. Copy the cited draft and bibliography.

## File handling

This version can read these files directly in the browser:

- `.pdf`
- `.docx`
- `.txt`
- `.md`
- `.csv`
- `.html`
- `.json`
- `.rtf`

PDF files are segmented by page. DOCX and pasted/manual text are segmented by paragraph. These segments are used for search results, source snippets, and citation locators.

Scanned image-only PDFs may not contain selectable text. If extraction fails, paste the useful text manually.

## About source checking

The checker works by matching words and short phrases in your draft against the text you saved in your source library. It shows snippets from matching sources and offers citation suggestions.

It is a study aid, not proof that a sentence must be cited. You still need to decide whether a citation is academically needed and whether the selected source is the right one.

## Harvard referencing

The app generates simple Harvard-style references using the source fields you provide. Inline citations can include a location such as `p. 3` or `paragraph 12`.

Always check against your university or module referencing guidance before submitting work.

## GitHub Pages

This is a static app. To publish it with GitHub Pages:

1. Go to the repository settings.
2. Open **Pages**.
3. Choose **Deploy from a branch**.
4. Select the `main` branch and `/root`.
5. Save.

After GitHub Pages finishes deploying, the app should be available at:

`https://izdrewz.github.io/tmazing/`

## Future upgrades that would make sense

- OCR for scanned PDFs
- Better quote detection
- Draft export to `.docx`
- Saved module dashboards for E104, K102, and other modules
- Tagging sources by theme/concept
- Google Drive or OneDrive integration
- Real database backend if you want access across devices without manual export/import
