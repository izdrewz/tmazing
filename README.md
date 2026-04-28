# Tmazing Uni Hub

A local-first university dashboard for deadlines, personal goals, module-organised source storage, draft source checking, Harvard-style reference support, module dashboards, and study-session file exports.

## What it includes

- Module dashboard cards for E104, K102, and any other module codes you use
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
- Daily study-goal prompt when you open the app
- Deadline reminder if active deadlines are due within 7 days
- Monday weekly study review
- End-session vault that compiles sources/draft/session notes and lets you choose keep, merge, or delete for files touched in the session
- Local Markdown and JSON downloads for session files
- GitHub-library pack exports that can be uploaded to the repo's `/library` folder
- Export/import backup as JSON

## Important privacy note

Your study data is stored in your browser using `localStorage`. The GitHub repo stores the app code, not your private source library or drafts.

The app cannot silently save files into GitHub or choose folders without your action. At the end of a session it downloads local files and creates GitHub-ready library packs. You decide what to save locally and what to upload to GitHub.

Export a backup regularly if your source library becomes important.

## How to use

1. Open `index.html` in a browser.
2. Use the module dashboards to see source counts, active deadlines, units/blocks, and goals by module.
3. Add deadlines.
4. Add personal goals.
5. Add sources into the library.
   - Use module codes such as `E104` or `K102`.
   - Add a unit/block such as `Block 1`, `Unit 3`, or `Week 5`.
   - Upload a PDF, DOCX, or text-like file, or paste source text manually.
6. Search your library while studying.
7. Paste your draft into the source checker.
8. Click **Analyse draft**.
9. Hover or click a highlighted word or phrase.
10. Check the matching source snippet and page/paragraph location.
11. Choose **Add citation** for the correct source.
12. Copy the cited draft and bibliography.
13. Use **End session** when you finish studying.
14. Review/edit the compiled session notes, name the files, choose whether sources should be kept, merged, or deleted, then save the downloaded session files.

## End-session file workflow

At the end of a study session, the app can create:

- a local Markdown session file
- a JSON GitHub-library pack
- a Markdown GitHub-library pack

The GitHub-library pack is intended for manual upload to the repo's `/library` folder.

Suggested GitHub library folders:

- `library/E104/block-1/`
- `library/E104/block-2/`
- `library/K102/unit-3/`
- `library/session-exports/`

Do not upload private or copyrighted course materials unless you are allowed to store them in a public GitHub repository.

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
- Tagging sources by theme/concept
- Google Drive or OneDrive integration
- Real database backend if you want access across devices without manual export/import
