import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

const rows = [
  { folderKey: 'rc_library_root',      label: 'RC Library App Data (Root)',    description: 'Master root folder for all RC Library app data in Dropbox', dropboxPath: '/Apps NAI/RC Library App Data', dropboxWebUrl: 'https://www.dropbox.com/work/Ricardo%20Cidale/Apps%20NAI/RC%20Library%20App', category: 'source', enabled: 1, validationStatus: 'valid', sortOrder: 0 },
  { folderKey: 'authors_books_backup', label: 'Authors and Books Backup',       description: 'Primary backup of all author and book data — 115+ author subfolders with PDFs, transcripts, and metadata', dropboxPath: '/Apps NAI/RC Library App Data/Authors and Books Backup', dropboxWebUrl: 'https://www.dropbox.com/work/Ricardo%20Cidale/Apps%20NAI/RC%20Library%20App', category: 'backup', enabled: 1, validationStatus: 'valid', sortOrder: 1 },
  { folderKey: 'books_inbox',          label: 'Books Content Entry Folder',     description: 'Inbox for new book uploads — drop PDFs/folders here to trigger the ingestion pipeline', dropboxPath: '/Apps NAI/RC Library App Data/Books Content Entry Folder', dropboxWebUrl: 'https://www.dropbox.com/scl/fo/neyz3kxcs91gk6n4umt4u/AFpz-KhpssBSaP6KczUkNSU?rlkey=1mpqmu9l5zlyfk8d2mwqtxlmq&dl=0', category: 'inbox', enabled: 1, validationStatus: 'valid', sortOrder: 2 },
  { folderKey: 'authors_inbox',        label: 'Authors Content Entry Folder',   description: 'Inbox for new author uploads — drop author folders here to trigger the ingestion pipeline', dropboxPath: '/Apps NAI/RC Library App Data/Authors Content Entry Folder', dropboxWebUrl: null, category: 'inbox', enabled: 1, validationStatus: 'unchecked', sortOrder: 3 },
  { folderKey: 'graphics_design',      label: 'Graphics and Design',            description: 'Design assets, branding materials, and graphics for the RC Library app — not currently active', dropboxPath: '/Apps NAI/RC Library App Data/Graphics and Design', dropboxWebUrl: null, category: 'design', enabled: 0, validationStatus: 'valid', sortOrder: 4 },
  { folderKey: 'legacy_backup',        label: 'Legacy Backup (Old Path)',        description: 'Previous backup path — no longer valid. Kept for reference only.', dropboxPath: '/Cidale Interests/Company/Norfolk AI/Apps/RC Library/backup', dropboxWebUrl: null, category: 'backup', enabled: 0, validationStatus: 'invalid', sortOrder: 5 },
  { folderKey: 'legacy_inbox',         label: 'Legacy Inbox (Old Path)',         description: 'Previous inbox path — no longer valid. Kept for reference only.', dropboxPath: '/Cidale Interests/Company/Norfolk AI/Apps/RC Library/Inbox', dropboxWebUrl: null, category: 'inbox', enabled: 0, validationStatus: 'invalid', sortOrder: 6 },
];

for (const r of rows) {
  await conn.execute(
    `INSERT INTO dropbox_folder_configs (folderKey, label, description, dropboxPath, dropboxWebUrl, category_dfc, enabled, validationStatus_dfc, sortOrder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE label=VALUES(label), description=VALUES(description), dropboxPath=VALUES(dropboxPath), dropboxWebUrl=VALUES(dropboxWebUrl), category_dfc=VALUES(category_dfc), enabled=VALUES(enabled), validationStatus_dfc=VALUES(validationStatus_dfc), sortOrder=VALUES(sortOrder)`,
    [r.folderKey, r.label, r.description, r.dropboxPath, r.dropboxWebUrl, r.category, r.enabled, r.validationStatus, r.sortOrder]
  );
  console.log('Upserted:', r.folderKey);
}

await conn.end();
console.log('Done!');
